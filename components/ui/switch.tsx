"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-[#2BB8BF] data-[state=unchecked]:bg-[#C8DCEE] focus-visible:ring-[#2BB8BF]/30 inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent shadow-[0_2px_8px_rgba(30,136,184,0.12)] transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-white pointer-events-none block size-5 rounded-full shadow-md ring-0 transition-transform data-[state=checked]:translate-x-[1.05rem] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
