/**
 * Pre-optimizador de imágenes en el navegador para estudios oftalmológicos.
 * - Mantiene los File originales intactos en el estado de React.
 * - Procesa con concurrencia acotada (2 imágenes simultáneas) y liberación explícita de ImageBitmap/Canvas.
 * - Aplica presupuesto determinista por página para garantizar <= 18 MiB antes de enviar al backend (tope Geclisa: 20 MiB).
 * - Soporta composición opcional de grilla comparativa 2x2 en Canvas para secuencias largas (ej. RFG).
 */

export interface OptimizeProgressCallback {
  (completed: number, total: number, phase: string): void
}

export interface OptimizeStudyResult {
  files: File[]
  rawBytes: number
  optimizedBytes: number
  exceedsLimit: boolean
}

const MAX_SAFE_UPLOAD_BYTES = Math.floor(18.5 * 1024 * 1024)
const BUDGET_POOL_BYTES = 18 * 1024 * 1024 - 150_000
const SINGLE_IMG_META_CAP_BYTES = 4 * 1024 * 1024
const MIN_DIM_FLOOR = 1000
const MIN_QUALITY_FLOOR = 0.65

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)
}

function getAdaptivePreset(count: number, unificarEnPdf: boolean): { maxDim: number; quality: number } {
  if (count === 1 && !unificarEnPdf) {
    return { maxDim: 2048, quality: 0.85 }
  }
  if (count <= 4) {
    return { maxDim: 2200, quality: 0.86 }
  }
  if (count <= 15) {
    return { maxDim: 1800, quality: 0.84 }
  }
  return { maxDim: 1600, quality: 0.80 }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      quality
    )
  })
}

async function encodeImageWithinBudget(
  file: File,
  initialMaxDim: number,
  initialQuality: number,
  byteBudget: number
): Promise<File> {
  if (typeof window === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file
  }

  let bitmap: ImageBitmap | null = null
  const canvas = document.createElement('canvas')
  try {
    bitmap = await createImageBitmap(file)
    const origW = bitmap.width
    const origH = bitmap.height

    let targetDim = initialMaxDim
    let targetQuality = initialQuality
    let bestBlob: Blob | null = null

    for (let attempt = 0; attempt < 3; attempt++) {
      const longest = Math.max(origW, origH)
      const scale = longest > targetDim ? targetDim / longest : 1
      const w = Math.max(1, Math.round(origW * scale))
      const h = Math.max(1, Math.round(origH * scale))

      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) break

      // Fondo blanco para aplanar transparencias de archivos PNG
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(bitmap, 0, 0, w, h)

      const blob = await canvasToJpegBlob(canvas, targetQuality)
      if (!blob) break
      bestBlob = blob

      if (blob.size <= byteBudget) {
        break
      }

      if (attempt === 0) {
        targetQuality = Math.max(MIN_QUALITY_FLOOR, Number((targetQuality - 0.10).toFixed(2)))
      } else {
        targetDim = Math.max(MIN_DIM_FLOOR, Math.round(targetDim * 0.80))
        targetQuality = Math.max(MIN_QUALITY_FLOOR, Number((targetQuality - 0.05).toFixed(2)))
      }
    }

    if (!bestBlob) return file

    // Si la imagen original ya era JPEG liviana y la re-compresión resultó más pesada, conservar original
    const isAlreadyJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
    if (isAlreadyJpeg && file.size <= byteBudget && bestBlob.size >= file.size && Math.max(origW, origH) <= initialMaxDim) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([bestBlob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified
    })
  } catch {
    return file
  } finally {
    if (bitmap) {
      try {
        bitmap.close()
      } catch {
        // noop
      }
    }
    canvas.width = 0
    canvas.height = 0
  }
}

async function composeGrid2x2Sheet(
  chunkFiles: File[],
  startIndex: number,
  sheetNumber: number,
  byteBudget: number
): Promise<File> {
  const SHEET_W = 1920
  const SHEET_H = 1358
  const MARGIN = 24
  const GUTTER = 16
  const CELL_W = Math.floor((SHEET_W - MARGIN * 2 - GUTTER) / 2) // 928
  const CELL_H = Math.floor((SHEET_H - MARGIN * 2 - GUTTER) / 2) // 647

  const canvas = document.createElement('canvas')
  try {
    canvas.width = SHEET_W
    canvas.height = SHEET_H
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('No se pudo inicializar contexto 2D para grilla 2x2')
    }

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, SHEET_W, SHEET_H)

    for (let i = 0; i < chunkFiles.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cellX = MARGIN + col * (CELL_W + GUTTER)
      const cellY = MARGIN + row * (CELL_H + GUTTER)

      let bitmap: ImageBitmap | null = null
      try {
        bitmap = await createImageBitmap(chunkFiles[i])
        const scale = Math.min(CELL_W / bitmap.width, CELL_H / bitmap.height)
        const drawW = Math.max(1, Math.round(bitmap.width * scale))
        const drawH = Math.max(1, Math.round(bitmap.height * scale))
        const drawX = cellX + Math.floor((CELL_W - drawW) / 2)
        const drawY = cellY + Math.floor((CELL_H - drawH) / 2)

        ctx.fillStyle = '#F8FAFC'
        ctx.fillRect(cellX, cellY, CELL_W, CELL_H)
        ctx.drawImage(bitmap, drawX, drawY, drawW, drawH)

        ctx.strokeStyle = '#CBD5E1'
        ctx.lineWidth = 2
        ctx.strokeRect(cellX, cellY, CELL_W, CELL_H)

        // Etiqueta discreta con número de toma
        const label = `#${startIndex + i + 1}`
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
        ctx.fillRect(cellX + 8, cellY + 8, 48, 26)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 15px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, cellX + 32, cellY + 21)
      } finally {
        if (bitmap) {
          try {
            bitmap.close()
          } catch {
            // noop
          }
        }
      }
    }

    let bestBlob: Blob | null = null
    for (const q of [0.84, 0.74, 0.65]) {
      const blob = await canvasToJpegBlob(canvas, q)
      if (!blob) break
      bestBlob = blob
      if (blob.size <= byteBudget) break
    }

    if (!bestBlob) {
      throw new Error('No se pudo codificar hoja 2x2')
    }

    return new File([bestBlob], `grilla_2x2_hoja_${sheetNumber}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now()
    })
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export async function optimizeStudyFilesForUpload(
  files: File[],
  options: {
    unificarEnPdf: boolean
    grilla2x2: boolean
    onProgress?: OptimizeProgressCallback
  }
): Promise<OptimizeStudyResult> {
  const rawBytes = files.reduce((acc, f) => acc + f.size, 0)
  if (files.length === 0) {
    return { files: [], rawBytes: 0, optimizedBytes: 0, exceedsLimit: false }
  }

  const allImages = files.every(isImageFile)
  if (!allImages) {
    return {
      files,
      rawBytes,
      optimizedBytes: rawBytes,
      exceedsLimit: rawBytes > MAX_SAFE_UPLOAD_BYTES
    }
  }

  // Modo Grilla Comparativa 2x2 (4 tomas por hoja JPEG en el navegador)
  if (options.grilla2x2 && files.length > 1) {
    const totalSheets = Math.ceil(files.length / 4)
    const budgetPerSheet = Math.max(120_000, Math.floor(BUDGET_POOL_BYTES / totalSheets))
    const composedSheets: File[] = []

    for (let s = 0; s < totalSheets; s++) {
      const startIdx = s * 4
      const chunk = files.slice(startIdx, startIdx + 4)
      options.onProgress?.(s + 1, totalSheets, 'Armando grilla 2×2')
      const sheetFile = await composeGrid2x2Sheet(chunk, startIdx, s + 1, budgetPerSheet)
      composedSheets.push(sheetFile)
    }

    const optimizedBytes = composedSheets.reduce((acc, f) => acc + f.size, 0)
    return {
      files: composedSheets,
      rawBytes,
      optimizedBytes,
      exceedsLimit: optimizedBytes > MAX_SAFE_UPLOAD_BYTES
    }
  }

  // Modo estándar (1 imagen por página o imagen suelta) con cola de concurrencia = 2
  const preset = getAdaptivePreset(files.length, options.unificarEnPdf)
  const rawBudget = Math.floor(BUDGET_POOL_BYTES / files.length)
  const byteBudget =
    files.length === 1 && !options.unificarEnPdf
      ? Math.min(rawBudget, SINGLE_IMG_META_CAP_BYTES)
      : Math.max(80_000, rawBudget)

  const results: File[] = new Array(files.length)
  let nextIndex = 0
  let completed = 0
  const concurrency = Math.min(2, files.length)

  const worker = async () => {
    while (true) {
      const idx = nextIndex++
      if (idx >= files.length) break
      results[idx] = await encodeImageWithinBudget(
        files[idx],
        preset.maxDim,
        preset.quality,
        byteBudget
      )
      completed++
      options.onProgress?.(completed, files.length, 'Optimizando imágenes')
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const optimizedBytes = results.reduce((acc, f) => acc + f.size, 0)
  return {
    files: results,
    rawBytes,
    optimizedBytes,
    exceedsLimit: optimizedBytes > MAX_SAFE_UPLOAD_BYTES
  }
}
