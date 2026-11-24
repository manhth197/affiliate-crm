import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/errors'
import type { Product, ProductCategory } from '@/api/types'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { describeCommission, PRODUCT_CATEGORY_LABELS } from '@/lib/labels'
import { ProductFormDialog } from './product-form-dialog'
import { useProducts, useUpdateProduct } from './queries'

const CATEGORY_ORDER: ProductCategory[] = ['LOAN', 'CREDIT_CARD', 'INSURANCE']

/** ADMIN: product catalogue and commission rules. */
export function ProductsPage() {
  const products = useProducts()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const sorted = [...(products.data ?? [])].sort(
    (a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name, 'vi'),
  )

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        description="Sản phẩm tài chính cộng tác viên có thể giới thiệu, và luật hoa hồng của từng sản phẩm."
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Thêm sản phẩm
          </Button>
        }
      />

      {products.isError ? (
        <QueryErrorAlert error={products.error} onRetry={() => void products.refetch()} />
      ) : (
        <Card className="py-0">
          {products.isPending ? (
            <div className="space-y-3 p-4" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState title="Chưa có sản phẩm" description="Thêm sản phẩm đầu tiên để bắt đầu." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Sản phẩm</TableHead>
                  <TableHead className="hidden sm:table-cell">Nhóm</TableHead>
                  <TableHead>Hoa hồng</TableHead>
                  <TableHead>Nhận hồ sơ</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Thao tác</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onEdit={() => setEditing(product)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      <ProductFormDialog product={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
  const update = useUpdateProduct()

  function toggleActive(active: boolean) {
    update.mutate(
      { id: product.id, body: { active } },
      {
        onSuccess: () =>
          toast.success(
            active ? `Đã mở lại “${product.name}”` : `Đã tạm ngừng nhận hồ sơ “${product.name}”`,
          ),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    )
  }

  return (
    <TableRow className={product.active ? undefined : 'text-muted-foreground'}>
      <TableCell className="pl-4">
        <div className="font-medium text-foreground">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.partnerName}</div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant="secondary">{PRODUCT_CATEGORY_LABELS[product.category]}</Badge>
      </TableCell>
      <TableCell className="whitespace-normal">
        {describeCommission(product.commissionType, product.commissionValue)}
      </TableCell>
      <TableCell>
        <Switch
          checked={product.active}
          disabled={update.isPending}
          onCheckedChange={toggleActive}
          aria-label={`Nhận hồ sơ: ${product.name}`}
        />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Sửa ${product.name}`}>
          <Pencil aria-hidden />
        </Button>
      </TableCell>
    </TableRow>
  )
}
