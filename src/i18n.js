import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import he from './locales/he.json';
import fr from './locales/fr.json';
import * as tqEn from './locales/templateQuestions/en.js';
import * as tqHe from './locales/templateQuestions/he.js';
import * as tqFr from './locales/templateQuestions/fr.js';

function withTemplateQuestions(base, tq) {
  return {
    ...base,
    templates: {
      ...base.templates,
      interviewQuestions: tq.interviewQuestions,
      taskQuestions: tq.taskQuestions,
      noSearchResults: tq.noSearchResults,
    },
  };
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: withTemplateQuestions(en, tqEn) },
      he: { translation: withTemplateQuestions(he, tqHe) },
      fr: { translation: withTemplateQuestions(fr, tqFr) },
    },
    lng: localStorage.getItem('appLanguage') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
