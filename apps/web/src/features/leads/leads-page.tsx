import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useProducts } from '@/features/catalog/queries'
import { LeadFilters } from './lead-filters'
import { LeadListView } from './lead-list'
import { useLeadFilters } from './use-lead-filters'

/** Affiliate: "my leads". Staff and admins get the pipeline instead (see routes). */
export function LeadsPage() {
  const { query, hasFilters, update } = useLeadFilters()
  const products = useProducts()

  return (
    <>
      <PageHeader
        title="Lead của tôi"
        description="Theo dõi trạng thái các khách hàng bạn đã giới thiệu."
        actions={
          <Button asChild>
            <Link to="/leads/new">
              <Plus aria-hidden />
              Giới thiệu khách hàng
            </Link>
          </Button>
        }
      />
      <div className="space-y-4">
        <LeadFilters products={products.data ?? []} />
        <LeadListView
          query={query}
          backOffice={false}
          hasFilters={hasFilters}
          onPageChange={(page) => update({ page })}
          empty={{
            title: 'Chưa có lead nào',
            description: 'Giới thiệu khách hàng đầu tiên để bắt đầu nhận hoa hồng.',
            action: (
              <Button asChild>
                <Link to="/leads/new">Giới thiệu khách hàng</Link>
              </Button>
            ),
          }}
        />
      </div>
    </>
  )
}
