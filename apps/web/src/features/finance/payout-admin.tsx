import { Banknote, CalendarPlus, Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import type { Payout } from '@/api/types'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { previousMonth, vnMonth } from '@/lib/dates'
import { formatMonth, formatVnd } from '@/lib/format'
import { canConfirm, canMarkPaid } from './finance-rules'
import { useConfirmPayout, useGeneratePayouts, useMarkPayoutPaid } from './queries'

/** "Tạo kỳ chi trả": POST /payouts/generate for a month (a background job on the API). */
export function GeneratePayoutsButton() {
  const [open, setOpen] = useState(false)
  const thisMonth = vnMonth(new Date())
  const months = [previousMonth(thisMonth), thisMonth, previousMonth(previousMonth(thisMonth))]
  const [month, setMonth] = useState(months[0]!)
  const generate = useGeneratePayouts()

  function submit() {
    generate.mutate(month, {
      onSuccess: () => {
        toast.success(`Đang tạo kỳ chi trả ${formatMonth(month)}`, {
          description: 'Danh sách sẽ tự cập nhật khi xong.',
        })
        setOpen(false)
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus aria-hidden />
        Tạo kỳ chi trả
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo kỳ chi trả</DialogTitle>
            <DialogDescription>
              Mỗi cộng tác viên có một kỳ “Nháp” gồm mọi hoa hồng đã duyệt, chưa chi trả, tạo trước
              hết tháng đã chọn (kể cả hoa hồng duyệt muộn của các tháng trước). Chạy lại sẽ tính
              lại kỳ nháp; kỳ đã xác nhận hoặc đã trả không bị thay đổi.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            <Label htmlFor="payout-month">Tháng</Label>
            <NativeSelect
              id="payout-month"
              className="w-full"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {months.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {formatMonth(m)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button onClick={submit} disabled={generate.isPending}>
              {generate.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Tạo kỳ chi trả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** ADMIN row actions: confirm a draft, then mark it paid after the bank transfer. */
export function PayoutActions({ payout }: { payout: Payout }) {
  const confirm = useConfirmPayout()
  const markPaid = useMarkPayoutPaid()
  const [paying, setPaying] = useState(false)
  const label = `${payout.affiliate.fullName}, ${formatMonth(payout.periodMonth)}`

  if (canConfirm(payout)) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={confirm.isPending}
        aria-label={`Xác nhận kỳ chi trả ${label}`}
        onClick={() =>
          confirm.mutate(payout.id, {
            onSuccess: () =>
              toast.success(`Đã xác nhận kỳ chi trả của ${payout.affiliate.fullName}`),
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
      >
        {confirm.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden />
        ) : (
          <Check aria-hidden />
        )}
        Xác nhận
      </Button>
    )
  }
  if (!canMarkPaid(payout)) return null

  return (
    <>
      <Button
        size="sm"
        aria-label={`Đánh dấu đã chuyển khoản ${label}`}
        onClick={() => setPaying(true)}
      >
        <Banknote aria-hidden />
        Đã chuyển khoản
      </Button>
      <AlertDialog open={paying} onOpenChange={setPaying}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận đã chuyển khoản?</AlertDialogTitle>
            <AlertDialogDescription>
              {payout.affiliate.fullName} · {formatMonth(payout.periodMonth)} ·{' '}
              {formatVnd(payout.totalAmount)} ({payout.commissionCount} khoản). Các hoa hồng sẽ
              chuyển sang “Đã thanh toán” và cộng tác viên nhận được thông báo. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={markPaid.isPending}
              onClick={(event) => {
                event.preventDefault() // keep the dialog open until the API answers
                markPaid.mutate(payout.id, {
                  onSuccess: () => {
                    toast.success(`Đã chi trả cho ${payout.affiliate.fullName}`)
                    setPaying(false)
                  },
                  onError: (error) => toast.error(getErrorMessage(error)),
                })
              }}
            >
              Đã chuyển khoản
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
