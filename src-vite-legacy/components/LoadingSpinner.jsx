export default function LoadingSpinner({ fullScreen = true }) {
  const spinner = (
    <div className="flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center">
        {spinner}
      </div>
    )
  }

  return <div className="py-12">{spinner}</div>
}
