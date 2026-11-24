import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { getErrorMessage, hasErrorCode } from '@/api/errors'
import type { User } from '@/api/types'
import { FormField } from '@/components/form/form-field'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { applyServerFieldErrors } from '@/lib/form-errors'
import { emailField, fullNameField, newPasswordField, phoneField } from '@/lib/validation'
import { useCreateUser, useUpdateUser } from './queries'

function FormErrorAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

// ---- Create a STAFF or ADMIN account ----
const createSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  phone: phoneField,
  password: newPasswordField,
  role: z.enum(['STAFF', 'ADMIN']),
})
type CreateInput = z.input<typeof createSchema>
type CreateOutput = z.output<typeof createSchema>
const CREATE_FIELDS = ['fullName', 'email', 'phone', 'password', 'role'] as const

export function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{open && <CreateUserForm onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function CreateUserForm({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(createSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', role: 'STAFF' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const user = await createUser.mutateAsync(values)
      toast.success(`Đã tạo tài khoản cho ${user.fullName}`)
      onClose()
    } catch (error) {
      if (hasErrorCode(error, 'EMAIL_TAKEN')) {
        setError('email', { type: 'server', message: 'Email này đã được sử dụng' })
        return
      }
      if (applyServerFieldErrors(error, CREATE_FIELDS, setError)) return
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Thêm nhân viên</DialogTitle>
        <DialogDescription>
          Tạo tài khoản cho nhân viên hoặc quản trị viên. Cộng tác viên tự đăng ký ở trang đăng ký.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-4">
        <FormErrorAlert message={formError} />
        <TextField label="Họ và tên" error={errors.fullName} {...register('fullName')} />
        <TextField label="Email" type="email" error={errors.email} {...register('email')} />
        <TextField label="Số điện thoại" type="tel" error={errors.phone} {...register('phone')} />
        <TextField
          label="Mật khẩu tạm"
          type="password"
          autoComplete="new-password"
          description="Tối thiểu 8 ký tự. Gửi cho người dùng qua kênh an toàn."
          error={errors.password}
          {...register('password')}
        />
        <FormField label="Vai trò" error={errors.role}>
          {(controlProps) => (
            <NativeSelect className="w-full" {...controlProps} {...register('role')}>
              <NativeSelectOption value="STAFF">Nhân viên</NativeSelectOption>
              <NativeSelectOption value="ADMIN">Quản trị viên</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          Tạo tài khoản
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---- Edit name and phone ----
const editSchema = z.object({ fullName: fullNameField, phone: phoneField })
type EditInput = z.input<typeof editSchema>
type EditOutput = z.output<typeof editSchema>

export function EditUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  return (
    <Dialog open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {user && <EditUserForm key={user.id} user={user} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditUserForm({ user, onClose }: { user: User; onClose: () => void }) {
  const updateUser = useUpdateUser()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditInput, unknown, EditOutput>({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: user.fullName, phone: user.phone },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await updateUser.mutateAsync({ id: user.id, body: values })
      toast.success('Đã lưu thông tin')
      onClose()
    } catch (error) {
      if (applyServerFieldErrors(error, ['fullName', 'phone'] as const, setError)) return
      setFormError(getErrorMessage(error))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogHeader>
        <DialogTitle>Sửa thông tin</DialogTitle>
        <DialogDescription>{user.email}</DialogDescription>
      </DialogHeader>
      <FieldGroup className="my-4">
        <FormErrorAlert message={formError} />
        <TextField label="Họ và tên" error={errors.fullName} {...register('fullName')} />
        <TextField label="Số điện thoại" type="tel" error={errors.phone} {...register('phone')} />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          Lưu
        </Button>
      </DialogFooter>
    </form>
  )
}
