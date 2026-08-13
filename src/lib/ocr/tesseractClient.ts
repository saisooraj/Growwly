import type { Worker } from 'tesseract.js'

let activeWorker: Worker | null = null

export async function recognizeReceipt(image: Blob, onProgress: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/tesseract-core-simd-lstm.wasm.js',
    logger: m => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') onProgress(m.progress)
    },
  })
  activeWorker = worker
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
    activeWorker = null
  }
}

export async function terminateOcrWorker(): Promise<void> {
  if (activeWorker) {
    const w = activeWorker
    activeWorker = null
    await w.terminate()
  }
}
