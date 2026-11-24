import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { getErrorMessage } from '@/api/errors'
import { useAuth } from '@/auth/auth-context'
import { ROLE_LABELS } from '@/auth/roles'
import { TextField } from '@/components/form/text-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { config } from '@/config'
import { emailField } from '@/lib/validation'

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

/** Seed accounts from the API contract, shown in dev/mock mode to make demos easy. */
const DEMO_ACCOUNTS = [
  { email: 'admin@demo.vn', role: 'ADMIN' },
  { email: 'staff@demo.vn', role: 'STAFF' },
  { email: 'ctv1@demo.vn', role: 'AFFILIATE' },
] as const
const DEMO_PASSWORD = 'Demo@12345'
const SHOW_DEMO_ACCOUNTS = config.useMocks || import.meta.env.DEV

export function LoginPage() {
  const { login } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // On success <GuestOnly> redirects to the page the user wanted (or home).
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values)
    } catch (error) {
      setFormError(
        getErrorMessage(error, {
          401: 'Email hoặc mật khẩu không đúng.',
          403: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
        }),
      )
    }
  })

  function fillDemoAccount(email: string) {
    setValue('email', email, { shouldValidate: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: true })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Đăng nhập</h1>
        </CardTitle>
        <CardDescription>Nhập email và mật khẩu để tiếp tục.</CardDescription>
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
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="ban@vidu.vn"
              error={errors.email}
              {...register('email')}
            />
            <TextField
              label="Mật khẩu"
              type="password"
              autoComplete="current-password"
              error={errors.password}
              {...register('password')}
            />
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Đăng nhập
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Đăng ký làm cộng tác viên
              </Link>
            </p>
          </FieldGroup>
        </form>

        {SHOW_DEMO_ACCOUNTS && (
          <div className="mt-6 rounded-lg border border-dashed p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Tài khoản demo (mật khẩu {DEMO_PASSWORD})
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fillDemoAccount(account.email)}
                >
                  {ROLE_LABELS[account.role]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
