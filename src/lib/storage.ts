import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface UploadResult {
  url: string
  path: string
  error?: string
  /** True if the URL is a signed URL (expires) vs public URL (permanent). */
  signed?: boolean
}

/**
 * Buckets that contain sensitive data and should use signed URLs
 * (with expiry) instead of public URLs. Public URLs on these buckets
 * would let anyone with the URL access the file — no per-project
 * isolation, no expiry.
 *
 * For financial receipts, NCR evidence photos, and chat media, signed
 * URLs with a 1-hour TTL are the minimum security bar.
 *
 * P1-20 in gap analysis: previously, `drawings` and `dsr-photos` were
 * NOT in this set — they used public URLs. But drawings are often
 * client-confidential (contract drawings, rebar shop drawings) and
 * DSR photos frequently capture site work that shouldn't be publicly
 * scrapeable. The CHANGELOG listed "No signed URLs for storage objects
 * (uses public URLs — see L8)" as a Known Limitation — this fix
 * closes that hole by promoting both buckets to signed URLs.
 */
const SENSITIVE_BUCKETS = new Set([
  'receipts',
  'ncr-photos',
  'chat-media',
  'ra-bills',
  // Added in P1-20 — drawings + DSR photos contain client-confidential
  // content and shouldn't be publicly scrapeable.
  'drawings',
  'dsr-photos',
])

/** TTL for signed URLs — 1 hour (in seconds). */
const SIGNED_URL_TTL = 3600

// ─── Upload validation ─────────────────────────────────────────────────────
// Per-bucket MIME allowlists. Without these, a user could upload a 500MB
// PDF (freezes the UI on download) or an SVG-with-JS (XSS vector when
// rendered inline) or a .exe (malware distribution via chat-media).
//
// The allowlists are deliberately permissive about formats but strict
// about categories — e.g. drawings accepts PDF + DWG + image formats,
// not arbitrary application/* types. PII-bearing types (e.g. vCard)
// are excluded everywhere.
interface BucketPolicy {
  /** Max file size in bytes. Defaults to 25 MB if not set. */
  maxSize: number
  /** Allowed MIME prefixes (matched against file.type). Empty = allow all. */
  allowedMimePrefixes: string[]
  /** Explicitly disallowed MIME types (matched exactly). */
  disallowedMime: string[]
  /** Allowed file extensions (lowercase, no dot). Empty = allow all. */
  allowedExtensions: string[]
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024 // 25 MB

const BUCKET_POLICIES: Record<string, BucketPolicy> = {
  drawings: {
    // Drawings can be large (multi-page PDFs). 50 MB ceiling.
    maxSize: 50 * 1024 * 1024,
    // DWG/DXF don't have registered MIME types — browsers send
    // application/octet-stream. Allow it so CAD files pass the MIME gate
    // (the extension allowlist below catches non-CAD octet-stream uploads).
    allowedMimePrefixes: ['application/pdf', 'image/', 'application/octet-stream'],
    disallowedMime: ['image/svg+xml'], // SVG-with-JS XSS vector
    allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'dwg', 'dxf'],
  },
  'dsr-photos': {
    maxSize: 10 * 1024 * 1024, // 10 MB per photo
    allowedMimePrefixes: ['image/'],
    disallowedMime: ['image/svg+xml'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'heic', 'webp'],
  },
  'ncr-photos': {
    maxSize: 10 * 1024 * 1024,
    allowedMimePrefixes: ['image/'],
    disallowedMime: ['image/svg+xml'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'heic', 'webp'],
  },
  receipts: {
    maxSize: 10 * 1024 * 1024,
    allowedMimePrefixes: ['image/', 'application/pdf'],
    disallowedMime: ['image/svg+xml'],
    allowedExtensions: ['jpg', 'jpeg', 'png', 'pdf'],
  },
  'ra-bills': {
    maxSize: 25 * 1024 * 1024,
    allowedMimePrefixes: [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    disallowedMime: [],
    allowedExtensions: ['pdf', 'xls', 'xlsx', 'csv'],
  },
  'chat-media': {
    maxSize: 25 * 1024 * 1024,
    // Chat allows images, PDFs, and common docs — but no executables or
    // archives (decompression-bomb risk).
    allowedMimePrefixes: [
      'image/',
      'application/pdf',
      'text/',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/msword',
    ],
    disallowedMime: [
      'image/svg+xml', // XSS vector
      'application/x-msdownload',
      'application/x-executable',
      'application/x-dosexec',
      'application/zip', // decompression-bomb risk; drop entirely
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
    ],
    // Pass-2 audit P1-SEC fix: previously allowedExtensions was empty, so
    // an attacker could upload malware.exe with Content-Type: application/zip
    // (which was in allowedMimePrefixes) and bypass the executable block.
    // Now we require a known-safe extension — the extension gate catches
    // .exe/.bat/.sh/etc. even when the MIME type is spoofed.
    allowedExtensions: [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'heic',
      'pdf',
      'txt',
      'md',
      'csv',
      'json',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
    ],
  },
}

/**
 * Validate a file against the bucket's upload policy. Returns null if the
 * file passes, or an error string explaining why it was rejected.
 *
 * Checks:
 *   1. File size <= policy.maxSize
 *   2. file.type starts with one of policy.allowedMimePrefixes
 *   3. file.type not in policy.disallowedMime
 *   4. File extension (from name) in policy.allowedExtensions (if non-empty)
 *
 * If the bucket has no policy, falls back to a conservative default
 * (25 MB, no .exe / .svg / .js / .html).
 */
export function validateUpload(bucket: string, file: File): string | null {
  const policy = BUCKET_POLICIES[bucket]
  const maxSize = policy?.maxSize ?? DEFAULT_MAX_SIZE
  if (file.size > maxSize) {
    const mb = (maxSize / (1024 * 1024)).toFixed(0)
    return `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max for ${bucket}: ${mb} MB.`
  }

  // Conservative default for unknown buckets — block obviously dangerous types.
  const fallbackDisallowed = [
    'image/svg+xml', // XSS vector
    'application/x-msdownload',
    'application/x-executable',
    'application/x-dosexec',
    'application/javascript',
    'text/html',
  ]
  const disallowedMime = policy?.disallowedMime ?? fallbackDisallowed
  if (file.type && disallowedMime.includes(file.type)) {
    return `File type "${file.type}" is not allowed in ${bucket}.`
  }

  if (policy) {
    if (
      policy.allowedMimePrefixes.length > 0 &&
      file.type &&
      !policy.allowedMimePrefixes.some((p) => file.type.startsWith(p))
    ) {
      return `File type "${file.type}" is not allowed in ${bucket}. Allowed: ${policy.allowedMimePrefixes.join(', ')}.`
    }

    if (policy.allowedExtensions.length > 0) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (ext && !policy.allowedExtensions.includes(ext)) {
        return `File extension ".${ext}" is not allowed in ${bucket}. Allowed: ${policy.allowedExtensions.join(', ')}.`
      }
    }
  }

  return null
}

/**
 * Upload a file to Supabase Storage.
 * Creates a unique path using timestamp + original filename.
 *
 * For sensitive buckets (receipts, NCR photos, chat media, RA bills,
 * drawings, DSR photos), returns a signed URL with a 1-hour TTL instead
 * of a public URL. For other buckets, returns the public URL.
 *
 * Validates the file against the bucket's upload policy (size, MIME,
 * extension) before uploading. Returns an error string if validation
 * fails — the file is never sent to Supabase.
 */
export async function uploadFile(
  bucket: string,
  file: File,
  folder: string = ''
): Promise<UploadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { url: '', path: '', error: 'Supabase not configured' }
  }

  // ─── Validate before uploading (P1-21) ─────────────────────────────────
  const validationError = validateUpload(bucket, file)
  if (validationError) {
    return { url: '', path: '', error: validationError }
  }

  const ext = file.name.split('.').pop() || ''
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`

  const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    return { url: '', path: '', error: error.message }
  }

  // For sensitive buckets, create a signed URL with expiry.
  if (SENSITIVE_BUCKETS.has(bucket)) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(data.path, SIGNED_URL_TTL)

    if (signedError || !signedData) {
      // Sensitive bucket — do NOT fall back to a public URL, which would
      // bypass the per-project access control. Return an error so callers
      // can surface it instead of silently exposing the file publicly.
      return {
        url: '',
        path: data.path,
        signed: false,
        error: `Failed to generate signed URL for sensitive bucket "${bucket}": ${signedError?.message || 'unknown error'}. The file was uploaded but cannot be displayed without a valid signed URL.`,
      }
    }

    return { url: signedData.signedUrl, path: data.path, signed: true }
  }

  // Public bucket — return the public URL.
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { url: urlData.publicUrl, path: data.path, signed: false }
}

/**
 * Create a fresh signed URL for a storage path.
 * Use this when a previously-issued signed URL has expired.
 */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) return null

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL)

  if (error || !data) return null
  return data.signedUrl
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false

  const { error } = await supabase.storage.from(bucket).remove([path])

  return !error
}

/**
 * List files in a Supabase Storage bucket folder.
 *
 * For sensitive buckets, returns signed URLs (1-hour TTL) instead of
 * public URLs. Callers that display these URLs should handle expiry by
 * calling getSignedUrl() to refresh.
 */
export interface StoredFile {
  name: string
  url: string
  /** Storage path (e.g. "D-087/1730000000-abc.jpg") — required for deleteFile(). */
  path: string
  /** True if the URL is a signed URL (expires) vs public URL (permanent). */
  signed?: boolean
}

export async function listFiles(bucket: string, folder: string = ''): Promise<StoredFile[]> {
  if (!isSupabaseConfigured() || !supabase) return []

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

  if (error || !data) return []

  const files = data.filter((item) => item.id && !item.id.includes('.emptyFolderPlaceholder'))

  // For sensitive buckets, create signed URLs in batch.
  if (SENSITIVE_BUCKETS.has(bucket) && files.length > 0) {
    const paths = files.map((item) => (folder ? `${folder}/${item.name}` : item.name))
    // createSignedUrls returns an array of { path, signedUrl } or error per path
    const results = await Promise.all(
      paths.map(async (path) => {
        const { data: signedData, error: signedError } = await supabase!.storage
          .from(bucket)
          .createSignedUrl(path, SIGNED_URL_TTL)
        return { path, signedUrl: signedError ? null : signedData?.signedUrl || null }
      })
    )
    return files.map((item) => {
      const path = folder ? `${folder}/${item.name}` : item.name
      const signed = results.find((r) => r.path === path)
      return {
        name: item.name,
        url: signed?.signedUrl || '',
        path,
        signed: !!signed?.signedUrl,
      }
    })
  }

  // Public bucket — return public URLs.
  return files.map((item) => {
    const path = folder ? `${folder}/${item.name}` : item.name
    const { data: urlData } = supabase!.storage.from(bucket).getPublicUrl(path)
    return { name: item.name, url: urlData.publicUrl, path, signed: false }
  })
}

/**
 * Storage buckets used by OmniSite.
 * These must be created in the Supabase dashboard (Storage → New Bucket).
 *
 * ALL buckets below use signed URLs with a 1-hour TTL — none are public.
 * This is the security baseline after the P1-20 fix. Previously,
 * `drawings` and `dsr-photos` were public (anyone with a scraped URL
 * could view them).
 *
 * In the Supabase dashboard, ensure "Public" is OFF for every bucket.
 * The app handles signed-URL generation + refresh.
 */
export const STORAGE_BUCKETS = {
  DSR_PHOTOS: 'dsr-photos', // Daily site report photos (signed)
  DRAWINGS: 'drawings', // Drawing PDFs (signed)
  NCR_PHOTOS: 'ncr-photos', // NCR/ITR inspection photos (signed)
  RECEIPTS: 'receipts', // Financial receipt photos (signed)
  RA_BILLS: 'ra-bills', // RA Bill Excel/PDF uploads (signed)
  CHAT_MEDIA: 'chat-media', // Chat file/voice/image attachments (signed)
} as const
