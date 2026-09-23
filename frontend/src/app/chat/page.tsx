'use client'

import React, { Suspense } from 'react'
import ChatInbox from '@/components/ChatInbox'
import { Loader2 } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="w-full h-full flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden p-2 sm:p-3 md:p-4">
      <Suspense fallback={
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span className="text-xs">Cargando bandeja de mensajería...</span>
        </div>
      }>
        <ChatInbox />
      </Suspense>
    </div>
  )
}
