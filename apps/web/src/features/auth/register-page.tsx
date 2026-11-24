import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { getErrorMessage, hasErrorCode, isApiError } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { TextField } from '@/components/form/text-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { applyServerFieldErrors } from '@/lib/form-errors'
import { emailField, fullNameField, newPasswordField, phoneField } from '@/lib/validation'

const registerSchema = z
  .object({
    fullName: fullNameField,
    email: emailField,
    phone: phoneField,
    password: newPasswordField,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })

const SERVER_FIELDS = ['fullName', 'email', 'phone', 'password'] as const

export function RegisterPage() {
  const { register: registerAccount } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirm, ...body }) => {
    setFormError(null)
    try {
      const user = await registerAccount(body)
      toast.success('Đăng ký thành công', {
        description: user.affiliate
          ? `Mã giới thiệu của bạn là ${user.affiliate.referralCode}.`
          : undefined,
      })
    } catch (error) {
      // EMAIL_TAKEN since contract v0.3; plain 409 kept for older API builds.
      if (hasErrorCode(error, 'EMAIL_TAKEN') || (isApiError(error) && error.status === 409)) {
        setError('email', { type: 'server', message: 'Email này đã được đăng ký' })
        return
      }
      if (applyServerFieldErrors(error, SERVER_FIELDS, setError)) return
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Đăng ký cộng tác viên</h1>
        </CardTitle>
        <CardDescription>
          Tạo tài khoản để giới thiệu khách hàng và nhận hoa hồng. Mã giới thiệu được cấp tự động.
        </CardDescription>
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
            <TextField
              label="Họ và tên"
              autoComplete="name"
              error={errors.fullName}
              {...register('fullName')}
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="ban@vidu.vn"
              error={errors.email}
              {...register('email')}
            />
            <TextField
              label="Số điện thoại"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0912345678"
              error={errors.phone}
              {...register('phone')}
            />
            <TextField
              label="Mật khẩu"
              type="password"
              autoComplete="new-password"
              description="Tối thiểu 8 ký tự."
              error={errors.password}
              {...register('password')}
            />
            <TextField
              label="Nhập lại mật khẩu"
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword}
              {...register('confirmPassword')}
            />
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Tạo tài khoản
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Đăng nhập
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
