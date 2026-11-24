import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'

type PlaceholderPageProps = {
  title: string
  description?: string
}

/** Temporary page for routes whose feature lands in a later milestone. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Construction className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Tính năng đang được xây dựng</p>
          <p className="text-sm text-muted-foreground">
            Trang này sẽ có trong phiên bản tiếp theo.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
