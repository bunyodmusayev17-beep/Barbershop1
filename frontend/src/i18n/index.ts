import i18n from 'i18next';
import {initReactI18next, useTranslation} from 'react-i18next';
import uz from './uz';
import ru from './ru';
import en from './en';
import type {Lang, LocalizedText} from '../api/types';

const LANG_KEY = 'nyb_lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* localStorage yo'q */
  }
  // Asosiy auditoriya — O'zbekiston: brauzer ruscha bo'lsa ruscha, qolgan hollarda o'zbekcha
  return navigator.language.slice(0, 2) === 'ru' ? 'ru' : 'uz';
}

i18n.use(initReactI18next).init({
  resources: {uz: {translation: uz}, ru: {translation: ru}, en: {translation: en}},
  lng: initialLang(),
  fallbackLng: 'uz',
  interpolation: {escapeValue: false},
  returnObjects: true,
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* e'tiborsiz */
  }
});
document.documentElement.lang = i18n.language;

export default i18n;

/** Joriy til + bazadagi 3 tilli matnni tanlash yordamchisi. */
export function useLang() {
  const {t, i18n: inst} = useTranslation();
  const lang = (inst.language as Lang) ?? 'uz';
  const pick = (text: LocalizedText | null | undefined) => (text ? text[lang] || text.uz : '');
  const money = (n: number) => `${n.toLocaleString('ru-RU').replace(/,/g, ' ')} ${t('common.sum')}`;
  return {t, lang, pick, money, setLang: (l: Lang) => inst.changeLanguage(l)};
}
