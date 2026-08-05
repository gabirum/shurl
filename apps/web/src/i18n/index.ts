import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ptBR from './locales/pt-BR.json'

// The same catalog is registered under both 'pt' and 'pt-BR': browsers report either tag
// depending on OS/locale settings, and without the 'pt' alias a plain 'pt' navigator language
// would silently fall back to English instead of matching our Brazilian Portuguese catalog.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, pt: { translation: ptBR }, 'pt-BR': { translation: ptBR } },
    supportedLngs: ['en', 'pt', 'pt-BR'],
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'shurl.lang' },
  })

i18n.on('languageChanged', lng => {
  document.documentElement.lang = lng
})

export default i18n
