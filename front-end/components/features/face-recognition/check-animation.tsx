"use client"

import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { type Employee } from "@/lib/mock-data"

interface CheckAnimationProps {
  employee: Employee
}

export function CheckAnimation({ employee }: CheckAnimationProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Success ring */}
      <motion.div
        className="relative"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute -inset-4 rounded-full bg-success/20"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.3,
            ease: "easeOut",
          }}
        />

        {/* Checkmark circle */}
        <motion.div
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
        >
          <motion.div
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Check className="h-10 w-10 text-success-foreground" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Employee info */}
      <motion.div
        className="mt-6 flex flex-col items-center text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <EmployeeAvatar
          name={employee.name}
          image={employee.image}
          size="lg"
          status="online"
        />
        <p className="mt-3 text-lg font-semibold text-foreground">
          {employee.name}
        </p>
        <p className="text-sm text-muted-foreground">{employee.role}</p>
        <p className="mt-2 text-xs text-success font-medium">
          Checked in at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </motion.div>
    </motion.div>
  )
}
