import { type ComponentProps, useId } from 'react'
import type { FieldError as RhfFieldError } from 'react-hook-form'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type TextFieldProps = ComponentProps<typeof Input> & {
  label: string
  error?: RhfFieldError
  description?: string
}

/** Label + input + error message, wired for accessibility. Spread `register('name')` into it. */
export function TextField({ label, error, description, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`
  const errorId = `${inputId}-error`
  const describedBy =
    [description && descriptionId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      <FieldError id={errorId} errors={[error]} />
    </Field>
  )
}
