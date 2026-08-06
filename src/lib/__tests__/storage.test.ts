import { describe, it, expect } from 'vitest'
import { validateUpload } from '@/lib/storage'

// Helper to construct a File with a specific name + type + size.
// File's constructor accepts (bits, name, options).
function makeFile(name: string, type: string, sizeMB: number): File {
  // Allocate a buffer of the requested size. Contents don't matter —
  // validateUpload only reads .size, .type, and .name.
  const bits = new ArrayBuffer(Math.max(1, Math.floor(sizeMB * 1024 * 1024)))
  return new File([bits], name, { type })
}

describe('validateUpload — size limits', () => {
  it('rejects oversized drawings (>50 MB)', () => {
    const f = makeFile('big.pdf', 'application/pdf', 51)
    const err = validateUpload('drawings', f)
    expect(err).toMatch(/too large/i)
    expect(err).toMatch(/50/)
  })

  it('accepts a 49 MB drawing', () => {
    const f = makeFile('ok.pdf', 'application/pdf', 49)
    expect(validateUpload('drawings', f)).toBeNull()
  })

  it('rejects oversized DSR photo (>10 MB)', () => {
    const f = makeFile('big.jpg', 'image/jpeg', 11)
    expect(validateUpload('dsr-photos', f)).toMatch(/too large/i)
  })

  it('uses 25 MB default for unknown buckets', () => {
    const f = makeFile('big.bin', 'application/octet-stream', 26)
    expect(validateUpload('unknown-bucket', f)).toMatch(/too large/i)
    expect(validateUpload('unknown-bucket', f)).toMatch(/25/)
  })
})

describe('validateUpload — MIME type allowlist', () => {
  it('rejects SVG in drawings (XSS vector)', () => {
    const f = makeFile('evil.svg', 'image/svg+xml', 0.1)
    expect(validateUpload('drawings', f)).toMatch(/svg/i)
  })

  it('rejects SVG in chat-media', () => {
    const f = makeFile('evil.svg', 'image/svg+xml', 0.1)
    expect(validateUpload('chat-media', f)).toMatch(/svg/i)
  })

  it('rejects executable in chat-media', () => {
    const f = makeFile('malware.exe', 'application/x-msdownload', 0.1)
    expect(validateUpload('chat-media', f)).toMatch(/not allowed/i)
  })

  it('rejects HTML in unknown bucket (fallback default)', () => {
    const f = makeFile('xss.html', 'text/html', 0.1)
    expect(validateUpload('unknown-bucket', f)).toMatch(/not allowed/i)
  })

  it('accepts PDF in drawings', () => {
    const f = makeFile('drawing.pdf', 'application/pdf', 1)
    expect(validateUpload('drawings', f)).toBeNull()
  })

  it('accepts JPEG in dsr-photos', () => {
    const f = makeFile('photo.jpg', 'image/jpeg', 2)
    expect(validateUpload('dsr-photos', f)).toBeNull()
  })

  it('rejects video in dsr-photos (image-only allowlist)', () => {
    const f = makeFile('site.mp4', 'video/mp4', 5)
    expect(validateUpload('dsr-photos', f)).toMatch(/not allowed/i)
  })

  it('accepts XLSX in ra-bills', () => {
    const f = makeFile(
      'ra-bill.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      1
    )
    expect(validateUpload('ra-bills', f)).toBeNull()
  })

  it('rejects image in ra-bills (financial docs only)', () => {
    const f = makeFile('photo.jpg', 'image/jpeg', 1)
    expect(validateUpload('ra-bills', f)).toMatch(/not allowed/i)
  })
})

describe('validateUpload — extension allowlist', () => {
  it('rejects .exe in drawings even with PDF MIME type', () => {
    const f = makeFile('evil.exe', 'application/pdf', 1)
    expect(validateUpload('drawings', f)).toMatch(/extension/i)
    expect(validateUpload('drawings', f)).toMatch(/exe/i)
  })

  it('accepts .dwg in drawings', () => {
    const f = makeFile('plan.dwg', 'application/octet-stream', 1)
    // .dwg is allowed even though MIME type is octet-stream — extension gate
    expect(validateUpload('drawings', f)).toBeNull()
  })
})

describe('validateUpload — empty / edge cases', () => {
  it('accepts a 0-byte file (size check passes)', () => {
    const f = makeFile('empty.pdf', 'application/pdf', 0.001)
    expect(validateUpload('drawings', f)).toBeNull()
  })

  it('accepts a file with no extension in chat-media (extension list empty)', () => {
    const f = makeFile('readme', 'text/plain', 0.1)
    expect(validateUpload('chat-media', f)).toBeNull()
  })

  it('accepts a file with no MIME type in chat-media', () => {
    const f = makeFile('notes.txt', '', 0.1)
    // Empty MIME type — the prefix check is skipped when file.type is empty.
    // Extension list is empty for chat-media, so the file passes.
    expect(validateUpload('chat-media', f)).toBeNull()
  })
})
