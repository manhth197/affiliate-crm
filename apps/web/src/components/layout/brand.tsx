import { Handshake } from 'lucide-react'
import { Link } from 'react-router'

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Handshake className="size-4" aria-hidden />
      </span>
      <span>Affiliate CRM</span>
    </Link>
  )
}
