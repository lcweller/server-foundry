export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="relative my-6 flex items-center">
      <div className="flex-1 border-t border-border" aria-hidden="true" />
      <span className="px-3 font-mono text-xs uppercase tracking-[0.2em] text-text-faint">
        {label}
      </span>
      <div className="flex-1 border-t border-border" aria-hidden="true" />
    </div>
  )
}
