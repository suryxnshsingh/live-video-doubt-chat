"use client"

import React from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AskButtonProps {
  onClick: () => void
  className?: string
}

export default function AskButton({ onClick, className }: AskButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 h-14 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50",
        "bg-primary hover:bg-primary/90 hover:scale-105 gap-2",
        className
      )}
    >
      <MessageCircle className="h-5 w-5" />
      <span className="font-semibold text-base">Ask</span>
    </Button>
  )
}