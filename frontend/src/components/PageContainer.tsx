import { m } from 'motion/react'
import { cn } from '@/lib/utils'
import { pageVariants } from '@/lib/animations'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <m.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className={cn('mx-auto max-w-7xl px-6 py-8', className)}
    >
      {children}
    </m.div>
  )
}
