import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useUsers } from '@/features/users/queries'

/** ADMIN filter: one affiliate (GET /users?role=AFFILIATE, admin only). */
export function AffiliateSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (affiliateId: string) => void
}) {
  const affiliates = useUsers({ role: 'AFFILIATE', page: 1, pageSize: 100 })
  return (
    <NativeSelect
      aria-label="Cộng tác viên"
      className="w-full sm:w-52"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <NativeSelectOption value="">Tất cả cộng tác viên</NativeSelectOption>
      {affiliates.data?.data.map((user) => (
        <NativeSelectOption key={user.id} value={user.id}>
          {user.fullName}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
