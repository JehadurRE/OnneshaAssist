import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from './types';

interface I18nDictionary {
  [key: string]: {
    en: string;
    bn: string;
  };
}

export const translations: I18nDictionary = {
  // Brand & Navigation
  app_name: { en: 'Onnesha Arena', bn: 'অন্বেষা অ্যারেনা' },
  app_tagline: { en: 'AI Assessment, Model Tests & Examination Arena', bn: 'AI অ্যাসেসমেন্ট, মডেল টেস্ট ও এক্সামিনেশন অ্যারেনা' },
  knowledge_partner: { en: 'Official Knowledge Partner', bn: 'অফিসিয়াল জ্ঞান অংশীদার' },
  dashboard: { en: 'Instructor Studio', bn: 'ইন্সট্রাক্টর স্টুডিও' },
  host_live: { en: 'Deploy to Arena', bn: 'অ্যারেনায় চালু করুন' },
  join_pin: { en: 'Enter Arena Pass', bn: 'অ্যারেনা পাসে প্রবেশ' },
  pricing: { en: 'Plans & ROI', bn: 'প্ল্যান ও সাশ্রয়' },
  vault: { en: 'Knowledge Vault', bn: 'নলেজ ভল্ট' },
  templates: { en: 'Curriculum Vault', bn: 'কারিকুলাম ভল্ট' },
  exam_timer: { en: 'Exam Timer', bn: 'পরীক্ষা টাইমার' },
  solutions: { en: 'Institutional Solutions', bn: 'প্রাতিষ্ঠানিক সমাধান' },

  // Solutions dropdown
  for_education: { en: 'Academies & Coaching', bn: 'একাডেমি ও কোচিং' },
  for_education_desc: { en: 'BCS, varsity model exams, negative marking & merit notices', bn: 'বিসিএস, ভর্তি পরীক্ষা, নেগেটিভ মার্কিং ও মেধা তালিকা' },
  for_corporate: { en: 'Enterprise & Compliance', bn: 'এন্টারপ্রাইজ ও কমপ্লায়েন্স' },
  for_corporate_desc: { en: 'Workplace safety, fire drills & verifiable employee certification', bn: 'অগ্নি-নিরাপত্তা, ট্রেনিং ও ভেরিফায়েবল কর্মী সার্টিফিকেশন' },
  for_training: { en: 'National & Cadre Training', bn: 'জাতীয় ও ক্যাডার প্রশিক্ষণ' },
  for_training_desc: { en: 'Regional batch assessments, skill benchmarking & compliance modules', bn: 'অঞ্চলভিত্তিক ব্যাচ মূল্যায়ন ও স্কিল বেঞ্চমার্কিং' },
  for_events: { en: 'Audience Evaluation & Seminars', bn: 'সেমিনার ও লাইভ মূল্যায়ন' },
  for_events_desc: { en: 'Large auditorium polling, keynote feedback & live leaderboards', bn: 'অডিটোরিয়াম লাইভ পোলিং ও ইন্টারঅ্যাক্টিভ স্পিড ট্র্যাকার' },

  // Hero Section
  hero_badge: { en: 'Regional Examination Engine · 500+ Concurrent Seats', bn: 'অঞ্চলভিত্তিক পরীক্ষা ইঞ্জিন · ৫০০+ পরীক্ষার্থী' },
  hero_title_prefix: { en: 'Run regional model exams with', bn: 'অঞ্চলভিত্তিক লাইভ পরীক্ষা ও' },
  hero_title_highlight: { en: 'verified seat locks.', bn: 'যাচাইকৃত মেধা মূল্যায়ন।' },
  hero_subtitle: {
    en: 'Conduct live 500-seat examinations across divisional ranges with mobile-number candidate lookup, single-device seat locks, exact -0.25 negative marking, and printable merit gazettes.',
    bn: 'মোবাইল ও রোল নম্বর অটো-ফিল, সিঙ্গেল-ডিভাইস সিট লক, নির্ভুল -০.২৫ নেগেটিভ মার্কিং এবং প্রিন্টযোগ্য মেধা তালিকাসহ ৫০০+ আসনের লাইভ পরীক্ষা পরিচালনা করুন।'
  },
  start_free: { en: 'Launch Instructor Studio', bn: 'ইন্সট্রাক্টর স্টুডিও চালু করুন' },
  see_plans: { en: 'Institutional Plans & ROI', bn: 'প্ল্যান ও সাশ্রয় ক্যালকুলেটর' },
  enter_pin_prompt: { en: 'Candidate Access · Enter 6-Digit Arena Pass', bn: 'পরীক্ষার্থী প্রবেশ · ৬ ডিজিটের অ্যারেনা পাস লিখুন' },
  play_button: { en: 'Enter Exam Arena', bn: 'অ্যারেনায় প্রবেশ করুন' },
  live_preview_caption: { en: 'Mission Control HUD · Live psychometric telemetry & proctor pulse', bn: 'মিশন কন্ট্রোল স্ক্রিন · লাইভ সাইকোমেট্রিক স্পিড ও অ্যান্টি-চিট প্রোফেসর মনিটর' },

  // Tactical Keypad & Examination
  pin_label: { en: 'Exam Arena Pass (6 Digits)', bn: 'পরীক্ষা অ্যারেনা পাস (৬ ডিজিট)' },
  nickname_label: { en: 'Candidate Name / Cadet Nickname', bn: 'পরীক্ষার্থীর নাম / ক্যাডেট ডাকনাম' },
  nickname_placeholder: { en: 'e.g. Cadet Tanvir Hossain', bn: 'যেমন: ক্যাডেট তানভীর হোসেন' },
  roll_label: { en: 'Student Roll / Institutional Cadet ID', bn: 'রোল নম্বর / ইনস্টিটিউশনাল ক্যাডেট আইডি' },
  roll_placeholder: { en: 'e.g. 2026-BCS-104', bn: 'যেমন: ২০২৬-১০৪' },
  join_button: { en: 'Authenticate & Enter Arena', bn: 'অ্যারেনায় যুক্ত হোন' },
  waiting_host: { en: 'Authenticated. Stand by for Exam Controller to start...', bn: 'যাচাই সম্পন্ন। এক্সাম কন্ট্রোলার পরীক্ষা শুরুর অপেক্ষায়...' },
  get_ready: { en: 'Examination Commencing', bn: 'পরীক্ষা শুরু হচ্ছে' },
  question: { en: 'Question', bn: 'প্রশ্ন' },
  of: { en: 'of', bn: 'এর' },
  score: { en: 'Score Matrix', bn: 'স্কোর ম্যাট্রিক্স' },
  streak: { en: 'Accuracy Velocity', bn: 'সঠিকতার গতি' },
  rank: { en: 'Merit Position', bn: 'মেধা অবস্থান' },
  pts: { en: 'marks', bn: 'নম্বর' },
  correct: { en: 'Accurate Response', bn: 'সঠিক উত্তর' },
  incorrect: { en: 'Inaccurate (-0.25 Mark Deducted)', bn: 'ভুল উত্তর (-০.২৫ নেগেটিভ মার্ক)' },
  time_up: { en: 'Time Window Expired', bn: 'সময়সীমা সমাপ্ত' },
  submitted: { en: 'Response Transmitted to Controller HUD', bn: 'উত্তর কন্ট্রোলার সার্ভারে জমা হয়েছে' },
  podium_title: { en: 'Cadre & Scholar Merit Convocation', bn: 'চূড়ান্ত মেধা তালিকা ও সংবর্ধনা' },
  download_cert: { en: 'Issue Cryptographic Certificate', bn: 'যাচাইযোগ্য ডিজিটাল সনদ গ্রহণ' },
  play_again: { en: 'Deploy Another Assessment', bn: 'নতুন মূল্যায়ন চালু করুন' },

  // Mission Control Host View
  lobby_title: { en: 'Mission Control & Assessment Commander', bn: 'মিশন কন্ট্রোল ও এক্সাম কমান্ডার' },
  players_connected: { en: 'Candidates Authenticated', bn: 'যুক্ত পরীক্ষার্থী' },
  start_game_now: { en: 'Initiate Live Examination', bn: 'পরীক্ষা শুরু করুন' },
  add_bot_players: { en: '+10 Simulated Candidates', bn: '+১০ সিমুলেটেড ক্যান্ডিডেট' },
  next_question: { en: 'Advance to Next Item →', bn: 'পরবর্তী প্রশ্নে যান →' },
  show_leaderboard: { en: 'Reveal Merit Matrix', bn: 'লাইভ মেধা তালিকা' },
  end_game: { en: 'Conclude Exam & Generate Gazette', bn: 'পরীক্ষা সমাপ্ত ও গেজেট প্রকাশ' },
  answers_received: { en: 'Transmitted Responses', bn: 'উত্তর জমা পড়েছে' },
  skip_timer: { en: 'Conclude Item Window', bn: 'এখনই ফলাফল প্রকাশ' },

  // Knowledge Vault & Catalog
  ready_packs_title: { en: 'National Curriculum & Knowledge Vaults', bn: 'জাতীয় কারিকুলাম ও নলেজ ভল্ট' },
  ready_packs_subtitle: {
    en: 'Verified question repositories for BCS, Medical, Engineering, Defense, and Board Examinations with deep analytical explanations and PDF prints.',
    bn: 'বিসিএস, মেডিকেল, বুয়েট, প্রতিরক্ষা ও বোর্ড পরীক্ষার প্রশ্ন ব্যাংক — নির্ভুল সমাধান, ব্যাখ্যা এবং প্রিন্টযোগ্য প্রশ্নপত্র।'
  },
  questions_count: { en: 'items', bn: 'টি প্রশ্ন' },
  show_answer: { en: 'Reveal Verified Key', bn: 'সঠিক উত্তর ও ব্যাখ্যা' },
  hide_answer: { en: 'Conceal Key', bn: 'উত্তর লুকান' },
  run_with_class: { en: 'Deploy Model Exam to Arena', bn: 'অ্যারেনায় এই মডেল টেস্টটি শুরু করুন' },

  // Pricing & ROI
  pricing_title: { en: 'Institutional Scale & Cost Savings', bn: 'প্রাতিষ্ঠানিক সাবস্ক্রিপশন ও সাশ্রয়' },
  pricing_subtitle: {
    en: 'Eliminate paper question printing, manual OMR scanning, and notice distribution costs with instant digital evaluation.',
    bn: 'প্রশ্নপত্র প্রিন্ট, OMR শিট স্ক্যান এবং ম্যানুয়াল খাতা মূল্যায়নের খরচ বাঁচিয়ে ক্লাউড অ্যাসেসমেন্টে প্রবেশ করুন।'
  },
  monthly: { en: 'Monthly', bn: 'মাসিক' },
  yearly: { en: 'Annual (2 Months Free)', bn: 'বাৎসরিক (২ মাস ফ্রি)' },
  people_per_session: { en: 'Simultaneous Examinees per Arena Session', bn: 'একসাথে কতজন পরীক্ষার্থী অংশ নেবে?' },
  contact_sales: { en: 'Request Custom Enterprise Proposal', bn: 'কাস্টম প্রাতিষ্ঠানিক প্রস্তাবনা চান' },

  // Trust & Core Advantages
  trust_cert: { en: 'Cryptographic QR Verification', bn: 'QR কোডযুক্ত ভেরিফায়েবল সনদ' },
  trust_isolation: { en: 'Per-Tenant Data Airgap', bn: 'প্রতি প্রতিষ্ঠানের ডেটা সুরক্ষা' },
  trust_bilingual: { en: 'NCTB & Bengali Unicode Native', bn: 'জাতীয় কারিকুলাম ও বাংলা ফন্ট ফ্রেন্ডলি' },
  trust_app: { en: 'Zero Install · Works on Any Device', bn: 'কোনো ইনস্টলেশন নেই · সব ডিভাইসে চলে' },

  // FAQ
  faq_heading: { en: 'Institutional Assessment FAQ', bn: 'প্রাতিষ্ঠানিক পরীক্ষা সম্পর্কিত প্রশ্নোত্তর' },
  faq_1_q: { en: 'How does Onnesha Arena differ from casual quiz apps?', bn: 'অন্বেষা অ্যারেনা সাধারণ কুইজ অ্যাপ থেকে কীভাবে আলাদা?' },
  faq_1_a: {
    en: 'Onnesha Arena is built for high-stakes regional model exams, universities, and coaching academies. It combines mobile/roll roster auto-fill, single-seat anti-impersonation locks, OMR-style negative marking, psychometric item facility analysis, and QR-verifiable merit certificates.',
    bn: 'অন্বেষা অ্যারেনা কোনো সাধারণ গেম নয় — এটি বিসিএস, বিশ্ববিদ্যালয় ও কোচিং একাডেমির জন্য তৈরি হাই-সিকিউরিটি এক্সাম প্ল্যাটফর্ম। এতে রোল/মোবাইল ভেরিফিকেশন, সিঙ্গেল-সিট লক, নেগেটিভ মার্কিং, সাইকোমেট্রিক অ্যানালিটিক্স এবং ভেরিফায়েবল সনদ ব্যবস্থা রয়েছে।'
  },
  faq_2_q: { en: 'Can we conduct negative marking model tests?', bn: 'নেগেটিভ মার্কিং সহ বিসিএস বা মেডিকেল মডেল টেস্ট নেওয়া যাবে?' },
  faq_2_a: {
    en: 'Yes. You can configure custom negative marking penalties (-0.25, -0.50, or custom marks) per wrong answer. The system automatically computes normalized merit standings.',
    bn: 'হ্যাঁ। ভুল উত্তরের জন্য -০.২৫ বা -০.৫০ নেগেটিভ মার্কিং নির্ধারণ করা যায় এবং সিস্টেম স্বয়ংক্রিয়ভাবে মেধা স্কোর তৈরি করে।'
  },
  faq_3_q: { en: 'Can we print official merit notice board sheets and send SMS?', bn: 'নোটিশ বোর্ডের জন্য মেধা তালিকা প্রিন্ট এবং অভিভাবকের ফোনে SMS পাঠানো যায়?' },
  faq_3_a: {
    en: 'Yes. The Instructor Studio generates formal institutional gazette notices ready for printout, and dispatches automated result SMS to registered guardian phone numbers.',
    bn: 'হ্যাঁ। ইন্সট্রাক্টর স্টুডিও থেকে এক ক্লিকে নোটিশ বোর্ডের জন্য ফরমাল মেধা তালিকা প্রিন্ট করা যায় এবং অভিভাবকের ফোনে রেজাল্টের SMS পাঠানো যায়।'
  },
  faq_4_q: { en: 'How does the AI Question Studio work?', bn: 'AI কোশ্চেন স্টুডিও কীভাবে কাজ করে?' },
  faq_4_a: {
    en: 'Paste syllabus excerpts, lecture notes, or specify any exam topic — our AI engine produces complete bilingual questions with multiple choices, correct keys, and comprehensive pedagogical explanations.',
    bn: 'যেকোনো লেকচার নোট বা সিলেবাস অনুচ্ছেদ পেস্ট করলে AI স্বয়ংক্রিয়ভাবে নির্ভুল প্রশ্ন, অপশন ও একাডেমিক ব্যাখ্যা তৈরি করে দেবে।'
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'bn',
  setLang: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('bn');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('onnesha_quiz_lang') as Language;
      if (saved === 'en' || saved === 'bn') {
        setLangState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem('onnesha_quiz_lang', newLang);
    } catch {
      // ignore
    }
  };

  const t = (key: string): string => {
    const item = translations[key];
    if (!item) return key;
    return item[lang] || item.en || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
