'use client'

import React from 'react'
import { AlertTriangle, RefreshCw, Home, LayoutDashboard, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('[Enterprise Error Boundary Caught Exception]:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
    if (typeof this.props.onReset === 'function') {
      this.props.onReset()
    }
  }

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    const { hasError, error, errorInfo, showDetails } = this.state
    const { children, compact = false, fallbackTitle = 'Widget Unavailable' } = this.props

    if (!hasError) {
      return children
    }

    // Compact Mode Fallback for Isolated Widgets / Components
    if (compact) {
      return (
        <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive my-2 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-xs font-bold text-foreground">{fallbackTitle}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleReset}
              className="h-7 px-2.5 rounded-lg text-[11px] font-bold border-destructive/20 hover:bg-destructive/10"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
            {error?.message || 'Failed to render component'}
          </p>
        </div>
      )
    }

    // Full Page Mode Fallback
    const isDev = process.env.NODE_ENV !== 'production'

    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-card border border-border/80 rounded-[28px] p-8 sm:p-12 shadow-elevated text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          {/* Ambient Glow */}
          <div className="absolute -top-20 -left-20 w-52 h-52 bg-destructive/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-52 h-52 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Warning Icon Badge */}
          <div className="relative mx-auto mb-6 w-20 h-20 shrink-0">
            <div className="absolute inset-0 bg-destructive/20 rounded-full blur-lg" />
            <div className="relative w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-soft">
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mb-2">
            Something Went Wrong
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto mb-8">
            We encountered an unexpected problem. The application has safely isolated this error.
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              onClick={this.handleReset}
              className="h-11 rounded-xl gold-gradient text-primary font-extrabold text-xs shadow-soft hover:shadow-glow transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Component</span>
            </Button>

            <Button
              variant="outline"
              onClick={this.handleRefresh}
              className="h-11 rounded-xl border-border text-foreground font-bold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
            >
              <span>Refresh Page</span>
            </Button>

            <a href="/" className="col-span-1">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-border text-foreground font-semibold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Go Home</span>
              </Button>
            </a>

            <a href="/admin" className="col-span-1">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-border text-foreground font-semibold text-xs hover:bg-secondary transition-all flex items-center justify-center gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Go Dashboard</span>
              </Button>
            </a>
          </div>

          {/* Development Stack Trace Dropdown */}
          {isDev && error && (
            <div className="mt-6 pt-6 border-t border-border/60 text-left">
              <button
                onClick={() => this.setState({ showDetails: !showDetails })}
                className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center justify-between w-full p-2 bg-secondary/50 rounded-xl"
              >
                <span>Technical Details (Dev Mode Only)</span>
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDetails && (
                <div className="mt-3 p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 scrollbar-thin">
                  <p className="font-bold text-red-400 mb-1">{error.toString()}</p>
                  {errorInfo?.componentStack && (
                    <pre className="text-slate-400 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }
}
