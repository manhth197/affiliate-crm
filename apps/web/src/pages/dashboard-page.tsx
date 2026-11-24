import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/auth-context'
import { ROLE_LABELS } from '@/auth/roles'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
  const user = useCurrentUser()

  async function copyReferralCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Đã sao chép mã giới thiệu')
    } catch {
      toast.error('Không sao chép được, vui lòng chép thủ công')
    }
  }

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={
          <span className="inline-flex items-center gap-2">
            Bạn đang đăng nhập với vai trò{' '}
            <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </span>
        }
      />

      {user.affiliate && (
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Mã giới thiệu của bạn</CardTitle>
            <CardDescription>
              Gửi mã này cho khách hàng hoặc đối tác khi giới thiệu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg font-semibold tracking-wider">
              {user.affiliate.referralCode}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copyReferralCode(user.affiliate!.referralCode)}
            >
              <Copy aria-hidden />
              Sao chép
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
