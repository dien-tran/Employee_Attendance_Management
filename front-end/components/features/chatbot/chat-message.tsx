"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

export interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  pending?: boolean
}

interface ChatMessageProps {
  message: Message
  index: number
}

function renderInlineFormattedText(text: string, isUser: boolean): ReactNode[] {
  const nodes: ReactNode[] = []
  const boldPattern = /\*\*(.+?)\*\*/g
  let cursor = 0
  let match: RegExpExecArray | null
  let keyIndex = 0

  while ((match = boldPattern.exec(text)) !== null) {
    const [fullMatch, boldTextRaw] = match
    const start = match.index
    if (start > cursor) {
      const plain = text.slice(cursor, start).replace(/\*\*/g, "")
      if (plain) {
        nodes.push(<span key={`plain-${keyIndex++}`}>{plain}</span>)
      }
    }

    const boldText = (boldTextRaw || "").replace(/\*\*/g, "")
    if (boldText) {
      nodes.push(
        <span
          key={`bold-${keyIndex++}`}
          className={cn(
            "rounded-sm px-1 py-0.5 font-semibold",
            isUser ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
          )}
        >
          {boldText}
        </span>
      )
    }
    cursor = start + fullMatch.length
  }

  const tail = text.slice(cursor).replace(/\*\*/g, "")
  if (tail) {
    nodes.push(<span key={`tail-${keyIndex++}`}>{tail}</span>)
  }

  if (nodes.length === 0) {
    return [<span key="empty">{text.replace(/\*\*/g, "")}</span>]
  }
  return nodes
}

function renderMessageContent(content: string, isUser: boolean): ReactNode {
  const lines = content.split("\n")
  return (
    <div className="space-y-1.5 text-sm leading-6">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trimEnd()
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={`line-${idx}`} className="h-1.5" />
        }

        if (trimmed.startsWith("- ")) {
          return (
            <div key={`line-${idx}`} className="flex items-start gap-2">
              <span className={cn("mt-2 h-1.5 w-1.5 rounded-full", isUser ? "bg-primary-foreground/70" : "bg-primary/70")} />
              <div>{renderInlineFormattedText(trimmed.slice(2), isUser)}</div>
            </div>
          )
        }

        const isHeading = trimmed.endsWith(":")
        return (
          <p key={`line-${idx}`} className={cn(isHeading && "font-semibold")}>
            {renderInlineFormattedText(line, isUser)}
          </p>
        )
      })}
    </div>
  )
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const isUser = message.role === "user"
  const isPendingAssistant = message.role === "assistant" && message.pending

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
        {isPendingAssistant ? (
          <motion.div
            className="flex items-baseline gap-0.5 text-sm italic text-foreground/75"
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <span>{message.content}</span>
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            >
              .
            </motion.span>
            <motion.span
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              .
            </motion.span>
          </motion.div>
        ) : (
          renderMessageContent(message.content, isUser)
        )}
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
