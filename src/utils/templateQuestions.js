/** @param {import('i18next').TFunction} t */
export function getLocalizedQuestions(t, categoryKey, fallbackQuestions) {
  const translated = t(`templates.taskQuestions.${categoryKey}`, { returnObjects: true });
  if (Array.isArray(translated) && translated.length > 0
      && translated.every((q) => typeof q === 'string')) {
    return translated;
  }
  return fallbackQuestions;
}

/** @param {import('i18next').TFunction} t */
export function getLocalizedCategoryLabel(t, categoryKey, fallbackLabel) {
  return t(`templates.taskCategories.${categoryKey}`, fallbackLabel);
}

export function formatQuestionList(questions) {
  const list = Array.isArray(questions) ? questions : [];
  return list.map((q, i) => `${i + 1}. ${String(q ?? '')}`).join('\n');
}
