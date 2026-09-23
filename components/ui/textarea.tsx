import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-[#BFD8EE] placeholder:text-slate-400 focus-visible:border-[#2BB8BF] focus-visible:ring-[#2BB8BF]/20 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-24 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-[0_4px_12px_rgba(30,136,184,0.06)] transition-[color,box-shadow,border-color] outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        "selection:bg-[#DDF3FF] selection:text-slate-900",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
