"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface ChatMessageProps {
  message: Message
  index: number
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const isUser = message.role === "user"

  return (
    <motion.div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-scanner/10 text-scanner"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </motion.div>
  )
}
