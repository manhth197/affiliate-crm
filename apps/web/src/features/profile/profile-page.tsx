import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { getErrorMessage } from '@/api/errors'
import { ME_QUERY_KEY, useCurrentUser } from '@/auth/auth-context'
import { ROLE_LABELS } from '@/auth/roles'
import { TextField } from '@/components/form/text-field'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldSeparator } from '@/components/ui/field'
import { applyServerFieldErrors } from '@/lib/form-errors'
import { FIELDS, type FormInput, type FormOutput, schema, toUpdateMeRequest } from './profile-form'

/** Common Vietnamese banks, offered as suggestions (any name is accepted). */
const BANKS = [
  'Vietcombank',
  'VietinBank',
  'BIDV',
  'Agribank',
  'Techcombank',
  'MB Bank',
  'ACB',
  'VPBank',
  'TPBank',
  'Sacombank',
  'HDBank',
  'VIB',
]

export function ProfilePage() {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const updateMe = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (me) => queryClient.setQueryData(ME_QUERY_KEY, me),
  })

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone,
      bankName: user.affiliate?.bankName ?? '',
      bankAccountNumber: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const body = toUpdateMeRequest(values, user)
    if (Object.keys(body).length === 0) {
      toast.info('Không có thay đổi nào')
      return
    }
    if (body.bankAccountNumber && !(body.bankName ?? user.affiliate?.bankName)) {
      setError('bankName', { type: 'manual', message: 'Vui lòng nhập tên ngân hàng' })
      return
    }
    try {
      const me = await updateMe.mutateAsync(body)
      reset({
        fullName: me.fullName,
        phone: me.phone,
        bankName: me.affiliate?.bankName ?? '',
        bankAccountNumber: '',
      })
      toast.success('Đã lưu thông tin tài khoản')
    } catch (error) {
      if (applyServerFieldErrors(error, FIELDS, setError)) return
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <>
      <PageHeader
        title="Tài khoản của tôi"
        description={`${user.email} · ${ROLE_LABELS[user.role]}`}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            <h2>Thông tin cá nhân</h2>
          </CardTitle>
          {user.affiliate && (
            <CardDescription>
              Mã giới thiệu:{' '}
              <span className="font-mono font-medium">{user.affiliate.referralCode}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              {formError && (
                <Alert variant="destructive">
                  <CircleAlert aria-hidden />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Họ và tên"
                  autoComplete="name"
                  error={errors.fullName}
                  {...register('fullName')}
                />
                <TextField
                  label="Số điện thoại"
                  type="tel"
                  autoComplete="tel"
                  error={errors.phone}
                  {...register('phone')}
                />
              </div>

              {user.affiliate && (
                <>
                  <FieldSeparator />
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Tài khoản nhận hoa hồng</h3>
                    <p className="text-sm text-muted-foreground">
                      {user.affiliate.bankAccountMasked
                        ? `Hiện tại: ${user.affiliate.bankName ?? ''} · ${user.affiliate.bankAccountMasked}`
                        : 'Chưa có tài khoản nhận tiền.'}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      label="Ngân hàng"
                      list="bank-suggestions"
                      autoComplete="off"
                      error={errors.bankName}
                      {...register('bankName')}
                    />
                    <datalist id="bank-suggestions">
                      {BANKS.map((bank) => (
                        <option key={bank} value={bank} />
                      ))}
                    </datalist>
                    <TextField
                      label="Số tài khoản mới"
                      inputMode="numeric"
                      autoComplete="off"
                      description="Để trống nếu không đổi. Chỉ 4 số cuối được hiển thị lại."
                      error={errors.bankAccountNumber}
                      {...register('bankAccountNumber')}
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
                  Lưu thay đổi
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
