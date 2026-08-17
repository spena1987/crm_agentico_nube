'use client'

import React from 'react'
import ChatInbox from '@/components/ChatInbox'

export default function ChatPage() {
  return (
    <div className="w-full h-full flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden p-2 sm:p-3 md:p-4">
      <ChatInbox />
    </div>
  )
}
