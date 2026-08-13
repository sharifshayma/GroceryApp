// Wraps any thenable (typically a Supabase query) in a timeout race.
// Returns { data, error } shape — on timeout, error is a synthetic timeout.
// Lives in its own module so server-side code can use it without dragging in
// the Vite-specific Supabase client init in `./supabase`.

export function withTimeout(queryPromise, ms = 10000) {
  return Promise.race([
    Promise.resolve(queryPromise),
    new Promise((resolve) =>
      setTimeout(() => {
        resolve({
          data: null,
          error: {
            message: `Request timed out after ${ms / 1000}s — check your connection or Supabase status`,
          },
        })
      }, ms)
    ),
  ])
}
