import { useState, useEffect } from 'react'

export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const onResize = () => {
      // If visual viewport height is significantly less than window height, keyboard is open
      const keyboardOpen = viewport.height < window.innerHeight * 0.75
      setIsKeyboardVisible(keyboardOpen)
    }

    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  return isKeyboardVisible
}
