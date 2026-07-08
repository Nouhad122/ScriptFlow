import { useEffect, useRef } from 'react'
import { m, useReducedMotion } from 'motion/react'
import { animate } from 'motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Animated counter ───────────────────────────────────────────────────────────
// Counts from 0 to value on mount. Skipped when prefers-reduced-motion is set.

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!ref.current) return
    if (reduced) {
      ref.current.textContent = String(value)
      return
    }
    const controls = animate(0, value, {
      duration: 1.0,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(latest) {
        if (ref.current) ref.current.textContent = String(Math.round(latest))
      },
    })
    return () => controls.stop()
  }, [value, reduced])

  return <span ref={ref}>{value}</span>
}

// ── StatCard ───────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  icon?: LucideIcon
  description?: string
  className?: string
}

export function StatCard({ label, value, icon: Icon, description, className }: StatCardProps) {
  return (
    <m.div
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className={cn(
        'rounded-lg border border-border bg-card p-5 space-y-3 cursor-default',
        'transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:border-border/60',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-foreground">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </m.div>
  )
}
