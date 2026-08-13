import i18n from '../i18n'

export function getCategoryName(category) {
  if (!category) return ''
  if (i18n.language === 'he' && category.name_he) return category.name_he
  return category.name
}
