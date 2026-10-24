import { Input } from './ui/input'

export function NoticeEmailField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-sm text-ink">電郵（可留空）</span>
      <span id={`${id}-hint`} className="mt-1 block text-sm leading-relaxed text-muted">
        只用於通知下一場，不是登入。留空也可以。
      </span>
      <Input
        id={id}
        className="mt-2"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={80}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="name@example.com"
        aria-describedby={`${id}-hint`}
      />
    </label>
  )
}
