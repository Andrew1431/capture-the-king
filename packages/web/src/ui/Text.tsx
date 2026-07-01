import { cva, type VariantProps } from 'class-variance-authority'
import type { ElementType, HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const heading = cva('font-display font-bold tracking-wide text-text', {
  variants: {
    level: {
      1: 'text-3xl sm:text-4xl',
      2: 'text-2xl sm:text-3xl',
      3: 'text-lg sm:text-xl tracking-wider uppercase',
    },
  },
  defaultVariants: { level: 1 },
})

export interface HeadingProps
  extends HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof heading> {
  as?: ElementType
}

export function Heading({ level = 1, as, className, ...props }: HeadingProps) {
  const Tag = (as ?? (`h${level}` as ElementType)) as ElementType
  return <Tag className={cn(heading({ level }), className)} {...props} />
}

const text = cva('', {
  variants: {
    size: {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
    },
    tone: {
      default: 'text-text',
      muted: 'text-muted',
      brand: 'text-brand',
    },
  },
  defaultVariants: { size: 'base', tone: 'default' },
})

export interface TextProps extends HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof text> {
  as?: ElementType
}

export function Text({ size, tone, as, className, ...props }: TextProps) {
  const Tag = (as ?? 'p') as ElementType
  return <Tag className={cn(text({ size, tone }), className)} {...props} />
}
