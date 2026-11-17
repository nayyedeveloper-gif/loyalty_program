import { useEffect, useState } from 'react'

/** Returns `value` after it has stayed unchanged for `delayMs` (live search). */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
