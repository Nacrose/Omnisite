import { headers } from 'next/headers'
import WorkspaceShellRoot from './workspace-shell'

// Force dynamic rendering so the per-request CSP nonce (generated in
// proxy.ts and passed via the `x-nonce` request header) is available
// when the page is server-rendered. Without this, the workspace pages
// are statically prerendered at BUILD time — the nonce didn't exist yet,
// so the inline RSC scripts have no nonce attribute, and the CSP header
// (which requires the nonce) blocks them. The page hangs on
// "Loading workspace…" because React never hydrates.
//
// The workspace pages are all client-component-heavy (dashboard, BOQ,
// scheduler, etc.) and can't be meaningfully prerendered anyway — they
// need the auth context + project store from localStorage/Supabase.
// The login page (outside this group) is still statically rendered.
export const dynamic = 'force-dynamic'

// Also set revalidate to 0 to ensure no caching at the route level.
export const revalidate = 0

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  // Read the nonce from the request headers. Next.js 16 automatically
  // injects this nonce into all inline script tags (RSC payload, hydration
  // data) when it's read via headers() in a server component. We MUST
  // actually read the value (not just call headers()) so Next.js detects
  // the dynamic header usage and triggers the nonce injection.
  const nonce = (await headers()).get('x-nonce')
  if (!nonce) {
    // This should never happen — the proxy always sets x-nonce. If it does,
    // the CSP will block scripts and the page won't hydrate. Log to stderr
    // so the issue is visible in server logs.
    console.error('[layout] x-nonce header missing — CSP will block scripts')
  }
  return <WorkspaceShellRoot>{children}</WorkspaceShellRoot>
}
