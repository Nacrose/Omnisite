'use client'

import { useOmniTheme, type OmniSiteTheme } from '@/lib/theme-provider'
import { Toaster as Sonner, ToasterProps } from 'sonner'

/**
 * Map OmniSite themes → Sonner's `light | dark | system` theme vocabulary.
 * `classic` and `procore` are both light-themed palettes; only `darkfield`
 * is dark. Using `next-themes`'s `useTheme` here previously caused the
 * toaster to render with the wrong theme because the rest of the app
 * drives theming through `useOmniTheme` + a `data-theme` attribute on
 * `<html>`, not next-themes' `class` strategy.
 */
function sonnerThemeFor(theme: OmniSiteTheme): ToasterProps['theme'] {
  return theme === 'darkfield' ? 'dark' : 'light'
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useOmniTheme()

  return (
    <Sonner
      theme={sonnerThemeFor(theme)}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
