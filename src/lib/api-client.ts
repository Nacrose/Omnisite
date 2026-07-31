/**
 * API Client — typed fetch wrapper for OmniSite's REST API routes.
 *
 * All modules that need to persist data go through this client instead of
 * talking to Supabase directly from the browser. The corresponding
 * `/api/{endpoint}` route handler performs the actual database write
 * server-side, where it can run server-side validation, audit logging, and
 * RLS-safe queries using the service-role key.
 *
 * Design constraints:
 *   - Pure HTTP — does NOT import or depend on the Supabase browser client.
 *   - Relative URLs only (e.g. `/api/boq`) — works behind the Caddy gateway
 *     and on Vercel without any origin configuration.
 *   - Typed: each method is generic so callers get back the shape they expect.
 *   - Throws `ApiClientError` on any non-2xx response, with the server-provided
 *     error message when available.
 */

/** Error thrown by the API client when a request fails. */
export class ApiClientError extends Error {
  /** HTTP status code returned by the server (0 for network errors). */
  readonly status: number
  /** The endpoint (without `/api/` prefix) that was called. */
  readonly endpoint: string

  constructor(message: string, status: number, endpoint: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.endpoint = endpoint
    // Restore the prototype chain (Error subclassing quirk under ES5 targets)
    Object.setPrototypeOf(this, ApiClientError.prototype)
  }
}

/** Extract a human-readable error message from a failed Response. */
async function readError(res: Response, endpoint: string): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body.error === 'string') return body.error
    if (typeof body === 'string') return body
    if (body && typeof body.message === 'string') return body.message
  } catch {
    /* response had no JSON body — fall through to status text */
  }
  return `HTTP ${res.status} ${res.statusText} — ${endpoint}`
}

/** Build a relative `/api/{endpoint}` URL with optional query params. */
function buildUrl(endpoint: string, query?: Record<string, string>): string {
  // Allow callers to pass either `boq` or `/api/boq` — both work.
  const base = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint}`
  if (!query) return base
  const qs = new URLSearchParams(query).toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Fetch all rows from `GET /api/{endpoint}`.
 *
 * @example
 *   const items = await fetchAll<BoqItem>('boq')
 *
 * @returns The parsed array. Returns `[]` if the server returned `null` /
 *          `undefined` (e.g. an empty table). Never returns `null`.
 */
export async function fetchAll<T>(endpoint: string): Promise<T[]> {
  const url = buildUrl(endpoint)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (e) {
    // Network error — DNS failure, offline, CORS, etc.
    throw new ApiClientError(
      `Network error fetching ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint,
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  const data = await res.json()
  // Supabase returns `null` for empty selects; normalize to `[]`.
  return Array.isArray(data) ? (data as T[]) : (data ? [data as T] : [])
}

/**
 * Upsert a single row via `POST /api/{endpoint}`.
 *
 * The route handler runs `supabase.from(table).upsert(body).select()` and
 * returns the resulting row(s) as a JSON array. This helper unwraps the
 * array and returns the first row, which corresponds to the upserted item.
 *
 * @example
 *   const saved = await upsertOne<BoqItem>('boq', boqRow)
 *
 * @returns The upserted row returned by the server, or `undefined` if the
 *          server returned an empty array.
 */
export async function upsertOne<T>(endpoint: string, item: T): Promise<T | undefined> {
  const url = buildUrl(endpoint)
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(item),
    })
  } catch (e) {
    throw new ApiClientError(
      `Network error upserting ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint,
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  const data = await res.json()
  if (Array.isArray(data)) return data[0] as T | undefined
  return data as T | undefined
}

/**
 * Delete a single row via `DELETE /api/{endpoint}?id={id}`.
 *
 * @example
 *   await deleteOne('boq', 'B-001')
 *
 * Resolves with `undefined` on success; throws `ApiClientError` on failure.
 */
export async function deleteOne(endpoint: string, id: string): Promise<void> {
  const url = buildUrl(endpoint, { id })
  let res: Response
  try {
    res = await fetch(url, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
  } catch (e) {
    throw new ApiClientError(
      `Network error deleting ${endpoint}:${id}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint,
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  // Drain the body so the underlying connection can be reused.
  try {
    await res.json()
  } catch {
    /* server may return empty body on DELETE — ignore */
  }
}
