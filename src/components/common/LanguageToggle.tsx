import React from 'react';
import { useLanguage } from '@/lib/i18n';

export const LanguageToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border bg-card p-1 shadow-sm ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLang('bn')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          lang === 'bn'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-pressed={lang === 'bn'}
      >
        বাংলা
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          lang === 'en'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
    </div>
  );
};
