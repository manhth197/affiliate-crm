import { LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import { LEAD_TRANSITIONS, type Lead, type LeadStatus } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useStaff } from '@/features/catalog/queries'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { useAddLeadNote, useAssignLead } from './queries'
import { StatusChangeDialog } from './status-change-dialog'

const NOTE_MAX = 2000

/** Staff/admin actions on a lead: move it, assign it, add an internal note. */
export function LeadActionsCard({ lead }: { lead: Lead }) {
  const [target, setTarget] = useState<LeadStatus | null>(null)
  const next = LEAD_TRANSITIONS[lead.status]

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Xử lý lead</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <section aria-labelledby="lead-move-heading" className="space-y-2">
          <h3 id="lead-move-heading" className="text-sm font-medium">
            Chuyển trạng thái
          </h3>
          {next.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lead đã ở trạng thái cuối.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {next.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === 'REJECTED' ? 'destructive' : 'default'}
                  onClick={() => setTarget(status)}
                >
                  {status === 'REJECTED' ? 'Từ chối' : `→ ${LEAD_STATUS_LABELS[status]}`}
                </Button>
              ))}
            </div>
          )}
        </section>

        <Separator />
        <AssignForm lead={lead} />
        <Separator />
        <NoteForm leadId={lead.id} />
      </CardContent>
      <StatusChangeDialog lead={lead} target={target} onClose={() => setTarget(null)} />
    </Card>
  )
}

function AssignForm({ lead }: { lead: Lead }) {
  const staff = useStaff()
  const assign = useAssignLead()
  const current = lead.assignedStaff?.id ?? ''
  const [selected, setSelected] = useState(current)
  // Follow the lead when it is reassigned elsewhere (refetch after a change).
  const [lastCurrent, setLastCurrent] = useState(current)
  if (current !== lastCurrent) {
    setLastCurrent(current)
    setSelected(current)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!selected || selected === current) return
    assign.mutate(
      { leadId: lead.id, staffId: selected },
      {
        onSuccess: (updated) =>
          toast.success(`Đã giao ${updated.code} cho ${updated.assignedStaff?.fullName ?? ''}`),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="lead-assignee">Nhân viên phụ trách</Label>
      <div className="flex gap-2">
        <NativeSelect
          id="lead-assignee"
          className="w-full"
          value={selected}
          disabled={staff.isPending || staff.isError}
          onChange={(event) => setSelected(event.target.value)}
        >
          <NativeSelectOption value="" disabled>
            {staff.isError ? 'Không tải được danh sách' : 'Chọn nhân viên'}
          </NativeSelectOption>
          {staff.data?.map((member) => (
            <NativeSelectOption key={member.id} value={member.id}>
              {member.fullName}
              {member.role === 'ADMIN' ? ' (quản trị)' : ''}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          type="submit"
          variant="outline"
          disabled={!selected || selected === current || assign.isPending}
        >
          {assign.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Giao
        </Button>
      </div>
    </form>
  )
}

function NoteForm({ leadId }: { leadId: string }) {
  const addNote = useAddLeadNote()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = note.trim()
    if (!text) return setError('Vui lòng nhập nội dung ghi chú')
    if (text.length > NOTE_MAX) return setError('Ghi chú tối đa 2.000 ký tự')
    setError(null)
    addNote.mutate(
      { leadId, note: text },
      {
        onSuccess: () => {
          setNote('')
          toast.success('Đã thêm ghi chú')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor="lead-note">Ghi chú nội bộ</Label>
      <Textarea
        id="lead-note"
        rows={3}
        value={note}
        placeholder="Chỉ nhân viên và quản trị viên thấy ghi chú này"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'lead-note-error' : undefined}
        onChange={(event) => setNote(event.target.value)}
      />
      {error && (
        <p id="lead-note-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={addNote.isPending}>
          {addNote.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
          Thêm ghi chú
        </Button>
      </div>
    </form>
  )
}
