import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface UploadResult {
  url: string
  path: string
  error?: string
}

/**
 * Upload a file to Supabase Storage.
 * Creates a unique path using timestamp + original filename.
 * Returns the public URL for the uploaded file.
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

  const { data, error } = await supabase!
    .storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    return { url: '', path: '', error: error.message }
  }

  // Get public URL
  const { data: urlData } = supabase!
    .storage
    .from(bucket)
    .getPublicUrl(data.path)

  return { url: urlData.publicUrl, path: data.path }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false

  const { error } = await supabase!
    .storage
    .from(bucket)
    .remove([path])

  return !error
}

/**
 * List files in a Supabase Storage bucket folder.
 */
export async function listFiles(bucket: string, folder: string = ''): Promise<{ name: string; url: string }[]> {
  if (!isSupabaseConfigured() || !supabase) return []

  const { data, error } = await supabase!
    .storage
    .from(bucket)
    .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })

  if (error || !data) return []

  return data
    .filter(item => item.id && !item.id.includes('.emptyFolderPlaceholder'))
    .map(item => {
      const path = folder ? `${folder}/${item.name}` : item.name
      const { data: urlData } = supabase!
        .storage
        .from(bucket)
        .getPublicUrl(path)
      return { name: item.name, url: urlData.publicUrl }
    })
}

/**
 * Storage buckets used by OmniSite.
 * These must be created in the Supabase dashboard (Storage → New Bucket).
 */
export const STORAGE_BUCKETS = {
  DSRR_PHOTOS: 'dsr-photos',        // Daily site report photos
  DRAWINGS: 'drawings',             // Drawing PDFs
  NCR_PHOTOS: 'ncr-photos',        // NCR/ITR inspection photos
  RECEIPTS: 'receipts',            // Financial receipt photos
  RA_BILLS: 'ra-bills',            // RA Bill Excel/PDF uploads
  CHAT_MEDIA: 'chat-media',        // Chat file/voice/image attachments
} as const
