// Downscales + re-encodes an image before it's uploaded to the scan-receipt API route.
// Purely about keeping the request body under Vercel's function body-size limit — a phone
// camera photo can be 10MB+ raw, but a receipt doesn't need more than ~1600px on its long
// side for a vision model to read it. Falls back to the original blob if anything fails.
const MAX_DIM = 1600
const JPEG_QUALITY = 0.85

export async function resizeForUpload(blob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return blob
    }

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const resized = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    return resized ?? blob
  } catch {
    return blob
  }
}
