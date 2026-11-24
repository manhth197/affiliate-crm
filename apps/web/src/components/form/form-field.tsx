import { type ReactNode, useId } from 'react'
import type { FieldError as RhfFieldError } from 'react-hook-form'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

export type ControlProps = {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

type FormFieldProps = {
  label: ReactNode
  error?: RhfFieldError
  description?: ReactNode
  id?: string
  /** Render the control with the ids and ARIA attributes that link it to label/description/error. */
  children: (control: ControlProps) => ReactNode
}

/** Label + any control + description + error message, wired for screen readers. */
export function FormField({ label, error, description, id, children }: FormFieldProps) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const descriptionId = `${controlId}-description`
  const errorId = `${controlId}-error`
  const describedBy =
    [description && descriptionId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
      {children({
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {description && <FieldDescription id={descriptionId}>{description}</FieldDescription>}
      <FieldError id={errorId} errors={[error]} />
    </Field>
  )
}
