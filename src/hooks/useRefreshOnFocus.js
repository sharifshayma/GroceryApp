import { useEffect } from 'react'

export function useRefreshOnFocus(refetchFn) {
  useEffect(() => {
    if (!refetchFn) return

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchFn()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [refetchFn])
}
