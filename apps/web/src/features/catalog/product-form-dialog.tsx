import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type { CreateProductRequest } from '@/api/catalog'
import { getErrorMessage } from '@/api/errors'
import type { CommissionType, Product, ProductCategory } from '@/api/types'
import { FormField } from '@/components/form/form-field'
import { MoneyInput } from '@/components/form/money-input'
import { TextField } from '@/components/form/text-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { applyServerFieldErrors } from '@/lib/form-errors'
import { PRODUCT_CATEGORY_LABELS } from '@/lib/labels'
import { basisPointsToPercent, percentToBasisPoints } from './commission-input'
import { useCreateProduct, useUpdateProduct } from './queries'

const CATEGORIES = Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]
const MAX_FIXED = 1_000_000_000

const schema = z
  .object({
    name: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm').max(150, 'Tối đa 150 ký tự'),
    partnerName: z.string().trim().min(1, 'Vui lòng nhập tên đối tác').max(100, 'Tối đa 100 ký tự'),
    category: z.enum(['LOAN', 'CREDIT_CARD', 'INSURANCE']),
    commissionType: z.enum(['PERCENT', 'FIXED']),
    percent: z.string(),
    fixedAmount: z.number().int().nullish(),
    active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.commissionType === 'PERCENT') {
      const bp = percentToBasisPoints(values.percent)
      if (bp === null || bp > 10_000) {
        ctx.addIssue({
          code: 'custom',
          path: ['percent'],
          message: 'Nhập phần trăm từ 0 đến 100, tối đa 2 chữ số thập phân (ví dụ 1,5)',
        })
      }
    } else if (values.fixedAmount == null || values.fixedAmount > MAX_FIXED) {
      ctx.addIssue({
        code: 'custom',
        path: ['fixedAmount'],
        message: 'Nhập số tiền từ 0 đến 1.000.000.000 ₫',
      })
    }
  })

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

function toRequest(values: FormOutput): CreateProductRequest {
  return {
    name: values.name,
    partnerName: values.partnerName,
    category: values.category,
    commissionType: values.commissionType,
    commissionValue:
      values.commissionType === 'PERCENT'
        ? percentToBasisPoints(values.percent)!
        : values.fixedAmount!,
    active: values.active,
  }
}

type ProductFormDialogProps = {
  /** A product to edit, "new" to create one, or null when closed. */
  product: Product | 'new' | null
  onClose: () => void
}

export function ProductFormDialog({ product, onClose }: ProductFormDialogProps) {
  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {product && (
          <ProductForm
            key={product === 'new' ? 'new' : product.id}
            product={product === 'new' ? null : product}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

const FIELDS = ['name', 'partnerName', 'category', 'commissionType', 'active'] as const

function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      partnerName: product?.partnerName ?? '',
      category: product?.category ?? 'LOAN',
      commissionType: product?.commissionType ?? 'PERCENT',
      percent:
        product?.commissionType === 'PERCENT' ? basisPointsToPercent(product.commissionValue) : '',
      fixedAmount: product?.commissionType === 'FIXED' ? product.commissionValue : null,
      active: product?.active ?? true,
    },
  })
  const commissionType = useWatch({ control, name: 'commissionType' }) as CommissionType

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const body = toRequest(values)
    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, body })
        toast.success(`Đã cập nhật “${body.name}”`)
      } else {
        await createProduct.mutateAsync(body)
        toast.success(`Đã thêm “${body.name}”`)
      }
      onClose()
    } catch (error) {
      if (applyServerFieldErrors(error, FIELDS, setError)) return
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
        <DialogDescription>
          {product
            ? 'Thay đổi luật hoa hồng chỉ áp dụng cho các hoa hồng được tạo sau này.'
            : 'Sản phẩm đang nhận hồ sơ sẽ hiện ngay trong form giới thiệu của cộng tác viên.'}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="my-4">
        {formError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <TextField label="Tên sản phẩm" error={errors.name} {...register('name')} />
        <TextField label="Đối tác" error={errors.partnerName} {...register('partnerName')} />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Nhóm sản phẩm" error={errors.category}>
            {(controlProps) => (
              <NativeSelect className="w-full" {...controlProps} {...register('category')}>
                {CATEGORIES.map((category) => (
                  <NativeSelectOption key={category} value={category}>
                    {PRODUCT_CATEGORY_LABELS[category]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label="Cách tính hoa hồng" error={errors.commissionType}>
            {(controlProps) => (
              <NativeSelect className="w-full" {...controlProps} {...register('commissionType')}>
                <NativeSelectOption value="PERCENT">% số tiền giải ngân</NativeSelectOption>
                <NativeSelectOption value="FIXED">Số tiền cố định / hồ sơ</NativeSelectOption>
              </NativeSelect>
            )}
          </FormField>
        </div>

        {commissionType === 'PERCENT' ? (
          <FormField label="Tỉ lệ hoa hồng (%)" error={errors.percent} description="Ví dụ: 1,5">
            {(controlProps) => (
              <div className="relative">
                <input
                  {...controlProps}
                  {...register('percent')}
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 pr-8 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm"
                />
                <span
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-hidden
                >
                  %
                </span>
              </div>
            )}
          </FormField>
        ) : (
          <Controller
            control={control}
            name="fixedAmount"
            render={({ field }) => (
              <FormField label="Hoa hồng mỗi hồ sơ thành công" error={errors.fixedAmount}>
                {(controlProps) => (
                  <MoneyInput
                    {...controlProps}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </FormField>
            )}
          />
        )}

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch id="product-active" checked={field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="product-active">Đang nhận hồ sơ</Label>
            </div>
          )}
        />
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          {product ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
        </Button>
      </DialogFooter>
    </form>
  )
}
