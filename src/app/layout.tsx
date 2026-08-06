// Import polyfills FIRST — before any other module. Safari < 15.4 doesn't
// support structuredClone() or crypto.randomUUID(), which are used in
// the initial render path (seed data + ID generation). Without these
// polyfills, Safari crashes during hydration and the user is stuck on
// a loading spinner forever.
import '@/lib/polyfills'

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { ConfirmProvider } from '@/components/ui/confirm-dialog'
import { ThemeProvider } from '@/lib/theme-provider'
import { I18nProvider } from '@/lib/i18n'
import { AuthProvider } from '@/lib/auth'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'OmniSite — Enterprise Construction Management',
  description:
    'Unified cloud platform for Pre-construction, Planning, Procurement, Site Execution, Project Controls and Document Management. Built for Nepali construction realities.',
  keywords: [
    'OmniSite',
    'Construction Management',
    'BOQ',
    'Rate Analysis',
    'Gantt',
    'DoR Norms',
    'FIDIC',
  ],
  authors: [{ name: 'OmniSite' }],
  icons: {
    icon: '/logo.svg',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OmniSite',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground theme-transition antialiased`}
      >
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* Single Sonner Toaster mounted at the app root — all `toast.*` calls
            from any component render here. Per-component Toasters were removed
            to prevent duplicate toasts on every call. */}
        <SonnerToaster richColors position="top-center" />
      </body>
    </html>
  )
}
