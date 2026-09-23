import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-slate-400 border-[#BFD8EE] h-10 w-full min-w-0 rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_4px_12px_rgba(30,136,184,0.06)] transition-[color,box-shadow,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[#2BB8BF] focus-visible:ring-[#2BB8BF]/20 focus-visible:ring-2",
        "selection:bg-[#DDF3FF] selection:text-slate-900",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
