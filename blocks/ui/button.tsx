// Adapted from shadcn/ui's Base UI Button, MIT. See blocks/NOTICE.md.
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/blocks/lib/utils";
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-normal rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground hover:bg-(--primary-dark) hover:shadow-[2px_2px_0_var(--border)] active:shadow-none",
        outline:
          "border border-input bg-background hover:border-primary hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        // Heights come from the --control-h tokens (styles.css): a 44px tap
        // target by default, shadcn's own denser heights inside the officer
        // shell on a mouse. The padding fits inside the densest of them.
        default: "min-h-(--control-h) px-3 py-1",
        sm: "min-h-(--control-h-sm) rounded-md px-2.5",
        lg: "min-h-(--control-h-lg) px-6 py-2",
        icon: "size-(--control-h)",
        "icon-xs": "size-(--control-h-xs) rounded-md",
        "icon-sm": "size-(--control-h-sm) rounded-md",
        "icon-lg": "size-(--control-h-lg)",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
/**
 * `render` replaces the `<button>` with the element it is given, keeping the
 * button's classes and props. A link keeps link semantics: Base UI's button
 * primitive would add `role="button"`, so this composes `useRender` directly.
 */
export function Button({
  className,
  variant,
  size,
  render,
  type,
  nativeButton: _nativeButton,
  ...props
}: useRender.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /**
     * Read by Base UI's button primitive. This button takes its semantics from
     * the element `render` returns, so the value is accepted and dropped rather
     * than reaching the DOM as an attribute.
     */
    nativeButton?: boolean;
  }) {
  return useRender({
    defaultTagName: "button",
    render,
    props: {
      "data-slot": "button",
      className: cn(buttonVariants({ variant, size, className })),
      ...(render ? {} : { type: type ?? "button" }),
      ...props,
    },
  });
}
