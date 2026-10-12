import type {Lang} from '../api/types';
import {useLang} from '../i18n';
import {cn} from '../lib/cn';

const LANGS: Lang[] = ['uz', 'ru', 'en'];

export function LangSwitch({className}: {className?: string}) {
  const {lang, setLang} = useLang();
  return (
    <div className={cn('inline-flex rounded-full border-2 border-navy p-0.5 text-xs font-bold', className)} role="group" aria-label="Til / Язык / Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={cn('rounded-full px-2.5 py-1 uppercase tracking-widest transition', lang === l ? 'bg-navy text-cream' : 'text-navy hover:bg-cream-dark')}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
