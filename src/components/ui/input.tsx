import * as React from 'react'
import { cn } from '../../lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(
  ({ className, ...props }, ref) => (
    <input ref={ref as any} className={cn('px-2 py-1 border rounded', className)} {...props} />
  )
)
Input.displayName = 'Input'

export default Input
