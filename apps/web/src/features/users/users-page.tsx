import { cn } from 'cn'
import { Lock, LockOpen, Pencil, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import { ROLES, type Role, type User, type UserStatus } from '@/api/types'
import { useCurrentUser } from '@/auth/auth-context'
import { ROLE_LABELS } from '@/auth/roles'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { SearchInput } from '@/components/search-input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { USER_STATUS_LABELS } from '@/lib/labels'
import { useUrlState } from '@/lib/use-url-state'
import { useUpdateUser, useUsers } from './queries'
import { CreateUserDialog, EditUserDialog } from './user-form-dialogs'

const PAGE_SIZE = 20
const STATUSES = Object.keys(USER_STATUS_LABELS) as UserStatus[]

/** ADMIN: every account (affiliates, staff, admins); create staff, edit, lock/unlock. */
export function UsersPage() {
  const me = useCurrentUser()
  const url = useUrlState()
  const role = ROLES.find((r) => r === url.get('role'))
  const status = STATUSES.find((s) => s === url.get('status'))
  const q = url.get('q')
  const users = useUsers({ role, status, q: q || undefined, page: url.page, pageSize: PAGE_SIZE })
  const { update } = url
  const onSearch = useCallback((value: string) => update({ q: value }), [update])

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [locking, setLocking] = useState<User | null>(null)

  return (
    <>
      <PageHeader
        title="Người dùng"
        description="Tài khoản cộng tác viên, nhân viên và quản trị viên."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Thêm nhân viên
          </Button>
        }
      />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="col-span-2 sm:col-span-1">
            <SearchInput
              label="Tìm người dùng"
              placeholder="Tìm theo tên hoặc email"
              value={q}
              onSearch={onSearch}
            />
          </div>
          <NativeSelect
            aria-label="Vai trò"
            className="w-full"
            value={role ?? ''}
            onChange={(event) => url.update({ role: event.target.value })}
          >
            <NativeSelectOption value="">Mọi vai trò</NativeSelectOption>
            {ROLES.map((r: Role) => (
              <NativeSelectOption key={r} value={r}>
                {ROLE_LABELS[r]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Trạng thái tài khoản"
            className="w-full"
            value={status ?? ''}
            onChange={(event) => url.update({ status: event.target.value })}
          >
            <NativeSelectOption value="">Mọi trạng thái</NativeSelectOption>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {USER_STATUS_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        {users.isError ? (
          <QueryErrorAlert error={users.error} onRetry={() => void users.refetch()} />
        ) : (
          <Card className={cn('py-0', users.isPlaceholderData && 'opacity-60')}>
            {users.isPending ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : users.data.data.length === 0 ? (
              <EmptyState title="Không có người dùng nào khớp bộ lọc" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Người dùng</TableHead>
                    <TableHead className="hidden md:table-cell">Số điện thoại</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.data.data.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">
                          {user.fullName}
                          {user.id === me.id && (
                            <span className="ml-1 text-xs text-muted-foreground">(bạn)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </TableCell>
                      <TableCell className="hidden tabular-nums md:table-cell">
                        {user.phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.status === 'ACTIVE'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                          }
                        >
                          {USER_STATUS_LABELS[user.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Sửa ${user.fullName}`}
                            onClick={() => setEditing(user)}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <LockButton user={user} isMe={user.id === me.id} onLock={setLocking} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {users.data && users.data.data.length > 0 && (
          <PaginationBar
            page={url.page}
            pageSize={PAGE_SIZE}
            total={users.data.meta.total}
            onPageChange={(page) => url.update({ page })}
            noun="người dùng"
          />
        )}
      </div>

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} />
      <EditUserDialog user={editing} onClose={() => setEditing(null)} />
      <LockUserDialog user={locking} onClose={() => setLocking(null)} />
    </>
  )
}

/** Unlocking is immediate; locking asks for confirmation (it logs the person out everywhere). */
function LockButton({
  user,
  isMe,
  onLock,
}: {
  user: User
  isMe: boolean
  onLock: (user: User) => void
}) {
  const updateUser = useUpdateUser()

  if (user.status === 'DISABLED') {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Mở khóa ${user.fullName}`}
        disabled={updateUser.isPending}
        onClick={() =>
          updateUser.mutate(
            { id: user.id, body: { status: 'ACTIVE' } },
            {
              onSuccess: () => toast.success(`Đã mở khóa ${user.fullName}`),
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          )
        }
      >
        <LockOpen aria-hidden />
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isMe ? 'Không thể tự khóa tài khoản của mình' : `Khóa ${user.fullName}`}
      title={isMe ? 'Không thể tự khóa tài khoản của mình' : undefined}
      disabled={isMe}
      onClick={() => onLock(user)}
    >
      <Lock aria-hidden />
    </Button>
  )
}

function LockUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const updateUser = useUpdateUser()

  function lock() {
    if (!user) return
    updateUser.mutate(
      { id: user.id, body: { status: 'DISABLED' } },
      {
        onSuccess: () => {
          toast.success(`Đã khóa ${user.fullName}`)
          onClose()
        },
        onError: (error) =>
          toast.error(getErrorMessage(error, { 422: 'Không thể khóa tài khoản này.' })),
      },
    )
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Khóa tài khoản {user?.fullName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Người này sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập được cho tới khi được mở
            khóa. Dữ liệu (lead, hoa hồng) vẫn được giữ nguyên.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={updateUser.isPending}
            onClick={(event) => {
              event.preventDefault() // keep the dialog open until the API answers
              lock()
            }}
          >
            Khóa tài khoản
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
