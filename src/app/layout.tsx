import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { headers } from 'next/headers'
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

// ─── Inline polyfill script ─────────────────────────────────────────────────
// This runs SYNCHRONOUSLY in the browser before any React/Next.js JS
// hydrates. Without this, Safari < 15.4 crashes during hydration because
// structuredClone() and crypto.randomUUID() don't exist — the user is
// stuck on a loading spinner forever.
//
// Using a dangerouslySetInnerHTML script (not a module import) because
// module imports are async — they don't block hydration. This inline
// script is parsed + executed before the RSC payload, so the polyfills
// are installed before any client component runs.
const POLYFILL_SCRIPT = `
;(function() {
  if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = function(obj) {
      if (obj === null || obj === undefined) return obj;
      return JSON.parse(JSON.stringify(obj));
    };
  }
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID !== 'function') {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: function() {
        if (typeof globalThis.crypto.getRandomValues === 'function') {
          var buf = new Uint8Array(16);
          globalThis.crypto.getRandomValues(buf);
          buf[6] = (buf[6] & 0x0f) | 0x40;
          buf[8] = (buf[8] & 0x3f) | 0x80;
          var hex = [];
          for (var i = 0; i < 16; i++) hex.push(buf[i].toString(16).padStart(2, '0'));
          return hex.slice(0,4).join('') + '-' + hex.slice(4,6).join('') + '-' + hex.slice(6,8).join('') + '-' + hex.slice(8,10).join('') + '-' + hex.slice(10,16).join('');
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      },
      writable: false,
      configurable: false
    });
  }
})();
`

// Force dynamic rendering so the per-request CSP nonce from proxy.ts
// is available via headers(). Without this, the root layout may render
// in a different request context than the proxy, causing the nonce
// on the inline polyfill script to mismatch the CSP header nonce —
// the browser blocks the script and the page never hydrates.
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Read the per-request CSP nonce (set by proxy.ts) so the inline
  // polyfill script passes the CSP check. Without the nonce, the
  // CSP blocks the script and Safari stays broken.
  const nonce = (await headers()).get('x-nonce') || ''

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: POLYFILL_SCRIPT }} />
      </head>
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
