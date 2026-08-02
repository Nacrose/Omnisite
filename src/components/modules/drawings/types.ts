/**
 * Drawings module — shared types.
 *
 * `Dwg` is the shape of a row in the `drawings` table (also used by the
 * static seed array in `index.tsx`). The new file-type / file-url /
 * source-file-url / file-size columns are optional so existing seed
 * rows (which don't have a file attached) keep compiling.
 *
 * `DrawingAnnotation` mirrors the `drawing_annotations` table — one row
 * per Fabric.js markup object drawn on top of a PDF page. The original
 * PDF file is NEVER modified; markups are stored as separate JSON rows
 * keyed by `drawingId` + `pageNumber`.
 */

export type DrawingFileType = 'pdf' | 'dwg' | 'dxf' | 'zip' | 'rar' | 'image'

export type AnnotationType = 'freehand' | 'rectangle' | 'text' | 'stamp' | 'arrow' | 'circle'

export type StampType = 'approved' | 'rejected' | 'revision' | 'review'

export interface DrawingAnnotation {
  id: string
  drawingId: string
  pageNumber: number
  authorId: string
  authorName: string
  type: AnnotationType
  color: string
  strokeWidth: number
  /** Fabric.js serialized object (full object graph). */
  fabricData: unknown
  /** Text content for text/stamp annotations (so the list view can preview). */
  textContent?: string
  /** Position on page (normalized 0–1 coordinates so they scale with zoom). */
  x: number
  y: number
  width?: number
  height?: number
  createdAt: string
  updatedAt: string
}

/**
 * Shape of a row in the `drawings` table. The file-related columns
 * (fileType, fileUrl, sourceFileUrl, fileSize) were added in migration
 * 00000000000013. Older seed rows omit them — the helpers in this module
 * treat them as optional and fall back to the legacy SVG placeholder
 * viewer when no fileUrl is set.
 */
export interface Dwg {
  id: string
  number: string
  title: string
  revision: string
  date: string
  status: 'Approved for Construction' | 'Pending' | 'Superseded' | 'Rejected'
  size: string
  discipline: string
  links: { type: string; ref: string }[]
  history: { rev: string; date: string; note: string }[]
  /** File type discriminator — drives viewer routing. */
  fileType?: DrawingFileType
  /** For PDFs: the URL the viewer renders. */
  fileUrl?: string
  /** For DWG/DXF/ZIP/RAR: the download URL of the source file. */
  sourceFileUrl?: string
  /** File size in bytes (surfaced in the download card). */
  fileSize?: number
  /** Optional project_locations FK (work-face tie). */
  locationId?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** MIME types accepted by the upload handler. */
export const DRAWING_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  // DWG/DXF have no universally-recognized MIME type — accept by extension.
  // The upload handler also accepts these as pseudo-types from the input element.
  'image/vnd.dwg',
  'image/vnd.dxf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-rar',
] as const

/** File extensions accepted by the upload handler. */
export const DRAWING_ALLOWED_EXTS = [
  '.pdf',
  '.dwg',
  '.dxf',
  '.zip',
  '.rar',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const

/** accept attribute for the file input. */
export const DRAWING_ACCEPT_ATTR = '.pdf,.dwg,.dxf,.zip,.rar,.png,.jpg,.jpeg,.webp'

/**
 * Detect the drawing file type from a File's name + MIME. Returns 'image'
 * for PNG/JPEG/WebP (which the upload handler still stores in the drawings
 * bucket but the viewer treats like a PDF for markup purposes).
 */
export function detectDrawingFileType(file: File): DrawingFileType | null {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (name.endsWith('.dwg')) return 'dwg'
  if (name.endsWith('.dxf')) return 'dxf'
  if (name.endsWith('.zip')) return 'zip'
  if (name.endsWith('.rar')) return 'rar'
  if (
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  ) {
    return 'image'
  }
  return null
}

/** True for file types that get the full in-browser viewer + markup overlay. */
export function isViewerSupported(fileType?: DrawingFileType): boolean {
  return fileType === 'pdf' || fileType === 'image'
}

/** Human-readable label for non-viewer file types (DWG/DXF/ZIP/RAR). */
export function fileTypeLabel(fileType?: DrawingFileType): string {
  switch (fileType) {
    case 'pdf':
      return 'PDF'
    case 'dwg':
      return 'DWG'
    case 'dxf':
      return 'DXF'
    case 'zip':
      return 'ZIP archive'
    case 'rar':
      return 'RAR archive'
    case 'image':
      return 'Image'
    default:
      return 'Unknown'
  }
}

/** Format a byte count as a human-readable string (1.2 MB, 340 KB, …). */
export function formatFileSize(bytes?: number): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
