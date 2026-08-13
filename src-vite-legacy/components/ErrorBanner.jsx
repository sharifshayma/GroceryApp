import { useTranslation } from 'react-i18next'

export default function ErrorBanner({ error, onRetry }) {
  const { i18n } = useTranslation()
  const isHe = i18n.language === 'he'

  if (!error) return null

  return (
    <div className="mx-4 my-4 p-4 rounded-xl bg-red-50 border border-red-200">
      <p className="text-sm font-semibold text-red-700 mb-1">
        {isHe ? 'שגיאה בטעינת נתונים' : 'Failed to load data'}
      </p>
      <p className="text-xs text-red-600 font-mono break-all">{error}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors"
        >
          {isHe ? 'נסה שוב' : 'Retry'}
        </button>
      )}
    </div>
  )
}
