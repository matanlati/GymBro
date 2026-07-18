import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { SelectOption } from '@gymbro/ui-kit'

interface ProgressSelectProps<V extends string> {
  options: readonly SelectOption<V>[]
  value: V | ''
  onValueChange: (value: V) => void
  placeholder?: string
  ariaLabel: string
  className?: string
}

export default function ProgressSelect<V extends string>({
  options,
  value,
  onValueChange,
  placeholder = 'Choose an option',
  ariaLabel,
  className = '',
}: ProgressSelectProps<V>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedIndex = options.findIndex(option => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onValueChange(option.value)
    setActiveIndex(index)
    setOpen(false)
  }

  const move = (direction: 1 | -1) => {
    if (options.length === 0) return
    let next = activeIndex
    do {
      next = (next + direction + options.length) % options.length
    } while (options[next].disabled && next !== activeIndex)
    setActiveIndex(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
        setOpen(true)
      } else {
        move(event.key === 'ArrowDown' ? 1 : -1)
      }
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) choose(activeIndex)
      else setOpen(true)
    }
    if (event.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={rootRef} className={`progress-dropdown ${className}`.trim()}>
      <button
        type="button"
        className="progress-dropdown-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
          setOpen(current => !current)
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? '' : 'is-placeholder'}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="progress-dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={index === activeIndex ? 'is-active' : ''}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
