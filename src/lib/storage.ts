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
 */
const SENSITIVE_BUCKETS = new Set(['receipts', 'ncr-photos', 'chat-media', 'ra-bills'])

/** TTL for signed URLs — 1 hour (in seconds). */
const SIGNED_URL_TTL = 3600

/**
 * Upload a file to Supabase Storage.
 * Creates a unique path using timestamp + original filename.
 *
 * For sensitive buckets (receipts, NCR photos, chat media, RA bills),
 * returns a signed URL with a 1-hour TTL instead of a public URL.
 * For public buckets (DSR photos, drawings), returns the public URL.
 */
export async function uploadFile(
  bucket: string,
  file: File,
  folder: string = ''
): Promise<UploadResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return { url: '', path: '', error: 'Supabase not configured' }
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
      // Fallback to public URL if signed URL fails (better than no URL)
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
      return { url: urlData.publicUrl, path: data.path, signed: false }
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
 * Sensitive buckets (receipts, ncr-photos, chat-media, ra-bills) should
 * NOT have "Public" enabled in the Supabase dashboard — the app uses
 * signed URLs with expiry for these.
 */
export const STORAGE_BUCKETS = {
  DSR_PHOTOS: 'dsr-photos', // Daily site report photos (public)
  DRAWINGS: 'drawings', // Drawing PDFs (public)
  NCR_PHOTOS: 'ncr-photos', // NCR/ITR inspection photos (signed)
  RECEIPTS: 'receipts', // Financial receipt photos (signed)
  RA_BILLS: 'ra-bills', // RA Bill Excel/PDF uploads (signed)
  CHAT_MEDIA: 'chat-media', // Chat file/voice/image attachments (signed)
} as const
