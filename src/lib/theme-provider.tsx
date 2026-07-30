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

  // Sync DOM attribute with current theme state. No setState inside effect — just external system sync.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setTheme = (t: OmniSiteTheme) => {
    setThemeState(t)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, t)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useOmniTheme = () => useContext(ThemeContext)
