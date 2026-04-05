import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function LanguageToggle({ compact = false }) {
  const { i18n } = useTranslation()
  const { user, refreshProfile } = useAuth()

  const currentLang = i18n.language

  const switchTo = async (lang) => {
    if (lang === currentLang) return
    i18n.changeLanguage(lang)
    localStorage.setItem('groceryapp-lang', lang)

    if (user) {
      await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('id', user.id)
      refreshProfile()
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-surface/50 p-0.5">
        <button
          onClick={() => switchTo('en')}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
            currentLang === 'en'
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:text-text'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => switchTo('he')}
          className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
            currentLang === 'he'
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:text-text'
          }`}
        >
          עב
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-xl border border-neutral bg-surface p-1">
      <button
        onClick={() => switchTo('en')}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          currentLang === 'en'
            ? 'bg-primary text-white'
            : 'text-text-secondary hover:text-text'
        }`}
      >
        English
      </button>
      <button
        onClick={() => switchTo('he')}
        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          currentLang === 'he'
            ? 'bg-primary text-white'
            : 'text-text-secondary hover:text-text'
        }`}
      >
        עברית
      </button>
    </div>
  )
}
