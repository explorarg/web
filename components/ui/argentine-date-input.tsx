"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  applyArgentineDateMask,
  formatIsoDateToArgentine,
  parseArgentineDateToIso,
} from "@/lib/utils/argentine-date";
import { cn } from "@/lib/utils";

type ArgentineDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  className?: string;
  iconClassName?: string;
};

export function ArgentineDateInput({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "18/05/2025",
  className,
  iconClassName,
}: ArgentineDateInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState(formatIsoDateToArgentine(value));

  useEffect(() => {
    setDraft(formatIsoDateToArgentine(value));
  }, [value]);

  const syncDraft = (rawValue: string, caretPosition: number | null | undefined) => {
    const { formattedValue, nextCaretPosition } = applyArgentineDateMask(rawValue, caretPosition);
    setDraft(formattedValue);

    const parsed = parseArgentineDateToIso(formattedValue);
    if (parsed !== null) {
      onChange(parsed);
    } else if (!formattedValue.trim()) {
      onChange("");
    }

    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        lang="es-AR"
        maxLength={10}
        value={draft}
        onChange={(e) => {
          syncDraft(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;

          const allowedKeys = new Set([
            "Backspace",
            "Delete",
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Tab",
            "Home",
            "End",
            "Enter",
          ]);

          if (allowedKeys.has(event.key)) return;
          if (/^\d$/.test(event.key)) return;

          event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          const pastedText = event.clipboardData.getData("text");
          const input = inputRef.current;
          if (!input) return;

          const selectionStart = input.selectionStart ?? draft.length;
          const selectionEnd = input.selectionEnd ?? selectionStart;
          const nextRawValue = `${draft.slice(0, selectionStart)}${pastedText}${draft.slice(selectionEnd)}`;
          const nextCaret = selectionStart + pastedText.length;
          syncDraft(nextRawValue, nextCaret);
        }}
        onBlur={() => {
          const parsed = parseArgentineDateToIso(draft);
          if (parsed === null) {
            setDraft(formatIsoDateToArgentine(value));
          } else {
            setDraft(formatIsoDateToArgentine(parsed));
            onChange(parsed);
          }
          onBlur?.();
        }}
        placeholder={placeholder}
        className={cn("pl-10", className)}
      />
      <Calendar className={cn("absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400", iconClassName)} />
    </div>
  );
}
