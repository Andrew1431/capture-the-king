import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Centered, width-capped page column. Mobile-first padding. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-md px-4', className)} {...props} />
}

const stack = cva('flex', {
  variants: {
    direction: { col: 'flex-col', row: 'flex-row' },
    gap: {
      0: 'gap-0',
      1: 'gap-1',
      2: 'gap-2',
      3: 'gap-3',
      4: 'gap-4',
      5: 'gap-5',
      6: 'gap-6',
      8: 'gap-8',
    },
    align: { start: 'items-start', center: 'items-center', stretch: 'items-stretch' },
    justify: { start: 'justify-start', center: 'justify-center', between: 'justify-between' },
  },
  defaultVariants: { direction: 'col', gap: 4, align: 'stretch', justify: 'start' },
})

export interface StackProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof stack> {}

/** Flex layout helper so spacing lives in one place, not scattered across markup. */
export function Stack({ direction, gap, align, justify, className, ...props }: StackProps) {
  return <div className={cn(stack({ direction, gap, align, justify }), className)} {...props} />
}
