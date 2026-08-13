import { useEffect } from 'react'
import { on } from '../lib/events'

export function useRefreshOnFocus(refetchFn) {
  useEffect(() => {
    if (!refetchFn) return
    return on('app-resumed', refetchFn)
  }, [refetchFn])
}
