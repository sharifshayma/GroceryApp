import { useState, useEffect } from 'react'

export function useKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(window.visualViewport?.height ?? window.innerHeight)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const onResize = () => {
      const keyboardOpen = viewport.height < window.innerHeight * 0.75
      setIsKeyboardVisible(keyboardOpen)
      setViewportHeight(viewport.height)
    }

    viewport.addEventListener('resize', onResize)
    return () => viewport.removeEventListener('resize', onResize)
  }, [])

  return { isKeyboardVisible, viewportHeight }
}
