import { redirect } from 'next/navigation'

// The root path redirects to /dashboard, which is the first module route
// under the (workspace) route group. This gives every module a shareable
// URL (/boq, /scheduler, etc.) and enables browser back/forward navigation.
export default function Home() {
  redirect('/dashboard')
}
