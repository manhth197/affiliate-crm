import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleAlert, LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import type { Product, ProductCategory } from '@/api/types'
import { QueryErrorAlert } from '@/components/feedback'
import { FormField } from '@/components/form/form-field'
import { MoneyInput } from '@/components/form/money-input'
import { TextField } from '@/components/form/text-field'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { catalogKeys, useProducts } from '@/features/catalog/queries'
import { applyServerFieldErrors } from '@/lib/form-errors'
import { describeCommission, PRODUCT_CATEGORY_LABELS } from '@/lib/labels'
import {
  createLeadFormSchema,
  type LeadFormInput,
  type LeadFormValues,
  toCreateLeadRequest,
} from './lead-form-schema'
import { useCreateLead } from './queries'

const SERVER_FIELDS = [
  'productId',
  'customerName',
  'customerPhone',
  'customerNationalId',
  'requestedAmount',
  'note',
] as const

export function LeadCreatePage() {
  const products = useProducts({ active: true })

  return (
    <>
      <PageHeader
        title="Giới thiệu khách hàng"
        description="Gửi thông tin khách có nhu cầu. Nhân viên sẽ liên hệ tư vấn và cập nhật tiến độ cho bạn."
        actions={
          <Button asChild variant="ghost">
            <Link to="/leads">
              <ArrowLeft aria-hidden />
              Lead của tôi
            </Link>
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent>
          {products.isError ? (
            <QueryErrorAlert error={products.error} onRetry={() => void products.refetch()} />
          ) : products.isPending ? (
            <div className="space-y-4" aria-busy="true" aria-label="Đang tải biểu mẫu">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <LeadForm products={products.data} />
          )}
        </CardContent>
      </Card>
    </>
  )
}

const CATEGORY_ORDER: ProductCategory[] = ['LOAN', 'CREDIT_CARD', 'INSURANCE']

function LeadForm({ products }: { products: Product[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const createLead = useCreateLead()
  const [formError, setFormError] = useState<string | null>(null)
  const schema = useMemo(() => createLeadFormSchema(products), [products])

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormInput, unknown, LeadFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      productId: '',
      customerName: '',
      customerPhone: '',
      customerNationalId: '',
      requestedAmount: null,
      note: '',
    },
  })

  const productId = useWatch({ control, name: 'productId' })
  const product = products.find((p) => p.id === productId)
  const isLoan = product?.category === 'LOAN'

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const lead = await createLead.mutateAsync(toCreateLeadRequest(values, product))
      toast.success(`Đã gửi lead ${lead.code}`, {
        description: 'Nhân viên sẽ liên hệ khách hàng trong thời gian sớm nhất.',
      })
      // Replace, so "back" from the detail page returns to the list, not to an empty form.
      void navigate(`/leads/${lead.id}`, { replace: true })
    } catch (error) {
      if (applyServerFieldErrors(error, SERVER_FIELDS, setError)) return
      if (hasErrorCode(error, 'PRODUCT_UNAVAILABLE')) {
        // Our product list is stale: reload it so the product disappears from the select.
        void queryClient.invalidateQueries({ queryKey: catalogKeys.all })
        setError('productId', { type: 'server', message: getErrorMessage(error) })
        return
      }
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          label="Sản phẩm"
          error={errors.productId}
          description={
            product
              ? `${product.partnerName} · Hoa hồng: ${describeCommission(product.commissionType, product.commissionValue)}`
              : undefined
          }
        >
          {(controlProps) => (
            <NativeSelect className="w-full" {...controlProps} {...register('productId')}>
              <NativeSelectOption value="">Chọn sản phẩm</NativeSelectOption>
              {CATEGORY_ORDER.map((category) => {
                const items = products.filter((p) => p.category === category)
                if (items.length === 0) return null
                return (
                  <NativeSelectOptGroup key={category} label={PRODUCT_CATEGORY_LABELS[category]}>
                    {items.map((p) => (
                      <NativeSelectOption key={p.id} value={p.id}>
                        {p.name} — {p.partnerName}
                      </NativeSelectOption>
                    ))}
                  </NativeSelectOptGroup>
                )
              })}
            </NativeSelect>
          )}
        </FormField>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Họ tên khách hàng"
            autoComplete="off"
            error={errors.customerName}
            {...register('customerName')}
          />
          <TextField
            label="Số điện thoại khách hàng"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="0912345678"
            error={errors.customerPhone}
            {...register('customerPhone')}
          />
        </div>

        <TextField
          label="Số CMND/CCCD (không bắt buộc)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="9 hoặc 12 chữ số"
          maxLength={12}
          error={errors.customerNationalId}
          {...register('customerNationalId')}
        />

        {isLoan && (
          <Controller
            control={control}
            name="requestedAmount"
            render={({ field }) => (
              <FormField
                label="Số tiền khách muốn vay"
                error={errors.requestedAmount}
                description="Đơn vị: đồng. Số tiền giải ngân thực tế do đối tác quyết định."
              >
                {(controlProps) => (
                  <MoneyInput
                    {...controlProps}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="50.000.000"
                  />
                )}
              </FormField>
            )}
          />
        )}

        <FormField label="Ghi chú cho nhân viên (không bắt buộc)" error={errors.note}>
          {(controlProps) => (
            <Textarea
              {...controlProps}
              rows={3}
              placeholder="Ví dụ: khách tiện nghe máy sau 17h"
              {...register('note')}
            />
          )}
        </FormField>

        <p className="text-xs text-muted-foreground">
          Bằng việc gửi thông tin, bạn xác nhận khách hàng đã đồng ý để đối tác liên hệ tư vấn.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="outline">
            <Link to="/leads">Hủy</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
            Gửi thông tin
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
