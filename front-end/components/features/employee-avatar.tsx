"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface EmployeeAvatarProps {
  name: string
  image?: string
  status?: "online" | "offline" | "away" | "busy"
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
}

const statusColors = {
  online: "bg-success",
  offline: "bg-muted-foreground",
  away: "bg-yellow-500",
  busy: "bg-destructive",
}

const statusIndicatorSizes = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
}

export function EmployeeAvatar({
  name,
  image,
  status,
  size = "md",
  className,
}: EmployeeAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn("relative", className)}>
      <Avatar className={cn(sizeClasses[size])}>
        <AvatarImage src={image} alt={name} />
        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      {status && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-background",
            statusColors[status],
            statusIndicatorSizes[size]
          )}
        />
      )}
    </div>
  )
}
