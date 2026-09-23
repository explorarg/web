"use client"

import * as React from "react"
import { Calendar } from "lucide-react"

import { cn } from "@/lib/utils"

type NativeDateInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  icon?: boolean
}

const NativeDateInput = React.forwardRef<HTMLInputElement, NativeDateInputProps>(
  ({ className, icon = true, lang = "es-AR", ...props }, ref) => {
    return (
      <div className="relative">
        {icon ? (
          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2BB8BF]" />
        ) : null}
        <input
          ref={ref}
          type="date"
          lang={lang}
          data-slot="native-date-input"
          className={cn(
            "border-[#BFD8EE] h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_4px_12px_rgba(30,136,184,0.06)] transition-[color,box-shadow,border-color] outline-none focus-visible:border-[#2BB8BF] focus-visible:ring-2 focus-visible:ring-[#2BB8BF]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            icon ? "pl-9" : "",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)

NativeDateInput.displayName = "NativeDateInput"

export { NativeDateInput }
