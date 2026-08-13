const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'public', 'tesseract')
fs.mkdirSync(outDir, { recursive: true })

const files = [
  { from: path.join(__dirname, '..', 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), to: path.join(outDir, 'worker.min.js') },
  { from: path.join(__dirname, '..', 'node_modules', 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), to: path.join(outDir, 'tesseract-core-simd-lstm.wasm.js') },
]

for (const { from, to } of files) {
  if (!fs.existsSync(from)) {
    console.warn(`[copyTesseractAssets] missing source file, skipping: ${from}`)
    continue
  }
  fs.copyFileSync(from, to)
}
