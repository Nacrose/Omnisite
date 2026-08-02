/**
 * API Client — typed fetch wrapper for OmniSite's REST API routes.
 *
 * All modules that need to persist data go through this client instead of
 * talking to Supabase directly from the browser. The corresponding
 * `/api/{endpoint}` route handler performs the actual database write
 * server-side, where it can run server-side validation, audit logging, and
 * RLS-safe queries using the user's session token.
 *
 * Design constraints:
 *   - Pure HTTP — does NOT import or depend on the Supabase browser client.
 *   - Relative URLs only (e.g. `/api/boq`) — works behind the Caddy gateway
 *     and on Vercel without any origin configuration.
 *   - Typed: each method is generic so callers get back the shape they expect.
 *   - Throws `ApiClientError` on any non-2xx response, with the server-provided
 *     error message when available.
 *   - Automatically includes the Supabase access token as a Bearer header
 *     so the server can verify the session and enforce RLS.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'

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

/**
 * Get the Authorization header for the current session.
 * Returns an empty object if Supabase is not configured (demo mode).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured() || !supabase) return {}
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` }
    }
  } catch {
    // Session lookup failed — proceed without auth header (server will 401).
  }
  return {}
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
export function buildApiUrl(endpoint: string, query?: Record<string, string>): string {
  // Allow callers to pass either `boq` or `/api/boq` — both work.
  const base = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint}`
  if (!query) return base
  const qs = new URLSearchParams(query).toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * In-flight GET request cache. Keyed by full URL string.
 *
 * When `fetchPaginated` is called and there's already a Promise for the
 * same URL in flight, the existing Promise is returned instead of firing
 * a new fetch — so two components mounting at the same time that ask for
 * the same data only produce one network request.
 *
 * Entries are cleared when the promise settles (success OR failure) so
 * the cache only holds truly-concurrent requests, not stale snapshots.
 *
 * Writes ({@link upsertOne}, {@link deleteOne}) call
 * {@link invalidateReads} to drop any in-flight reads for that endpoint
 * so the next read sees the new write instead of returning a pre-write
 * snapshot.
 */
const inflightReads = new Map<string, Promise<unknown>>()

/**
 * Drop all in-flight GET requests whose URL targets the given endpoint.
 * Called after writes so the next read fires a fresh fetch instead of
 * returning a stale pre-write snapshot (or joining an in-flight pre-write
 * read).
 *
 * @param endpoint  Either `boq` or `/api/boq` — both work.
 */
export function invalidateReads(endpoint: string): void {
  const prefix = endpoint.startsWith('/api/') ? endpoint : `/api/${endpoint}`
  for (const url of inflightReads.keys()) {
    // Match either exactly `/api/{endpoint}` or `/api/{endpoint}?...`
    if (url === prefix || url.startsWith(`${prefix}?`)) {
      inflightReads.delete(url)
    }
  }
}

/**
 * Fetch all rows from `GET /api/{endpoint}`.
 *
 * Supports optional pagination via `query.limit` and `query.cursor`.
 * The server returns `{ data: [...], nextCursor: string | null }` when
 * pagination params are present, or a plain array when they're not.
 *
 * Note: this function flattens the response into a plain array, discarding
 * the `nextCursor` returned by the server. For paginated requests where you
 * need to drive a cursor loop, use {@link fetchPaginated} instead.
 *
 * @example
 *   const items = await fetchAll<BoqItem>('boq')
 *   const page = await fetchAll<BoqItem>('boq', { project_id: '...', limit: '200', cursor: '...' })
 *
 * For paginated requests, use fetchPaginated() instead.
 */
export async function fetchAll<T>(endpoint: string, query?: Record<string, string>): Promise<T[]> {
  const url = buildApiUrl(endpoint, query)
  const authHeaders = await getAuthHeaders()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders },
      cache: 'no-store',
    })
  } catch (e) {
    throw new ApiClientError(
      `Network error fetching ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  const data = await res.json()
  // Support both plain array (no pagination) and { data, nextCursor } (paginated)
  if (Array.isArray(data)) return data as T[]
  if (data && Array.isArray(data.data)) return data.data as T[]
  return data ? [data as T] : []
}

/**
 * Fetch a single page from `GET /api/{endpoint}` and return both the rows
 * and the cursor for the next page.
 *
 * Unlike {@link fetchAll} (which flattens paginated responses into a plain
 * array and discards the cursor), this function preserves `nextCursor` so
 * callers can drive an explicit cursor loop until `nextCursor === null`.
 *
 * The server response is normalized to `{ data, nextCursor }` regardless of
 * whether the server returned a plain array (no pagination) or an explicit
 * `{ data, nextCursor }` envelope.
 *
 * @example
 *   let cursor: string | null = null
 *   do {
 *     const { data, nextCursor } = await fetchPaginated<BoqItem>('boq', {
 *       project_id: '...', limit: '200', cursor: cursor ?? undefined,
 *     })
 *     allRows.push(...data)
 *     cursor = nextCursor
 *   } while (cursor)
 */
export async function fetchPaginated<T>(
  endpoint: string,
  query?: Record<string, string>
): Promise<{ data: T[]; nextCursor: string | null }> {
  const url = buildApiUrl(endpoint, query)

  // Deduplicate concurrent reads for the same URL — two components
  // mounting at the same time and asking for the same data share one
  // network request. The cache entry is removed when the promise settles
  // so subsequent reads always fire a fresh fetch.
  const existing = inflightReads.get(url) as
    Promise<{ data: T[]; nextCursor: string | null }> | undefined
  if (existing) return existing

  const promise = (async () => {
    const authHeaders = await getAuthHeaders()
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders },
      cache: 'no-store',
    })
    if (!res.ok) throw new ApiClientError(await readError(res, endpoint), res.status, endpoint)
    const json = await res.json()
    if (Array.isArray(json)) return { data: json as T[], nextCursor: null }
    if (json && Array.isArray(json.data))
      return { data: json.data as T[], nextCursor: json.nextCursor ?? null }
    return { data: json ? [json as T] : [], nextCursor: null }
  })()

  inflightReads.set(url, promise)
  // Clear the entry once the promise settles. We compare against the
  // captured `promise` reference in case `invalidateReads` already removed
  // the entry between settle-time and the microtask firing.
  void promise.finally(() => {
    if (inflightReads.get(url) === promise) inflightReads.delete(url)
  })
  return promise
}

/**
 * Upsert a single row via `POST /api/{endpoint}`.
 *
 * @example
 *   const saved = await upsertOne<BoqItem>('boq', boqRow)
 *
 * @returns The upserted row returned by the server, or `undefined` if the
 *          server returned an empty array.
 */
export async function upsertOne<T>(endpoint: string, item: T): Promise<T | undefined> {
  const url = buildApiUrl(endpoint)
  const authHeaders = await getAuthHeaders()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(item),
    })
  } catch (e) {
    throw new ApiClientError(
      `Network error upserting ${endpoint}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  const data = await res.json()
  // Drop any in-flight reads for this endpoint so the next GET fires a
  // fresh fetch reflecting the just-committed write.
  invalidateReads(endpoint)
  if (Array.isArray(data)) return data[0] as T | undefined
  return data as T | undefined
}

/**
 * Delete a single row via `DELETE /api/{endpoint}?id={id}`.
 *
 * @example
 *   await deleteOne('boq', 'B-001')
 */
export async function deleteOne(endpoint: string, id: string): Promise<void> {
  const url = buildApiUrl(endpoint, { id })
  const authHeaders = await getAuthHeaders()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'DELETE',
      headers: { Accept: 'application/json', ...authHeaders },
    })
  } catch (e) {
    throw new ApiClientError(
      `Network error deleting ${endpoint}:${id}: ${e instanceof Error ? e.message : String(e)}`,
      0,
      endpoint
    )
  }
  if (!res.ok) {
    const message = await readError(res, endpoint)
    throw new ApiClientError(message, res.status, endpoint)
  }
  try {
    await res.json()
  } catch {
    /* server may return empty body on DELETE — ignore */
  }
  // Drop any in-flight reads for this endpoint so the next GET reflects
  // the deletion rather than serving a cached pre-delete snapshot.
  invalidateReads(endpoint)
}
