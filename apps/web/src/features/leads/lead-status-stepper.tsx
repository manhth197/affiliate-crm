import { cn } from 'cn'
import { Check, X } from 'lucide-react'
import type { LeadActivity, LeadStatus } from '@/api/types'
import { LEAD_STATUS_LABELS } from '@/lib/labels'

const STEPS: readonly LeadStatus[] = ['NEW', 'CONTACTED', 'SUBMITTED', 'APPROVED', 'DISBURSED']

/**
 * Where the lead is in the pipeline. For a rejected lead, the step where it stopped is shown
 * (taken from the last status change in the timeline).
 */
export function LeadStatusStepper({
  status,
  activities,
}: {
  status: LeadStatus
  activities?: LeadActivity[]
}) {
  const rejected = status === 'REJECTED'
  const rejectedFrom = rejected
    ? activities?.find((a) => a.toStatus === 'REJECTED')?.fromStatus
    : undefined
  const reached = rejected
    ? rejectedFrom
      ? STEPS.indexOf(rejectedFrom)
      : 0
    : STEPS.indexOf(status)

  return (
    <ol aria-label="Tiến trình hồ sơ" className="grid grid-cols-5 gap-1">
      {STEPS.map((step, index) => {
        const done = index <= reached
        const stoppedHere = rejected && index === reached + 1
        const current = !rejected && index === reached
        return (
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1',
                  index === 0 ? 'invisible' : done || stoppedHere ? 'bg-primary' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                  done && 'border-primary bg-primary text-primary-foreground',
                  stoppedHere && 'border-destructive bg-destructive text-white',
                  !done && !stoppedHere && 'bg-background text-muted-foreground',
                )}
              >
                {stoppedHere ? (
                  <X className="size-4" aria-hidden />
                ) : done ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'h-0.5 flex-1',
                  index === STEPS.length - 1
                    ? 'invisible'
                    : index < reached
                      ? 'bg-primary'
                      : 'bg-border',
                )}
              />
            </div>
            <span
              className={cn(
                'text-[11px] leading-tight sm:text-xs',
                current
                  ? 'font-medium text-foreground'
                  : stoppedHere
                    ? 'font-medium text-destructive'
                    : 'text-muted-foreground',
              )}
            >
              {stoppedHere ? LEAD_STATUS_LABELS.REJECTED : LEAD_STATUS_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
