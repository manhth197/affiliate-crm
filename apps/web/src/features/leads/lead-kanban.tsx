import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  type KeyboardCoordinateGetter,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { cn } from 'cn'
import { GripVertical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import { LEAD_STATUSES, type Lead, type LeadQuery, type LeadStatus } from '@/api/types'
import { LeadStatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatRelative, formatVnd, getInitials } from '@/lib/format'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { useChangeLeadStatus, useLeads } from './queries'
import { StatusChangeDialog } from './status-change-dialog'
import { canMove, leadAmount, planDrop } from './lead-rules'

const CLOSED: readonly LeadStatus[] = ['DISBURSED', 'REJECTED']

/**
 * One request per column. Open columns: up to 100 leads, the one waiting longest first.
 * Closed columns: only the 20 most recent (the rest is in the table view).
 */
function columnQuery(base: LeadQuery, status: LeadStatus): LeadQuery {
  const closed = CLOSED.includes(status)
  return {
    ...base,
    status,
    page: 1,
    pageSize: closed ? 20 : 100,
    sort: closed ? 'updatedAt:desc' : 'updatedAt:asc',
  }
}

const label = (status: LeadStatus) => LEAD_STATUS_LABELS[status]
const leadOf = (data: Record<string, unknown> | undefined) => data?.lead as Lead | undefined

/** Pointer: the column under the pointer. Keyboard: the column the card overlaps most. */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args)
  return underPointer.length > 0 ? underPointer : rectIntersection(args)
}

/** Keyboard dragging: left/right arrows jump to the previous/next column. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') return undefined
  event.preventDefault()
  const { collisionRect, droppableRects, droppableContainers } = context
  if (!collisionRect) return undefined
  const center = collisionRect.left + collisionRect.width / 2
  const columns = droppableContainers
    .getEnabled()
    .map((container) => droppableRects.get(container.id))
    .filter((rect) => rect !== undefined)
    .sort((a, b) => a.left - b.left)
  const target =
    event.code === 'ArrowRight'
      ? columns.find((rect) => rect.left + rect.width / 2 > center + 1)
      : columns.findLast((rect) => rect.left + rect.width / 2 < center - 1)
  if (!target) return undefined
  return { x: target.left + (target.width - collisionRect.width) / 2, y: target.top + 48 }
}

const announcements: Announcements = {
  onDragStart: ({ active }) => `Đã nhấc lead ${leadOf(active.data.current)?.customerName ?? ''}.`,
  onDragOver: ({ active, over }) => {
    const lead = leadOf(active.data.current)
    if (!over || !lead) return 'Không ở trên cột nào.'
    const to = over.id as LeadStatus
    const allowed = to === lead.status || canMove(lead.status, to)
    return `Đang ở cột ${label(to)}${allowed ? '' : ', không thể chuyển sang đây'}.`
  },
  onDragEnd: ({ over }) => (over ? `Đã thả vào cột ${label(over.id as LeadStatus)}.` : 'Đã thả.'),
  onDragCancel: () => 'Đã hủy kéo thả.',
}

const screenReaderInstructions = {
  draggable:
    'Nhấn Space để nhấc thẻ, dùng mũi tên trái hoặc phải để chọn cột, Space để thả, Esc để hủy.',
}

/** Pipeline as columns per status; drag a card (by its handle) to change the status. */
export function LeadKanban({ baseQuery }: { baseQuery: LeadQuery }) {
  const changeStatus = useChangeLeadStatus()
  const [dragging, setDragging] = useState<Lead | null>(null)
  const [pending, setPending] = useState<{ lead: Lead; target: LeadStatus } | null>(null)
  const sensors = useSensors(
    // Drags start from the handle only, so a small distance is enough and links stay clickable.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  )

  function onDragStart({ active }: DragStartEvent) {
    setDragging(leadOf(active.data.current) ?? null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null)
    const lead = leadOf(active.data.current)
    if (!lead) return
    const target = over?.id as LeadStatus | undefined
    switch (planDrop(lead.status, target)) {
      case 'invalid':
        toast.error(`Không thể chuyển từ “${label(lead.status)}” sang “${label(target!)}”.`)
        return
      case 'dialog':
        setPending({ lead, target: target! })
        return
      case 'direct':
        changeStatus.mutate(
          { lead, body: { status: target! } },
          {
            onSuccess: (updated) => toast.success(`${updated.code}: ${label(updated.status)}`),
            onError: (error) => toast.error(getErrorMessage(error)),
          },
        )
        return
      case 'ignore':
        return
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements, screenReaderInstructions }}
      onDragStart={onDragStart}
      onDragCancel={() => setDragging(null)}
      onDragEnd={onDragEnd}
    >
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {LEAD_STATUSES.map((status) => (
          <KanbanColumn key={status} status={status} baseQuery={baseQuery} dragging={dragging} />
        ))}
      </div>
      <DragOverlay>{dragging ? <LeadCardBody lead={dragging} lifted /> : null}</DragOverlay>
      {pending && (
        <StatusChangeDialog
          lead={pending.lead}
          target={pending.target}
          onClose={() => setPending(null)}
        />
      )}
    </DndContext>
  )
}

function KanbanColumn({
  status,
  baseQuery,
  dragging,
}: {
  status: LeadStatus
  baseQuery: LeadQuery
  dragging: Lead | null
}) {
  const leads = useLeads(columnQuery(baseQuery, status))
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const isSource = dragging?.status === status
  const allowed = dragging ? canMove(dragging.status, status) : false
  const total = leads.data?.meta.total ?? 0
  const shown = leads.data?.data.length ?? 0

  return (
    <section
      ref={setNodeRef}
      aria-label={`Cột ${label(status)}`}
      className={cn(
        'flex w-72 shrink-0 snap-start flex-col rounded-xl bg-muted/70 p-2 transition',
        dragging && !allowed && !isSource && 'opacity-50',
        allowed && 'ring-2 ring-primary/30',
        allowed && isOver && 'bg-primary/10 ring-primary/60',
      )}
    >
      <header className="flex items-center justify-between px-1 pb-2">
        <LeadStatusBadge status={status} />
        <span className="text-xs text-muted-foreground tabular-nums" aria-label={`${total} lead`}>
          {leads.isPending ? '…' : formatNumber(total)}
        </span>
      </header>
      <div className="flex max-h-[calc(100svh-17rem)] min-h-24 flex-col gap-2 overflow-y-auto">
        {leads.isPending ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : leads.isError ? (
          <p className="p-2 text-sm text-destructive">{getErrorMessage(leads.error)}</p>
        ) : shown === 0 ? (
          <p className="p-2 text-center text-xs text-muted-foreground">Không có lead</p>
        ) : (
          leads.data.data.map((lead) => <DraggableLeadCard key={lead.id} lead={lead} />)
        )}
        {total > shown && (
          <Link
            to={`/leads?view=table&status=${status}`}
            className="p-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Xem tất cả {formatNumber(total)} lead
          </Link>
        )}
      </div>
    </section>
  )
}

function DraggableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })
  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-40')}>
      <LeadCardBody
        lead={lead}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="-m-1 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label={`Kéo ${lead.code} ${lead.customerName} sang cột khác`}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </div>
  )
}

function LeadCardBody({
  lead,
  handle,
  lifted = false,
}: {
  lead: Lead
  handle?: React.ReactNode
  lifted?: boolean
}) {
  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-3 text-sm shadow-xs',
        lifted && 'rotate-1 shadow-lg ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/leads/${lead.id}`} className="font-medium hover:underline">
            {lead.customerName}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {lead.code} · {lead.product.name}
          </p>
        </div>
        {handle}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">
          {formatVnd(leadAmount(lead))}
        </span>
        <span title={`Cập nhật ${formatRelative(lead.updatedAt)}`}>
          {formatRelative(lead.updatedAt)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">CTV: {lead.affiliate.fullName}</span>
        {lead.assignedStaff ? (
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground"
            title={`Phụ trách: ${lead.assignedStaff.fullName}`}
            aria-label={`Phụ trách: ${lead.assignedStaff.fullName}`}
          >
            {getInitials(lead.assignedStaff.fullName)}
          </span>
        ) : (
          <span className="shrink-0 text-amber-700">Chưa giao</span>
        )}
      </div>
    </article>
  )
}
