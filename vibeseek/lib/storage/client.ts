import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'vibeseek-videos'

/**
 * Server-only admin client for Supabase Storage.
 * 
 * WARNING: This uses the service_role key. 
 * DO NOT import this in client-side components ('use client').
 */
const storageClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

const storage = storageClient.storage.from(bucket)

/**
 * Upload MP4 to Supabase Storage. Returns public URL.
 * 
 * @param buffer - File content as Buffer
 * @param key - Destination filename/path in bucket
 * @param contentType - MIME type (default: video/mp4)
 * @returns Public URL of the uploaded file
 */
export async function uploadVideo(
  buffer: Buffer,
  key: string,
  contentType: string = 'video/mp4'
): Promise<string> {
  const { error } = await storage.upload(key, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(`Supabase storage upload failed: ${error.message}`)
  }

  return getPublicUrl(key)
}

/**
 * Generate the public URL for a storage object.
 * 
 * @param key - Filename/path in bucket
 * @returns Fully qualified public URL
 */
export function getPublicUrl(key: string): string {
  // Direct public URL construction consistent with Supabase standard:
  // {URL}/storage/v1/object/public/{bucket}/{key}
  return `${url}/storage/v1/object/public/${bucket}/${key}`
}
