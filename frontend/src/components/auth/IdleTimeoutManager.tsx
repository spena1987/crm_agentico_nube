'use client'

import React from 'react'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import IdleWarningModal from './IdleWarningModal'

export default function IdleTimeoutManager() {
  const {
    showWarning,
    remainingSeconds,
    totalWarningSeconds,
    continueSession,
    logoutNow,
  } = useIdleTimeout()

  if (!showWarning) return null

  return (
    <IdleWarningModal
      remainingSeconds={remainingSeconds}
      totalWarningSeconds={totalWarningSeconds}
      onContinue={continueSession}
      onLogout={logoutNow}
    />
  )
}
