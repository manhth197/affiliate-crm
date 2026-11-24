import { Check, LoaderCircle, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import type { Commission } from '@/api/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatVnd } from '@/lib/format'
import { canApprove, canCancel } from './finance-rules'
import { useApproveCommission, useCancelCommission } from './queries'

/** ADMIN row actions for a commission. */
export function CommissionActions({ commission }: { commission: Commission }) {
  const approve = useApproveCommission()
  const [cancelling, setCancelling] = useState(false)

  if (!canApprove(commission) && !canCancel(commission)) return null

  return (
    <div className="flex justify-end gap-1">
      {canApprove(commission) && (
        <Button
          size="sm"
          variant="outline"
          disabled={approve.isPending}
          aria-label={`Duyệt hoa hồng ${commission.lead.code}`}
          onClick={() =>
            approve.mutate(commission.id, {
              onSuccess: () => toast.success(`Đã duyệt hoa hồng ${commission.lead.code}`),
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
        >
          {approve.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <Check aria-hidden />
          )}
          <span className="hidden sm:inline">Duyệt</span>
        </Button>
      )}
      {canCancel(commission) && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Hủy hoa hồng ${commission.lead.code}`}
          onClick={() => setCancelling(true)}
        >
          <X aria-hidden />
          <span className="hidden sm:inline">Hủy</span>
        </Button>
      )}
      <CancelCommissionDialog
        commission={commission}
        open={cancelling}
        onClose={() => setCancelling(false)}
      />
    </div>
  )
}

function CancelCommissionDialog({
  commission,
  open,
  onClose,
}: {
  commission: Commission
  open: boolean
  onClose: () => void
}) {
  const cancel = useCancelCommission()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = reason.trim()
    if (!text) return setError('Vui lòng ghi lý do hủy')
    if (text.length > 500) return setError('Lý do tối đa 500 ký tự')
    setError(null)
    cancel.mutate(
      { id: commission.id, reason: text },
      {
        onSuccess: () => {
          toast.success(`Đã hủy hoa hồng ${commission.lead.code}`)
          onClose()
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Hủy hoa hồng {commission.lead.code}</DialogTitle>
            <DialogDescription>
              {commission.affiliate.fullName} · {formatVnd(commission.amount)}. Hoa hồng đã hủy sẽ
              không được chi trả.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="cancel-reason">Lý do hủy</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              placeholder="Ví dụ: khách hủy hợp đồng trong 15 ngày"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'cancel-reason-error' : undefined}
              onChange={(event) => setReason(event.target.value)}
            />
            {error && (
              <p id="cancel-reason-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Quay lại
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending}>
              {cancel.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Hủy hoa hồng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
