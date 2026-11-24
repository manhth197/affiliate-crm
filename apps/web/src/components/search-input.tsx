import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

type SearchInputProps = {
  /** Committed value (e.g. from the URL). */
  value: string
  /** Called with the trimmed text after the user stops typing. */
  onSearch: (value: string) => void
  placeholder?: string
  label: string
  delayMs?: number
}

/** Text search that commits after a short pause, so we do not call the API on every key. */
export function SearchInput({
  value,
  onSearch,
  placeholder,
  label,
  delayMs = 400,
}: SearchInputProps) {
  const [text, setText] = useState(value)

  // When the committed value changes from outside (e.g. "clear filters"), show it.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }

  useEffect(() => {
    if (text.trim() === value) return
    const timer = setTimeout(() => onSearch(text.trim()), delayMs)
    return () => clearTimeout(timer)
  }, [text, value, onSearch, delayMs])

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="pl-8"
      />
    </div>
  )
}
