"use client"

import { useState } from "react"
import { ChatFab } from "./chat-fab"
import { ChatWindow } from "./chat-window"

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <ChatWindow isOpen={isOpen} />
      <ChatFab
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        hasUnread={!isOpen}
      />
    </div>
  )
}
