"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Bot, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChatMessage, type Message } from "./chat-message"
import { apiClient } from "@/lib/api-client"

interface ChatWindowProps {
  isOpen: boolean
}

const quickActions = [
  { label: "Today's attendance", keyword: "attendance" },
  { label: "How to check in?", keyword: "checkin" },
  { label: "View employees", keyword: "employees" },
  { label: "Help", keyword: "help" },
]

const RESPONSE_STREAM_WORD_DELAY_MS = 85
const WAITING_STREAM_WORD_DELAY_MS = 95
const WAITING_PHRASES = [
  "Hệ thống đã ghi nhận đầy đủ yêu cầu từ bạn và đang nhanh chóng chuyển đến bộ phận xử lý.",
  "Chúng tôi đang tổng hợp và phân tích dữ liệu, bạn vui lòng đợi trong giây lát nhé. Kết quả sẽ hiển thị ngay thôi!",
]
const WAITING_PHRASE_SWITCH_MS = 20_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const splitIntoWordChunks = (text: string): string[] => {
  const chunks = text.match(/\S+\s*/g)
  if (chunks && chunks.length > 0) return chunks
  return text ? [text] : []
}

export function ChatWindow({ isOpen }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Xin chào, mình là AttendFlow Assistant. Bạn có thể hỏi về điểm danh hoặc thông tin nhân sự.",
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

  const toFriendlyErrorMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : "Đã xảy ra lỗi."
    const normalized = raw.toLowerCase()

    if (normalized.includes("access denied") || normalized.includes("forbidden") || normalized.includes("403")) {
      return "Bạn không có quyền truy cập loại thông tin này."
    }
    if (
      normalized.includes("openrouter") ||
      normalized.includes("chutes") ||
      normalized.includes("503") ||
      normalized.includes("unavailable") ||
      normalized.includes("timeout")
    ) {
      return "Dịch vụ chatbot đang tạm thời bận. Vui lòng thử lại sau ít phút."
    }
    if (normalized.includes("failed to fetch") || normalized.includes("network")) {
      return "Không kết nối được tới máy chủ chatbot. Vui lòng kiểm tra mạng hoặc thử lại."
    }

    return "Không thể xử lý câu hỏi lúc này."
  }

  const sendMessage = async (text: string) => {
    const question = text.trim()
    if (!question) return

    const assistantMessageId = (Date.now() + 1).toString()
    const userMessage: Message = {
      id: Date.now().toString(),
      content: question,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        content: "",
        role: "assistant",
        timestamp: new Date(),
        pending: true,
      },
    ])
    setInput("")
    setIsTyping(true)

    let requestCompleted = false
    let mainReplyStarted = false
    let hasStreamError = false
    let waitingTask: Promise<void> | null = null

    try {
      let streamedReply = ""
      const tokenQueue: string[] = []
      let flushing = false

      const updateAssistantMessage = (content: string, pending: boolean = false) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId ? { ...message, content, pending } : message
          )
        )
      }

      const flushTokenQueue = async () => {
        if (flushing) return
        flushing = true
        while (tokenQueue.length > 0) {
          streamedReply += tokenQueue.shift() || ""
          updateAssistantMessage(streamedReply)
          await sleep(RESPONSE_STREAM_WORD_DELAY_MS)
        }
        flushing = false
      }

      const waitForFlushDone = async () => {
        while (flushing || tokenQueue.length > 0) {
          await sleep(12)
        }
      }

      const shouldStopWaitingStream = () => requestCompleted || mainReplyStarted || hasStreamError

      waitingTask = (async () => {
        for (let phraseIndex = 0; phraseIndex < WAITING_PHRASES.length; phraseIndex += 1) {
          if (shouldStopWaitingStream()) return
          const phrase = WAITING_PHRASES[phraseIndex]
          const chunks = splitIntoWordChunks(phrase)
          let streamedWaitingPhrase = ""

          for (const chunk of chunks) {
            if (shouldStopWaitingStream()) return
            streamedWaitingPhrase += chunk
            updateAssistantMessage(streamedWaitingPhrase, true)
            await sleep(WAITING_STREAM_WORD_DELAY_MS)
          }

          if (shouldStopWaitingStream()) return

          if (phraseIndex < WAITING_PHRASES.length - 1) {
            const switchAt = Date.now() + WAITING_PHRASE_SWITCH_MS
            while (Date.now() < switchAt) {
              if (shouldStopWaitingStream()) return
              await sleep(150)
            }
            updateAssistantMessage("", true)
          } else {
            while (!shouldStopWaitingStream()) {
              await sleep(200)
            }
          }
        }
      })()

      await apiClient.postStream(
        "/api/chatbot/message",
        {
          message: question,
          context: "",
          stream: true,
        },
        {
          onToken: (token) => {
            if (!mainReplyStarted) {
              mainReplyStarted = true
              streamedReply = ""
              updateAssistantMessage("", false)
            }
            tokenQueue.push(...splitIntoWordChunks(token))
            void flushTokenQueue()
          },
        }
      )

      requestCompleted = true
      if (waitingTask) {
        await waitingTask
      }
      await waitForFlushDone()

      if (!streamedReply.trim()) {
        updateAssistantMessage("Mình chưa có dữ liệu để trả lời câu hỏi này.", false)
      }
    } catch (error) {
      hasStreamError = true
      requestCompleted = true
      if (waitingTask) {
        await waitingTask
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: `${toFriendlyErrorMessage(error)}\n\nBạn có thể gửi lại câu hỏi để thử lại.`,
                pending: false,
              }
            : message
        )
      )
    } finally {
      setIsTyping(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (keyword: string) => {
    const quickMessage = quickActions.find((action) => action.keyword === keyword)?.label || keyword
    sendMessage(quickMessage)
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
