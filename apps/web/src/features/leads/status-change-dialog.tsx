import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { getErrorMessage, isApiError } from '@/api/errors'
import type { Lead, LeadStatus } from '@/api/types'
import { FormField } from '@/components/form/form-field'
import { MoneyInput } from '@/components/form/money-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { useChangeLeadStatus } from './queries'

const MAX_AMOUNT = 100_000_000_000

function createSchema(target: LeadStatus) {
  return z
    .object({
      note: z.string().trim().max(1000, 'Ghi chú tối đa 1.000 ký tự'),
      disbursedAmount: z.number().int().nullish(),
    })
    .superRefine((values, ctx) => {
      if (target === 'REJECTED' && !values.note) {
        ctx.addIssue({ code: 'custom', path: ['note'], message: 'Vui lòng ghi lý do từ chối' })
      }
      if (target === 'DISBURSED') {
        const amount = values.disbursedAmount
        if (amount === null || amount === undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['disbursedAmount'],
            message: 'Vui lòng nhập số tiền giải ngân',
          })
        } else if (amount > MAX_AMOUNT) {
          ctx.addIssue({
            code: 'custom',
            path: ['disbursedAmount'],
            message: 'Số tiền tối đa là 100.000.000.000 ₫',
          })
        }
      }
    })
}

type FormInput = z.input<ReturnType<typeof createSchema>>
type FormOutput = z.output<ReturnType<typeof createSchema>>

type StatusChangeDialogProps = {
  lead: Lead
  /** The status to move to; null = closed. */
  target: LeadStatus | null
  onClose: () => void
}

/**
 * Confirm a status change, asking for the disbursed amount (DISBURSED) or a reason
 * (REJECTED, required here as a UI rule so the affiliate learns why).
 */
export function StatusChangeDialog({ lead, target, onClose }: StatusChangeDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {target && <StatusChangeForm key={target} lead={lead} target={target} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function StatusChangeForm({
  lead,
  target,
  onClose,
}: {
  lead: Lead
  target: LeadStatus
  onClose: () => void
}) {
  const changeStatus = useChangeLeadStatus()
  const schema = useMemo(() => createSchema(target), [target])
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      note: '',
      // Most loans are disbursed for the requested amount; staff can adjust it.
      disbursedAmount: target === 'DISBURSED' ? lead.requestedAmount : null,
    },
  })

  const onSubmit = handleSubmit((values) => {
    changeStatus.mutate(
      {
        lead,
        body: {
          status: target,
          ...(values.note && { note: values.note }),
          ...(target === 'DISBURSED' &&
            values.disbursedAmount != null && { disbursedAmount: values.disbursedAmount }),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${lead.code}: ${LEAD_STATUS_LABELS[target]}`)
          onClose()
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
          // 409: the lead changed under us and has been reloaded; this dialog is stale.
          if (isApiError(error) && error.status === 409) onClose()
        },
      },
    )
  })

  const rejecting = target === 'REJECTED'

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>
          {rejecting ? 'Từ chối lead' : `Chuyển sang “${LEAD_STATUS_LABELS[target]}”`}
        </DialogTitle>
        <DialogDescription>
          {lead.code} · {lead.customerName} · {LEAD_STATUS_LABELS[lead.status]} →{' '}
          {LEAD_STATUS_LABELS[target]}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4">
        {target === 'DISBURSED' && (
          <Controller
            control={control}
            name="disbursedAmount"
            render={({ field }) => (
              <FormField
                label="Số tiền giải ngân"
                error={errors.disbursedAmount}
                description="Hoa hồng của cộng tác viên được tính từ số tiền này."
              >
                {(controlProps) => (
                  <MoneyInput
                    {...controlProps}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    autoFocus
                  />
                )}
              </FormField>
            )}
          />
        )}
        <FormField
          label={rejecting ? 'Lý do từ chối' : 'Ghi chú (không bắt buộc)'}
          error={errors.note}
          description={rejecting ? 'Cộng tác viên sẽ thấy lý do này.' : undefined}
        >
          {(controlProps) => (
            <Textarea
              {...controlProps}
              rows={3}
              autoFocus={target !== 'DISBURSED'}
              {...register('note')}
            />
          )}
        </FormField>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button
          type="submit"
          variant={rejecting ? 'destructive' : 'default'}
          disabled={changeStatus.isPending}
        >
          {changeStatus.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          {rejecting ? 'Từ chối' : 'Xác nhận'}
        </Button>
      </DialogFooter>
    </form>
  )
}
