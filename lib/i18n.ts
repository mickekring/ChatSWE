import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import svTranslation from '../locales/sv/translation.json'
import enTranslation from '../locales/en/translation.json'
import ukTranslation from '../locales/uk/translation.json'

// Language resources
const resources = {
  sv: {
    translation: svTranslation,
  },
  en: {
    translation: enTranslation,
  },
  uk: {
    translation: ukTranslation,
  },
}

i18n
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: 'sv', // default language (Swedish)
    fallbackLng: 'en', // fallback to English if translation missing

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    // Pluralization rules for different languages
    pluralSeparator: '_',
    contextSeparator: '_',

    debug: process.env.NODE_ENV === 'development',

    // Load namespaces
    defaultNS: 'translation',
    ns: ['translation'],

    // Language detection configuration - prioritize localStorage and force sv if nothing found
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
      checkWhitelist: true,
    },
    
    // Only allow these languages to prevent browser language detection from interfering
    supportedLngs: ['sv', 'en', 'uk'],
    nonExplicitSupportedLngs: true,
  })

export default i18n