import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

// The root path redirects to /dashboard (desktop) or /mobile (mobile).
// Mobile detection is done via the User-Agent header at the edge.
// Once the user is in the desktop workspace, they stay there (the mobile
// layout is a separate route group at /mobile/*).
export default async function Home() {
  const h = await headers()
  const ua = h.get('user-agent') || ''
  // Simple mobile detection — checks for common mobile UA strings.
  // Not perfect (tablets may go to desktop) but good enough for a
  // PWA where the user explicitly installs the app and launches from
  // the home screen (which sends the PWA start_url = /mobile directly).
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua)
  redirect(isMobile ? '/mobile' : '/dashboard')
}
