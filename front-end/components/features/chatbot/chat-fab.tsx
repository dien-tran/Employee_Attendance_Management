"use client"

import { motion } from "framer-motion"
import { MessageCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatFabProps {
  isOpen: boolean
  onClick: () => void
  hasUnread?: boolean
}

export function ChatFab({ isOpen, onClick, hasUnread = false }: ChatFabProps) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg",
        "bg-primary text-primary-foreground",
        "hover:bg-primary/90 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      animate={{
        rotate: isOpen ? 0 : 0,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Pulse animation when has unread */}
      {hasUnread && !isOpen && (
        <>
          <motion.span
            className="absolute inset-0 rounded-full bg-primary"
            animate={{
              scale: [1, 1.3, 1.3],
              opacity: [0.5, 0, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-success" />
          </span>
        </>
      )}

      {/* Icon */}
      <motion.div
        animate={{ rotate: isOpen ? 90 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </motion.div>
    </motion.button>
  )
}
