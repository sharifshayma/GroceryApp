// Simple event bus for cross-component data invalidation
const listeners = {}

export function emit(event) {
  ;(listeners[event] || []).forEach((fn) => fn())
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = []
  listeners[event].push(fn)
  return () => {
    listeners[event] = listeners[event].filter((f) => f !== fn)
  }
}
