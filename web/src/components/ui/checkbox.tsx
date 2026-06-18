import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const checkboxVariants = cva(
  'peer shrink-0 rounded-[4px] border border-input bg-background outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
  {
    variants: {
      size: {
        default: 'size-4 [&_svg]:size-3',
        xs: 'size-3 [&_svg]:size-2.5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

function Checkbox({
  className,
  size,
  ...props
}: CheckboxPrimitive.CheckboxProps & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn('flex items-center justify-center text-current')}
      >
        <Check />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
