const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
})

export interface StudyFileItem {
  id: string
  file: File
  isPdf: boolean
  thumbUrl: string | null
}

export function isPdfStudyFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return mime === 'application/pdf' || name.endsWith('.pdf')
}

export function isAllowedStudyFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || ''
  return (
    ['pdf', 'jpg', 'jpeg', 'png'].includes(ext) ||
    ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(mime)
  )
}

export function sortFilesNatural(files: File[], direction: 'asc' | 'desc' = 'asc'): File[] {
  const sorted = [...files].sort((a, b) => NATURAL_COLLATOR.compare(a.name, b.name))
  return direction === 'desc' ? sorted.reverse() : sorted
}

export function sortStudyItemsNatural(
  items: StudyFileItem[],
  direction: 'asc' | 'desc' = 'asc'
): StudyFileItem[] {
  const sorted = [...items].sort((a, b) => NATURAL_COLLATOR.compare(a.file.name, b.file.name))
  return direction === 'desc' ? sorted.reverse() : sorted
}

export async function generateStudyThumbnailUrl(
  file: File,
  maxDim = 280
): Promise<string | null> {
  if (isPdfStudyFile(file)) return null

  let bitmap: ImageBitmap | null = null
  const canvas = document.createElement('canvas')
  try {
    try {
      bitmap = await createImageBitmap(file, {
        resizeWidth: maxDim,
        resizeQuality: 'low'
      })
    } catch {
      bitmap = await createImageBitmap(file)
    }

    const scale = Math.min(1, maxDim / Math.max(bitmap.width || 1, bitmap.height || 1))
    const width = Math.max(1, Math.round((bitmap.width || maxDim) * scale))
    const height = Math.max(1, Math.round((bitmap.height || maxDim) * scale))

    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75)
    )
    if (!blob) return null
    return URL.createObjectURL(blob)
  } catch {
    return null
  } finally {
    bitmap?.close()
    canvas.width = 0
    canvas.height = 0
  }
}

export async function generateThumbnailsInQueue(
  items: StudyFileItem[],
  onThumbReady: (id: string, thumbUrl: string) => void,
  isCancelled?: () => boolean
): Promise<void> {
  const pending = items.filter((item) => !item.isPdf && !item.thumbUrl)
  if (pending.length === 0) return

  let nextIdx = 0
  const concurrency = Math.min(2, pending.length)

  const worker = async () => {
    while (true) {
      if (isCancelled?.()) break
      const idx = nextIdx++
      if (idx >= pending.length) break
      const item = pending[idx]
      const url = await generateStudyThumbnailUrl(item.file)
      if (!url) continue
      if (isCancelled?.()) {
        URL.revokeObjectURL(url)
        break
      }
      onThumbReady(item.id, url)
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}
