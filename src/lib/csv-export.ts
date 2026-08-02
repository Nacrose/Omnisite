/**
 * CSV export utility — generates a CSV string and triggers a browser download.
 * No external dependencies — pure string manipulation.
 *
 * `preamble` is an optional list of full lines (already-formatted, NOT escaped)
 * written verbatim at the very top of the file, BEFORE the header row. Use this
 * for human-readable notes / caveats (e.g. "# NOTE: ..."). Lines starting with
 * `#` are safe — Excel treats them as plain text rows and most CSV consumers
 * skip them.
 */

export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  preamble?: string[]
) {
  // Escape values: wrap in quotes if they contain commas, quotes, or newlines
  const escape = (val: string | number): string => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines = [
    ...(preamble ?? []),
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ]
  const csv = lines.join('\n')

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
