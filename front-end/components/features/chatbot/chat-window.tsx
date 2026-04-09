"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Bot, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage, type Message } from "./chat-message"
import { TypingIndicator } from "./typing-indicator"
import { chatbotResponses } from "@/lib/mock-data"

interface ChatWindowProps {
  isOpen: boolean
}

const quickActions = [
  { label: "Today's attendance", keyword: "attendance" },
  { label: "How to check in?", keyword: "checkin" },
  { label: "View employees", keyword: "employees" },
  { label: "Help", keyword: "help" },
]

export function ChatWindow({ isOpen }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: chatbotResponses.greeting,
      role: "assistant",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const getResponse = (userInput: string): string => {
    const lower = userInput.toLowerCase()

    if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
      return chatbotResponses.greeting
    }
    if (lower.includes("attendance") || lower.includes("today")) {
      return chatbotResponses.attendance
    }
    if (lower.includes("check") && lower.includes("in")) {
      return chatbotResponses.checkin
    }
    if (lower.includes("late")) {
      return chatbotResponses.late
    }
    if (lower.includes("employee") || lower.includes("staff") || lower.includes("team")) {
      return chatbotResponses.employees
    }
    if (lower.includes("help")) {
      return chatbotResponses.help
    }

    return chatbotResponses.default
  }

  const sendMessage = async (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: text.trim(),
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate response delay
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500))

    const response = getResponse(text)
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: response,
      role: "assistant",
      timestamp: new Date(),
    }

    setIsTyping(false)
    setMessages((prev) => [...prev, assistantMessage])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (keyword: string) => {
    const response = chatbotResponses[keyword as keyof typeof chatbotResponses]
    if (response) {
      const quickMessage = quickActions.find((a) => a.keyword === keyword)?.label || keyword
      sendMessage(quickMessage)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={cn(
            "absolute bottom-20 right-0 w-[380px] max-h-[600px]",
            "flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          )}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-scanner/10">
              <Bot className="h-5 w-5 text-scanner" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">AttendFlow Assistant</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success" />
                Online
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-scanner" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
            {messages.map((message, index) => (
              <ChatMessage key={message.id} message={message} index={index} />
            ))}
            <AnimatePresence>
              {isTyping && <TypingIndicator />}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <motion.button
                    key={action.keyword}
                    onClick={() => handleQuickAction(action.keyword)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {action.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about attendance..."
                className={cn(
                  "flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm",
                  "placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring"
                )}
              />
              <motion.button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  "bg-primary text-primary-foreground",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="h-4 w-4" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
