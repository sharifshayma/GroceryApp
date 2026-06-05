import i18n from '../i18n'

export function getItemName(item) {
  if (!item) return ''
  if (i18n.language === 'he' && item.name_he) return item.name_he
  return item.name
}
