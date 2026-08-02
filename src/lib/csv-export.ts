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
  // Escape values: wrap in quotes if they contain commas, quotes, or newlines.
  // Also mitigate CSV injection — Excel and Sheets will execute formulas in
  // cells starting with =, +, -, or @ when the file is opened. Prefixing a
  // single quote forces the cell to be treated as text. See OWASP CSV
  // Injection guidance. The leading-quote is harmless for plain-text cells
  // because Excel hides it in the rendered value.
  const escape = (val: string | number): string => {
    const s = String(val ?? '')
    // Mitigate CSV injection: prefix dangerous leading characters so the
    // cell is interpreted as text rather than a formula by Excel / Sheets.
    const dangerous = /^[=+\-@]/
    const sanitized = dangerous.test(s) ? `'${s}` : s
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n')) {
      return `"${sanitized.replace(/"/g, '""')}"`
    }
    return sanitized
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
