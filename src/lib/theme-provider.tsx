'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type OmniSiteTheme = 'classic' | 'procore' | 'darkfield'

interface ThemeContextValue {
  theme: OmniSiteTheme
  setTheme: (t: OmniSiteTheme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'classic',
  setTheme: () => {},
})

const THEME_KEY = 'omnisite-theme'
const VALID_THEMES: OmniSiteTheme[] = ['classic', 'procore', 'darkfield']

function readStoredTheme(): OmniSiteTheme {
  if (typeof window === 'undefined') return 'classic'
  const stored = window.localStorage.getItem(THEME_KEY) as OmniSiteTheme | null
  return stored && VALID_THEMES.includes(stored) ? stored : 'classic'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads localStorage once on client; safe for SSR (returns 'classic' default).
  const [theme, setThemeState] = useState<OmniSiteTheme>(readStoredTheme)

  // Sync DOM attribute + .dark class with current theme state.
  // P0 fix: 'darkfield' theme must add the `.dark` class to <html> so
  // Tailwind's `dark:` variants work. Without this, every `dark:text-*`
  // silently falls back to light colors on a dark background.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('data-theme', theme)
    if (theme === 'darkfield') {
      el.classList.add('dark')
    } else {
      el.classList.remove('dark')
    }
  }, [theme])

  const setTheme = (t: OmniSiteTheme) => {
    setThemeState(t)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, t)
    }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export const useOmniTheme = () => useContext(ThemeContext)
