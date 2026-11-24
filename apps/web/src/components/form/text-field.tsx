import type { ComponentProps } from 'react'
import type { FieldError as RhfFieldError } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { FormField } from './form-field'

type TextFieldProps = ComponentProps<typeof Input> & {
  label: string
  error?: RhfFieldError
  description?: string
}

/** Label + input + error message. Spread `register('name')` into it. */
export function TextField({ label, error, description, id, ...inputProps }: TextFieldProps) {
  return (
    <FormField label={label} error={error} description={description} id={id}>
      {(control) => <Input {...control} {...inputProps} />}
    </FormField>
  )
}
