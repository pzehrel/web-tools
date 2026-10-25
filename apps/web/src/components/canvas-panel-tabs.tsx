interface CanvasPanelTabsProps<T extends string> {
  tabs: readonly (readonly [value: T, label: string])[]
  value: T
  onChange: (value: T) => void
  idPrefix: string
  label: string
  className?: string
}

export function CanvasPanelTabs<T extends string>({ tabs, value, onChange, idPrefix, label, className }: CanvasPanelTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={className}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
          return
        event.preventDefault()
        event.stopPropagation()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const focusedIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const currentIndex = focusedIndex >= 0 ? focusedIndex : tabs.findIndex(([tabValue]) => tabValue === value)
        const nextIndex = event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
        buttons[nextIndex]?.focus()
        onChange(tabs[nextIndex][0])
      }}
    >
      {tabs.map(([tabValue, tabLabel]) => (
        <button
          key={tabValue}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tabValue}`}
          aria-selected={value === tabValue}
          aria-controls={`${idPrefix}-panel-${tabValue}`}
          tabIndex={value === tabValue ? 0 : -1}
          onClick={() => onChange(tabValue)}
        >
          {tabLabel}
        </button>
      ))}
    </div>
  )
}
