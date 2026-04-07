export default function HorizontalItemRow({ title, icon, items, accentClass = 'border-t-primary/30', onItemClick, itemsInList }) {
  if (!items || items.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium flex items-center gap-1.5">
          <span>{icon}</span>
          <span>{title}</span>
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {items.map((item) => {
          const inList = itemsInList?.has(item.id)
          return (
            <button
              key={item.id}
              onClick={() => onItemClick?.(item)}
              className={`flex-shrink-0 w-24 bg-surface rounded-xl border-t-2 ${accentClass} p-2.5 flex flex-col items-center shadow-sm relative ${
                onItemClick ? 'active:scale-95 transition-transform' : ''
              }`}
            >
              {inList && (
                <span className="absolute top-1 end-1 text-xs">🛒</span>
              )}
              <span className="text-2xl mb-1">{item.emoji || '🛒'}</span>
              <span className="text-xs font-semibold text-center leading-tight line-clamp-2">
                {item.name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
