'use client'

import React from 'react'
import ChatInbox from '@/components/ChatInbox'

export default function ChatPage() {
  return (
    <div className="w-full flex-1 flex flex-col justify-start">
      <div className="mb-4">
        <h1 className="text-xl font-extrabold tracking-tight">Centro de Mensajería</h1>
        <p className="text-xs text-[var(--secondary)]">
          Monitorea las conversaciones del bot inteligente e interviene cuando sea necesario.
        </p>
      </div>
      <ChatInbox />
    </div>
  )
}
