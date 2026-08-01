'use client'

import { ReactNode, Component, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as Sentry from '@/lib/sentry'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary — catches client-side render errors and shows
 * a recovery UI instead of a white screen.
 * Wrap the main app content so any module crash is contained.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OmniSite Error Boundary]', error, errorInfo)
    // Send to Sentry if configured
    Sentry.Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="workspace-bg flex h-screen flex-col items-center justify-center p-8">
          <div className="max-w-md space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred while rendering this module. Your data is safe — try
              reloading the page.
            </p>
            {this.state.error && (
              <pre className="bg-secondary text-muted-foreground max-h-32 overflow-x-auto rounded-md border border-[var(--pane-divider)] p-3 text-left text-xs">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-2">
              <Button onClick={this.handleReset} variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} size="sm">
                Reload Page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
