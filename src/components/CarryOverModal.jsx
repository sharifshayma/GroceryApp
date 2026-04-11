import { useTranslation } from 'react-i18next'

export default function CarryOverModal({ unboughtItems, onCarryOver, onCompleteAnyway, onKeepShopping, saving }) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-backdrop" onClick={onKeepShopping} />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md animate-slide-up sm:animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="p-5">
          {/* Header */}
          <div className="text-center mb-4">
            <span className="text-4xl block mb-2">🛒</span>
            <h2 className="text-lg font-semibold">{t('lists.unboughtTitle')}</h2>
            <p className="text-sm text-text-secondary mt-1">
              {t('lists.unboughtMessage', { count: unboughtItems.length })}
            </p>
          </div>

          {/* Items preview */}
          <div className="max-h-40 overflow-y-auto mb-5 space-y-1.5 rounded-xl bg-neutral/10 p-3">
            {unboughtItems.map((li) => (
              <div key={li.id} className="flex items-center gap-2 text-sm">
                <span className="text-base">{li.items?.emoji || '🛒'}</span>
                <span className="flex-1 truncate font-medium">{li.items?.name || '?'}</span>
                <span className="text-xs text-text-secondary flex-shrink-0">
                  {li.quantity} {li.unit}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={onCarryOver}
              disabled={saving}
              className="w-full py-3.5 rounded-xl bg-green-dark text-white font-semibold text-base disabled:opacity-50 min-h-[48px]"
            >
              {saving ? t('lists.saving') : t('lists.carryOver')}
            </button>
            <button
              onClick={onCompleteAnyway}
              disabled={saving}
              className="w-full py-3 rounded-xl text-danger font-medium text-base disabled:opacity-50 min-h-[48px]"
            >
              {t('lists.completeAnyway')}
            </button>
            <button
              onClick={onKeepShopping}
              disabled={saving}
              className="w-full py-3 rounded-xl text-text-secondary font-medium text-base disabled:opacity-50 min-h-[48px]"
            >
              {t('lists.keepShopping')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
