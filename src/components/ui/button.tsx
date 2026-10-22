import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:pointer-events-none disabled:opacity-50 h-9 px-3.5 cursor-pointer", { variants: { variant: { default: "bg-primary text-white hover:bg-primary/90", outline: "border border-border bg-white hover:bg-stone-50 text-foreground", ghost: "hover:bg-stone-100 text-muted-foreground" } }, defaultVariants: { variant: "default" } });
export function Button({ className, variant, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean }) { const Comp = asChild ? Slot : "button"; return <Comp className={cn(variants({ variant }), className)} {...props} />; }
