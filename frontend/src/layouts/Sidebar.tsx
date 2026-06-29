import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Zap,
  Lightbulb,
  FileText,
  ShieldCheck,
  History,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  end?: boolean
}

const mainNav: NavItem[] = [
  { to: '/',          icon: LayoutDashboard, label: 'Overview',          end: true },
  { to: '/automation', icon: Zap,            label: 'Automation' },
  { to: '/ideas',     icon: Lightbulb,       label: 'Idea Intelligence' },
  { to: '/content',   icon: FileText,        label: 'Content Studio' },
  { to: '/quality',   icon: ShieldCheck,     label: 'Quality Center' },
  { to: '/history',   icon: History,         label: 'History' },
]

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-[11px] font-bold text-white">SF</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">ScriptFlow</span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-4">
        <Separator className="mb-3 bg-sidebar-border" />
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  )
}
