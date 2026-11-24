import { Columns3, List } from 'lucide-react'
import { useCurrentUser } from '@/auth/auth-context'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useProducts, useStaff } from '@/features/catalog/queries'
import { LeadFilters } from './lead-filters'
import { LeadKanban } from './lead-kanban'
import { LeadListView } from './lead-list'
import { type PipelineView, useLeadFilters } from './use-lead-filters'

/** Staff/admin view of all leads: kanban (default) or table, sharing the same filters. */
export function PipelinePage() {
  const user = useCurrentUser()
  const { query, baseQuery, view, hasFilters, update } = useLeadFilters({
    currentUserId: user.id,
  })
  const products = useProducts()
  const staff = useStaff()

  const setView = (next: PipelineView) => update({ view: next === 'kanban' ? null : next })

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          view === 'kanban'
            ? 'Kéo thẻ (bằng tay nắm) sang cột khác để đổi trạng thái lead.'
            : 'Toàn bộ lead của cộng tác viên, mới nhất trước.'
        }
        actions={
          <div role="group" aria-label="Kiểu hiển thị" className="flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'kanban'}
              onClick={() => setView('kanban')}
            >
              <Columns3 aria-hidden />
              Kanban
            </Button>
            <Button
              size="sm"
              variant={view === 'table' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'table'}
              onClick={() => setView('table')}
            >
              <List aria-hidden />
              Bảng
            </Button>
          </div>
        }
      />
      <div className="space-y-4">
        <LeadFilters
          products={products.data ?? []}
          staff={staff.data ?? []}
          hideStatus={view === 'kanban'}
        />
        {view === 'kanban' ? (
          <LeadKanban baseQuery={baseQuery} />
        ) : (
          <LeadListView
            query={query}
            backOffice
            hasFilters={hasFilters}
            onPageChange={(page) => update({ page })}
            empty={{
              title: 'Chưa có lead nào',
              description: 'Lead mới từ cộng tác viên sẽ xuất hiện ở đây.',
            }}
          />
        )}
      </div>
    </>
  )
}
