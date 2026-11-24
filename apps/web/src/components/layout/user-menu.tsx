import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useCurrentUser, useAuth } from '@/auth/auth-context'
import { ROLE_LABELS } from '@/auth/roles'
import { getInitials } from '@/lib/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    // Replace the guard's redirect (which remembers this page) with a plain /login, so the
    // next person to log in on this device starts at their own home page.
    void navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Tài khoản">
          <Avatar className="size-8">
            <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
          <span className="hidden flex-col items-start text-left leading-tight sm:flex">
            <span className="text-sm font-medium">{user.fullName}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronsUpDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{user.fullName}</span>
          <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[user.role]}
            {user.affiliate && ` · Mã giới thiệu: ${user.affiliate.referralCode}`}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void navigate('/profile')}>
          <UserRound aria-hidden />
          Tài khoản của tôi
        </DropdownMenuItem>
        <DropdownMenuItem disabled={loggingOut} onSelect={() => void handleLogout()}>
          <LogOut aria-hidden />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
