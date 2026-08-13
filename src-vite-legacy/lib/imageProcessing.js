// Client-side image compression for item photos.
// Square cover-crop to TARGET_EDGE so every item tile has identical aspect
// (matches the existing emoji square and prevents layout shift in the carousel).

const TARGET_EDGE = 512
const QUALITY = 0.8
const MAX_INPUT_BYTES = 20 * 1024 * 1024 // 20 MB sanity guard

export async function compressItemPhoto(file) {
  if (!file) throw new Error('No file provided')
  if (!file.type.startsWith('image/')) throw new Error('File is not an image')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is larger than 20 MB')

  // createImageBitmap handles EXIF rotation when imageOrientation is 'from-image'.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })

  // Cover-crop: take the largest centered square, then scale to TARGET_EDGE.
  const srcSize = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - srcSize) / 2
  const sy = (bitmap.height - srcSize) / 2

  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(TARGET_EDGE, TARGET_EDGE)
    : Object.assign(document.createElement('canvas'), { width: TARGET_EDGE, height: TARGET_EDGE })

  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, sx, sy, srcSize, srcSize, 0, 0, TARGET_EDGE, TARGET_EDGE)
  bitmap.close?.()

  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY })
    : await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY))

  if (!blob) throw new Error('Failed to encode image')
  return { blob, width: TARGET_EDGE, height: TARGET_EDGE }
}
