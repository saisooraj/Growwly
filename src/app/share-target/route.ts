import { NextRequest, NextResponse } from 'next/server'
import { SHARE_DB_NAME, SHARE_STORE, SHARE_KEY } from '@/lib/shareTargetDb'

// Vercel serverless functions cap response body size (~4.5MB on Hobby/Pro) — the
// shared image is inlined as base64 in this response's HTML, so it's capped well
// under that ceiling. Camera/file-picker uploads inside the app aren't affected,
// since those never round-trip through a server function.
const MAX_SHARE_SIZE = 3_000_000

function failRedirect(req: NextRequest) {
  return NextResponse.redirect(new URL('/transactions?scan=share-failed', req.url), 303)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('images')

    if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > MAX_SHARE_SIZE) {
      return failRedirect(req)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const html = buildHandoffHtml(buffer.toString('base64'), file.type)
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch {
    return failRedirect(req)
  }
}

function buildHandoffHtml(base64: string, mime: string): string {
  const dbName = JSON.stringify(SHARE_DB_NAME)
  const storeName = JSON.stringify(SHARE_STORE)
  const key = JSON.stringify(SHARE_KEY)
  const mimeJson = JSON.stringify(mime)
  const dataJson = JSON.stringify(base64)

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><title>Growwly</title></head>
<body>
<script>
(function () {
  function b64ToBlob(b64, mime) {
    var binary = atob(b64)
    var bytes = new Uint8Array(binary.length)
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }

  function fail() { location.replace('/transactions?scan=share-failed') }

  try {
    var blob = b64ToBlob(${dataJson}, ${mimeJson})
    var openReq = indexedDB.open(${dbName}, 1)
    openReq.onupgradeneeded = function () { openReq.result.createObjectStore(${storeName}) }
    openReq.onsuccess = function () {
      var db = openReq.result
      var tx = db.transaction(${storeName}, 'readwrite')
      tx.objectStore(${storeName}).put({ blob: blob, mime: ${mimeJson} }, ${key})
      tx.oncomplete = function () { location.replace('/transactions?scan=shared') }
      tx.onerror = fail
    }
    openReq.onerror = fail
  } catch (e) {
    fail()
  }
})()
</script>
</body>
</html>`
}
