import * as React from 'react'

export const ScrollArea: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={className} {...props}>
    {children}
  </div>
)

export default ScrollArea
