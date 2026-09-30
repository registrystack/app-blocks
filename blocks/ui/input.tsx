// Adapted from shadcn/ui's Input, MIT. See blocks/NOTICE.md.
import type { ComponentProps } from "react";
import { cn } from "@/blocks/lib/utils";
export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background min-h-(--control-h) w-full min-w-0 rounded-md border px-3 py-0.5 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background min-h-28 w-full min-w-0 rounded-md border px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
