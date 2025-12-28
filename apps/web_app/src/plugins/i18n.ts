import { createI18n } from 'vue-i18n';
import ja from '../locales/ja.json';
import en from '../locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: navigator.language.split('-')[0] || 'ja',
  fallbackLocale: 'ja',
  messages: {
    ja,
    en,
  },
});

export default i18n;
