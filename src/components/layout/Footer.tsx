import React from 'react';
import { Link } from '@tanstack/react-router';
import { useLanguage } from '@/lib/i18n';
import { useBranding } from '@/hooks/use-branding';
import learningBd from '@/assets/learning-bd.png.asset.json';
import ccai from '@/assets/ccai.png.asset.json';
import onnesha from '@/assets/onnesha.jpg.asset.json';
import { ShieldCheck, Code, Sparkles, Smartphone } from 'lucide-react';

export const Footer: React.FC = () => {
  const { lang, t } = useLanguage();
  const branding = useBranding();

  return (
    <footer className="border-t border-border/80 bg-card/60 transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <img src={onnesha.url} alt="Onnesha LMS" className="h-9 rounded-md object-contain" />
              {branding.showPartnerLogo && branding.partnerLogoUrl && (
                <>
                  <span className="text-muted-foreground font-mono text-xs font-bold">×</span>
                  <img
                    src={branding.partnerLogoUrl}
                    alt={branding.partnerName || 'Joint Partner'}
                    className="h-9 max-w-[120px] rounded-md object-contain"
                  />
                </>
              )}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {t('app_name')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-sm">
                {lang === 'bn'
                  ? 'ক্লাসরুম, মডেল টেস্ট, কর্পোরেট ট্রেনিং ও টিম কুইজ নাইটের জন্য আধুনিক দ্বিভাষিক লাইভ কুইজ প্ল্যাটফর্ম।'
                  : 'Modern bilingual live quiz & formal assessment platform for classrooms, model tests, corporate training, and team events.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
              <span className="font-semibold">{t('knowledge_partner')}:</span>
              <img src={learningBd.url} alt="Learning Bangladesh" className="h-6 object-contain" />
              <span>·</span>
              <img src={ccai.url} alt="Cloud Connect AI Limited" className="h-5 object-contain" />
            </div>
          </div>

          {/* Solutions Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t('solutions')}
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/for/$segment" params={{ segment: 'education' }} className="hover:text-primary transition-colors">
                  {t('for_education')}
                </Link>
              </li>
              <li>
                <Link to="/for/$segment" params={{ segment: 'corporate' }} className="hover:text-primary transition-colors">
                  {t('for_corporate')}
                </Link>
              </li>
              <li>
                <Link to="/for/$segment" params={{ segment: 'training' }} className="hover:text-primary transition-colors">
                  {t('for_training')}
                </Link>
              </li>
              <li>
                <Link to="/for/$segment" params={{ segment: 'events' }} className="hover:text-primary transition-colors">
                  {t('for_events')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform & Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {lang === 'bn' ? 'রিসোর্স ও টুলস' : 'Platform & Tools'}
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/t" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>{t('templates')}</span>
                </Link>
              </li>
              <li>
                <Link to="/timer" className="hover:text-primary transition-colors">
                  {t('exam_timer')}
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-primary transition-colors">
                  {t('pricing')}
                </Link>
              </li>
              <li>
                <Link to="/security" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  <span>{lang === 'bn' ? 'সনদ যাচাই ও নিরাপত্তা' : 'Security & Verification'}</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers & Trust */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              {lang === 'bn' ? 'যোগাযোগ ও সাপোর্ট' : 'Developers & Trust'}
            </h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <Link to="/developers" className="hover:text-primary transition-colors flex items-center gap-1.5">
                  <Code className="h-3 w-3 text-primary" />
                  <span>{lang === 'bn' ? 'ডেভেলপার API ও ইন্টিগ্রেশন' : 'API & Webhooks'}</span>
                </Link>
              </li>
              <li>
                <Link to="/contact-sales" className="hover:text-primary transition-colors">
                  {lang === 'bn' ? 'কাস্টম প্ল্যান ও সেলস' : 'Contact Sales & Support'}
                </Link>
              </li>
              <li>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Smartphone className="h-3 w-3 text-indigo-500" />
                  <span>Mobile PWA &amp; App Ready</span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p>© 2026 Onnesha LMS · Cloud Connect AI Limited. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/security" className="hover:underline">
              {lang === 'bn' ? 'নিরাপত্তা' : 'Security'}
            </Link>
            <span>·</span>
            <Link to="/contact-sales" className="hover:underline">
              {lang === 'bn' ? 'যোগাযোগ' : 'Contact'}
            </Link>
            <span>·</span>
            <Link to="/pricing" className="hover:underline">
              {lang === 'bn' ? 'বিকাশ পেমেন্ট' : 'bKash'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
