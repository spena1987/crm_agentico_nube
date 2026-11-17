'use client'

import React from 'react'
import ClientErrorFallback from '@/components/common/ClientErrorFallback'
import { reportClientError, tryAutoRecoverChunkError } from '@/lib/clientErrorHandler'

interface ClientErrorBoundaryProps {
  children: React.ReactNode
  pathname?: string | null
  userEmail?: string | null
}

interface ClientErrorBoundaryState {
  hasError: boolean
  error: unknown
}

/**
 * Límite de error para el contenido de cada módulo dentro del CRM,
 * evitando que un error puntual derribe la barra lateral o la sesión.
 */
export default class ClientErrorBoundary extends React.Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  constructor(props: ClientErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: unknown): ClientErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const recargando = tryAutoRecoverChunkError(error)
    reportClientError(error, {
      pathname: this.props.pathname || undefined,
      source: recargando ? 'ClientErrorBoundary(auto-reload)' : 'ClientErrorBoundary',
      componentStack: info?.componentStack || undefined,
      userEmail: this.props.userEmail || undefined,
    })
  }

  componentDidUpdate(prevProps: ClientErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.pathname !== this.props.pathname) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ClientErrorFallback
          error={this.state.error}
          pathname={this.props.pathname || undefined}
          onReset={() => this.setState({ hasError: false, error: null })}
        />
      )
    }
    return this.props.children
  }
}
