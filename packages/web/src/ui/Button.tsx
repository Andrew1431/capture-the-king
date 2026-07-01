import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const button = cva(
  // base: fat tap targets, no text selection, smooth press feedback
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none ' +
    'transition-[transform,background-color,box-shadow,opacity] active:scale-[0.98] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary reads like struck gold: a subtle bevel + a sheen that sweeps on hover.
        primary:
          'sheen bg-gradient-to-b from-brand to-brand-strong text-bg shadow-[0_6px_18px_-8px_rgba(232,184,75,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] hover:shadow-[0_10px_26px_-8px_rgba(232,184,75,0.85),inset_0_1px_0_rgba(255,255,255,0.4)]',
        secondary: 'bg-surface-2 text-text ring-1 ring-inset ring-border hover:ring-brand/40 hover:bg-surface',
        ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface-2',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-5 text-base',
        lg: 'h-14 px-7 text-lg',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size, block }), className)} {...props} />
}
