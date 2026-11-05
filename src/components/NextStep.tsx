export function NextStep({ label, children }: { label: string; children: string }) {
  return (
    <p className="rounded-2xl bg-[#fff1ea] px-4 py-3 text-sm leading-relaxed text-ink">
      <span className="font-medium">{label}</span>
      {children}
    </p>
  )
}
