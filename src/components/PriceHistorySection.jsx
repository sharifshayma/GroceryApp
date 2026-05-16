import { useState, useEffect, useCallback, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import * as grocery from '../lib/grocery'

function formatDate(iso, isHe) {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00')
    return d.toLocaleDateString(isHe ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10)

const EMPTY_DRAFT = { price: '', store: '', purchased_at: todayIso(), barcode: '', description: '' }

export default function PriceHistorySection({ itemId }) {
  const { i18n } = useTranslation()
  const { profile } = useAuth()
  const isHe = i18n.language === 'he'
  const datalistId = useId()

  const householdId = profile?.household_id
  const userId = profile?.id
  const ctx = householdId ? { householdId, userId } : null

  const [entries, setEntries] = useState([])
  const [storeTags, setStoreTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [draftExtras, setDraftExtras] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT)
  const [editExtras, setEditExtras] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!householdId) return
    const innerCtx = { householdId, userId }
    setLoading(true)
    setError(null)
    try {
      const [rows, tags] = await Promise.all([
        grocery.fetchPriceHistory(supabase, innerCtx, { itemId }),
        grocery.fetchTags(supabase, innerCtx, { type: 'store' }),
      ])
      setEntries(rows)
      setStoreTags(tags)
    } catch (e) {
      setError(e.message || 'Failed to load prices')
    }
    setLoading(false)
  }, [householdId, userId, itemId])

  useEffect(() => {
    load()
  }, [load])

  const reset = () => {
    setAdding(false)
    setDraft(EMPTY_DRAFT)
    setDraftExtras(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(EMPTY_DRAFT)
    setEditExtras(false)
  }

  const handleAdd = async () => {
    const priceNum = Number(draft.price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError(isHe ? 'מחיר לא תקין' : 'Invalid price')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await grocery.addPriceEntry(supabase, ctx, {
        itemId,
        price: priceNum,
        store: draft.store,
        purchasedAt: draft.purchased_at || todayIso(),
        barcode: draft.barcode,
        description: draft.description,
      })
      setEntries((prev) => [created, ...prev])
      const trimmedStore = (draft.store || '').trim()
      if (trimmedStore && !storeTags.some((t) => t.name.toLowerCase() === trimmedStore.toLowerCase())) {
        const tags = await grocery.fetchTags(supabase, ctx, { type: 'store' })
        setStoreTags(tags)
      }
      reset()
    } catch (e) {
      setError(e.message || 'Failed to save')
    }
    setBusy(false)
  }

  const beginEdit = (entry) => {
    setEditingId(entry.id)
    setEditDraft({
      price: String(entry.price ?? ''),
      store: entry.store || '',
      purchased_at: entry.purchased_at || todayIso(),
      barcode: entry.barcode || '',
      description: entry.description || '',
    })
    setEditExtras(Boolean(entry.barcode || entry.description))
  }

  const handleUpdate = async () => {
    const priceNum = Number(editDraft.price)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError(isHe ? 'מחיר לא תקין' : 'Invalid price')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await grocery.updatePriceEntry(supabase, ctx, {
        entryId: editingId,
        updates: {
          price: priceNum,
          store: editDraft.store,
          purchased_at: editDraft.purchased_at,
          barcode: editDraft.barcode,
          description: editDraft.description,
        },
      })
      setEntries((prev) =>
        prev
          .map((e) => (e.id === updated.id ? updated : e))
          .sort((a, b) => (a.purchased_at < b.purchased_at ? 1 : -1))
      )
      cancelEdit()
    } catch (e) {
      setError(e.message || 'Failed to save')
    }
    setBusy(false)
  }

  const handleDelete = async (entry) => {
    const confirmMsg = isHe ? 'למחוק את רשומת המחיר?' : 'Delete this price entry?'
    if (!window.confirm(confirmMsg)) return
    setBusy(true)
    setError(null)
    try {
      await grocery.deletePriceEntry(supabase, ctx, { entryId: entry.id })
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    } catch (e) {
      setError(e.message || 'Failed to delete')
    }
    setBusy(false)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <h3 className="text-sm font-semibold">{isHe ? 'מחירים' : 'Pricing'}</h3>
        </div>
        {!adding && !editingId && (
          <button
            onClick={() => setAdding(true)}
            className="px-2.5 py-1 rounded-lg bg-white border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10"
          >
            {isHe ? '+ הוסף מחיר' : '+ Add price'}
          </button>
        )}
      </div>

      <datalist id={datalistId}>
        {storeTags.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>

      <div className={`p-3 rounded-xl border border-neutral/30 bg-bg space-y-2`}>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary">{isHe ? 'טוען...' : 'Loading...'}</p>
        ) : entries.length === 0 && !adding ? (
          <p className="text-sm text-text-secondary">
            {isHe ? 'עדיין אין מחירים' : 'No prices logged yet'}
          </p>
        ) : null}

        {entries.map((entry) =>
          editingId === entry.id ? (
            <PriceForm
              key={entry.id}
              isHe={isHe}
              draft={editDraft}
              setDraft={setEditDraft}
              datalistId={datalistId}
              extras={editExtras}
              setExtras={setEditExtras}
              onSave={handleUpdate}
              onCancel={cancelEdit}
              busy={busy}
            />
          ) : (
            <div
              key={entry.id}
              className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-neutral/20"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-text">
                    ₪{Number(entry.price).toFixed(2)}
                  </span>
                  {entry.store && (
                    <span className="text-xs text-text-secondary">· {entry.store}</span>
                  )}
                  <span className="text-xs text-text-secondary">
                    · {formatDate(entry.purchased_at, isHe)}
                  </span>
                </div>
                {(entry.barcode || entry.description) && (
                  <div className="mt-1 space-y-0.5">
                    {entry.description && (
                      <p className="text-xs text-text-secondary truncate">{entry.description}</p>
                    )}
                    {entry.barcode && (
                      <p className="text-[11px] text-text-secondary font-mono truncate">
                        {isHe ? 'ברקוד: ' : 'Barcode: '}
                        {entry.barcode}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => beginEdit(entry)}
                  disabled={busy}
                  aria-label={isHe ? 'ערוך' : 'Edit'}
                  className="w-8 h-8 rounded-lg bg-neutral/20 hover:bg-neutral/40 flex items-center justify-center text-xs disabled:opacity-50"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(entry)}
                  disabled={busy}
                  aria-label={isHe ? 'מחק' : 'Delete'}
                  className="w-8 h-8 rounded-lg bg-neutral/20 hover:bg-red-100 flex items-center justify-center text-xs disabled:opacity-50"
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        )}

        {adding && (
          <PriceForm
            isHe={isHe}
            draft={draft}
            setDraft={setDraft}
            datalistId={datalistId}
            extras={draftExtras}
            setExtras={setDraftExtras}
            onSave={handleAdd}
            onCancel={reset}
            busy={busy}
          />
        )}
      </div>
    </section>
  )
}

function PriceForm({ isHe, draft, setDraft, datalistId, extras, setExtras, onSave, onCancel, busy }) {
  return (
    <div className="p-2.5 rounded-lg bg-white border border-primary/30 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-text-secondary">{isHe ? 'מחיר (₪)' : 'Price (₪)'}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-sm"
            placeholder="0.00"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-text-secondary">{isHe ? 'תאריך' : 'Date'}</span>
          <input
            type="date"
            value={draft.purchased_at}
            onChange={(e) => setDraft({ ...draft, purchased_at: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-sm"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[11px] text-text-secondary">{isHe ? 'חנות' : 'Store'}</span>
        <input
          type="text"
          list={datalistId}
          value={draft.store}
          onChange={(e) => setDraft({ ...draft, store: e.target.value })}
          placeholder={isHe ? 'שם החנות' : 'Store name'}
          className="w-full px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-sm"
        />
      </label>

      {extras ? (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] text-text-secondary">
              {isHe ? 'ברקוד (אופציונלי)' : 'Barcode (optional)'}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.barcode}
              onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
              className="w-full px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="text-[11px] text-text-secondary">
              {isHe ? 'תיאור (אופציונלי)' : 'Description (optional)'}
            </span>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={isHe ? 'גודל, מותג וכו׳' : 'Size, brand, etc.'}
              className="w-full px-2 py-1.5 rounded-lg border border-neutral bg-surface text-text text-sm"
            />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExtras(true)}
          className="text-xs text-primary underline"
        >
          {isHe ? '+ ברקוד / תיאור' : '+ Barcode / description'}
        </button>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? (isHe ? 'שומר...' : 'Saving...') : isHe ? 'שמור' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-2 rounded-lg bg-white border border-neutral text-text-secondary text-sm font-medium disabled:opacity-50"
        >
          {isHe ? 'ביטול' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}
