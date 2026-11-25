/**
 * Complete Google Drive Learning Materials & Course Knowledge Base Pack
 * Source: 232 AI Training (https://drive.google.com/drive/folders/13YXw5Lxs7-wMXFrG1jjhiGTZ5doyr-DM)
 * Contains all 102 Drive files, 22 subfolders, and 11 Canva Editable/View decks
 * structured into 12 clean session packs (Master Pack + Session 00 to Session 10).
 */
import type { CourseKnowledgeEntry, CourseMaterial } from "./types";
import { SANJIBON_COURSE } from "./sanjibon-seed-data";

export const SANJIBON_DRIVE_ROOT_URL =
  "https://drive.google.com/drive/folders/13YXw5Lxs7-wMXFrG1jjhiGTZ5doyr-DM";

export const SANJIBON_CANVA_ROOT_URL = "https://www.canva.com/folder/FAHavzClUOM";

export const SANJIBON_DRIVE_FILE_COUNT = 102;

const DRIVE_SEED_TS = "2026-11-15T00:00:00.000Z";

export function buildSanjibonDriveMaterials(
  courseId: string = SANJIBON_COURSE.id,
): CourseMaterial[] {
  return ([
  {
    "id": "mat-sanjibon-drive-master",
    "sessionLabel": "Master Pack",
    "titleEn": "Master Syllabus, 5-Day Curriculum & Complete Canva Directory (232 AI Training)",
    "titleBn": "মাস্টার সিলেবাস, ৫ দিনের কারিকুলাম ও সম্পূর্ণ ক্যানভা ডিরেক্টরি (২৩২ এআই ট্রেনিং)",
    "descriptionEn": "Official 3-Page Syllabus PDF, Master Syllabus Deep Analysis (11 Ansar & VDP centers, 232 trainees), Complete Canva Editable/View Directory, and Full Google Drive Course Folder.",
    "descriptionBn": "অফিশিয়াল ৩-পৃষ্ঠার সিলেবাস PDF, মাস্টার সিলেবাস গভীর বিশ্লেষণ (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী), সম্পূর্ণ ক্যানভা ডিরেক্টরি ও মূল Google Drive ফোল্ডার।",
    "type": "pdf",
    "url": "https://drive.google.com/drive/folders/13YXw5Lxs7-wMXFrG1jjhiGTZ5doyr-DM",
    "bodyEn": "Complete master learning pack for Applied Artificial Intelligence & Autonomous Workflows for Digital Marketing Freelancers (Bangladesh Ansar & VDP Sanjibon Project × Cloud Connect AI Limited). Covers all 11 computer training centers (232 trainees), 5 days / 10 core sessions + Session 00 orientation (30 hours), continuous single-brand capstone pipeline, zero-paywall free AI tool stack, daily schedule, grading rubric, and direct Canva + Drive index.",
    "bodyBn": "# বাংলাদেশ আনসার ও ভিডিপি (সঞ্জীবন প্রকল্প) — প্রয়োগিক এআই ও অটোনমাস ওয়ার্কফ্লো প্রশিক্ষণ\n## সিলেবাস গভীর বিশ্লেষণ, ৫ দিনের মাস্টার কারিকুলাম ও ক্যানভা কোর্স ইনডেক্স\n\n**আয়োজক অংশীদার:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প এবং ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited — `https://cloudconnect-ai.com.bd/`)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক (Prepared by & Lead Instructor):** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer `#FE2023APR00005` (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**কোর্স শিরোনাম:** Applied Artificial Intelligence & Autonomous Workflows for Digital Marketing Freelancers  \n**প্রশিক্ষণ শুরুর তারিখ:** ১৫ নভেম্বর ২০২৬ (৫ কর্মদিবস • ১০টি সেশন • মোট ৩০ ঘণ্টা)  \n**প্রশিক্ষণ মাধ্যম:** ১০০% অনলাইন লাইভ ক্লাস (লাইভ ভিডিও, স্ক্রিন শেয়ারিং ও সরাসরি ইনস্ট্রাক্টর মেন্টরিং)  \n**পরীক্ষা ও কুইজ পোর্টাল:** Onnesha Arena (`https://arena.onnesha.courses/`) এবং প্রকল্প জমা পোর্টাল: Sanjibon LMS  \n\n---\n\n## ১. সিলেবাসের গভীর বিশ্লেষণ (Deep Syllabus Analysis)\n\nমূল ৩-পৃষ্ঠার সিলেবাস (`Sanjibon_AI_Training_Online_3Page_Syllabus.pdf`) পর্যালোচনা করে প্রশিক্ষণটির সফল বাস্তবায়ন ও ২৩২ জন প্রশিক্ষণার্থীর সর্বোচ্চ আউটপুট নিশ্চিত করতে নিচের কৌশলগত দিকগুলো চিহ্নিত করা হয়েছে:\n\n### ক. অংশগ্রহণকারী ও ১১টি কেন্দ্রের ভৌগোলিক বৈচিত্র্য (মোট ২৩২ জন)\nপ্রশিক্ষণার্থীরা দেশের ৮টি বিভাগের বিভিন্ন প্রান্তের **১১টি আনসার ও ভিডিপি কম্পিউটার প্রশিক্ষণ কেন্দ্রে** উপস্থিত থেকে অনলাইনে যুক্ত হবেন:\n…",
    "resources": [
      {
        "labelEn": "3-Page Official Syllabus (PDF)",
        "labelBn": "৩-পৃষ্ঠার অফিশিয়াল সিলেবাস (PDF)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/19Yty3JL9tGMCD_t1zz0VktllPl9njmXP/view",
        "fileName": "Sanjibon_AI_Training_Online_3Page_Syllabus.pdf"
      },
      {
        "labelEn": "Master Syllabus & Canva Index (DOCX)",
        "labelBn": "মাস্টার সিলেবাস ও ক্যানভা ইনডেক্স (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1MBzaO2aRJ4yZ3tnSOVmx6swmJS4reVq9/view",
        "fileName": "00_Course_Master_Syllabus_Analysis_and_Canva_Index_BN.docx"
      },
      {
        "labelEn": "Master Syllabus & Canva Index (MD)",
        "labelBn": "মাস্টার সিলেবাস ও ক্যানভা ইনডেক্স (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1MmJKuMzWem22RXOAZfymZe5NHt4oJxlR/view",
        "fileName": "00_Course_Master_Syllabus_Analysis_and_Canva_Index_BN.md"
      },
      {
        "labelEn": "All Canva Editable URLs (DOCX)",
        "labelBn": "সকল ক্যানভা এডিটেবল লিংক (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1LbKgKLdRBilqWFFTyM6CJ46FkZ-JemDc/view",
        "fileName": "00_Canva_Editable_URLs_BN.docx"
      },
      {
        "labelEn": "All Canva Editable URLs (MD)",
        "labelBn": "সকল ক্যানভা এডিটেবল লিংক (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1TH0BcWnoIhOa96rZnJKoM4r-abTSWzgu/view",
        "fileName": "00_Canva_Editable_URLs_BN.md"
      },
      {
        "labelEn": "Canva Root Folder (All Decks)",
        "labelBn": "ক্যানভা রুট ফোল্ডার (সকল স্লাইড)",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHavzClUOM"
      },
      {
        "labelEn": "Full Google Drive Folder (102 Files)",
        "labelBn": "সম্পূর্ণ Google Drive ফোল্ডার (১০২ ফাইল)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/13YXw5Lxs7-wMXFrG1jjhiGTZ5doyr-DM"
      }
    ],
    "sortOrder": 0,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s00",
    "sessionLabel": "Session 00",
    "titleEn": "Cloud Connect AI Limited & Sanjibon AI Course Orientation",
    "titleBn": "ক্লাউড কানেক্ট এআই লিমিটেড ও সঞ্জীবন এআই কোর্স পরিচিতি",
    "descriptionEn": "Orientation · Pre-Course — Institutional profile, mentor panel, 11 Ansar & VDP training centers (232 trainees), and 5-day applied AI training roadmap.",
    "descriptionBn": "ওরিয়েন্টেশন · কোর্স পরিচিতি — প্রতিষ্ঠান পরিচিতি, মেন্টর প্যানেল, ১১টি আনসার ও ভিডিপি কেন্দ্র (২৩২ জন প্রশিক্ষণার্থী) এবং ৫ দিনের প্রয়োগিক এআই রোডম্যাপ।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1dTM1JfhouK4pVo2hH7LKtbLqx2traduJ",
    "bodyEn": "Orientation pack introducing Cloud Connect AI Limited (CCAI), Lead Instructor Md. Jehad (Certified Google AI Professional, ITEE FE Level 2 Full Passer), strategic leadership, mentor panel, training track record, and how the 5-day, 10-session (30-hour) Applied AI & Autonomous Workflows curriculum for Bangladesh Ansar & VDP Sanjibon Project is structured across 11 computer training centers.",
    "bodyBn": "# ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited) এবং বিশেষায়িত কোর্স পরিচিতি\n## প্রাতিষ্ঠানিক প্রোফাইল, এআই বিশেষজ্ঞতা, পূর্ববর্তী প্রশিক্ষণ, গবেষণা-শিক্ষা কার্যক্রম ও প্রশিক্ষক মণ্ডলী\n\n**প্রস্তুতকারক প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited — `https://cloudconnect-ai.com.bd/`)  \n**অংশীদার প্রকল্প:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প (`১১টি কেন্দ্র`, `২৩২ জন প্রশিক্ষণার্থী`)  \n**কোর্স শিরোনাম:** Applied Artificial Intelligence & Autonomous Workflows for Digital Marketing Freelancers  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer `#FE2023APR00005` (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল লিংক:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n\n---\n\n## অধ্যায় ১: আমরা কারা — ক্লাউড কানেক্ট এআই লিমিটেড (Who We Are)\n\n**Cloud Connect AI Limited** বাংলাদেশের একটি অগ্রণী প্রযুক্তি, কৃত্রিম বুদ্ধিমত্তা (AI), সাইবার নিরাপত্তা এবং পেশাগত দক্ষতা উন্নয়ন প্রতিষ্ঠান, যার মূল দর্শন **\"Born To Connect\"** এবং **\"Connecting Intelligence to Infinity\"**। **\"Built in Bangladesh · AI-First · Security First · Global Ready\"** দৃষ্টিভঙ্গি নিয়ে প্রতিষ্ঠানটি সরকারি, প্রতিরক্ষা, কর্পোরেট ও শিক্ষাপ্রতিষ্ঠান পর্যায়ে নিরাপদ এআই সলিউশন, সফটওয়্যার প্রকৌশল, ডিজিটাল রূপান্তর ও হাতে-কলমে প্রযুক্তি প্রশিক্ষণ প্রদান করে আসছে।\n\n### ১.১ প্রাতিষ্ঠানিক তথ্য ও যোগাযোগ\n\n| তথ্য | বিবরণ |\n| :--- | :--- |\n| **প্রতিষ্ঠানের নাম** | ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited) |\n| **মূল স্লোগান** | *\"Born To Connect\"* • *\"Connecting Intelligence to Infinity\"* |\n| **দৃষ্টিভঙ্গি ও অবস্থান** | Built in Bangladesh · AI-First · Security First · Global Ready |\n| **প্রধান কার্যালয়** | B1, House No. 268, Road No. 19, Mohakhali DOHS, Dhaka-1206, Bangladesh (+ বনানী হাব ও ২৪/৭ SOC এবং প্রশিক্ষণ সুবিধা) |\n| **অফিশিয়াল ওয়েবসাইট** | `https://cloudconnect-ai.com.bd/` |\n| **ইমেইল ও হটলাইন** | `info@cloudconnect-ai.com.bd` • `+8801769056868` • `+8801713091635` |\n\n---\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 14 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (14 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/6rGrs3OnjS8g93k"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/0swyVkCHw4z-IO5"
      },
      {
        "labelEn": "Slides (PDF · 14 slides)",
        "labelBn": "স্লাইড (PDF · ১৪ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1oKruM-A7YADDeTqe_GIAASXjXnrz0U2c/view",
        "fileName": "Session_00_CCAI_Introduction_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1-OUsGOuHhOsYt22Nck2hj8RXWlRagvkp/view",
        "fileName": "Session_00_CCAI_Introduction_Slides.pptx"
      },
      {
        "labelEn": "Course Handbook (DOCX)",
        "labelBn": "কোর্স পরিচিতি (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1m-x3mtLoSpf15GRqQGsunVV9QARQNZl1/view",
        "fileName": "Session_00_CCAI_Introduction_BN.docx"
      },
      {
        "labelEn": "Course Handbook (MD)",
        "labelBn": "কোর্স পরিচিতি (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1oSsft_JBi2tQFY8PyRTWHRve9qnTdrgy/view",
        "fileName": "Session_00_CCAI_Introduction_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1vwtnDCRNsfrWiRa-JkY2N_mVR-aDlsw-/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Ansar & VDP Workshop",
        "labelBn": "ভিজ্যুয়াল: আনসার-ভিডিপি ওয়ার্কশপ",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1Er8YreRnWHpGiVFKBf7yrC5osVjfzh3D/view",
        "fileName": "s0_ansar_vdp_workshop.png"
      },
      {
        "labelEn": "Visual: CCAI AI Cyber Lab",
        "labelBn": "ভিজ্যুয়াল: CCAI এআই ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1Ri6at7swS8ll3bZ-NU9zqoE1fGXdWLUh/view",
        "fileName": "s0_ccai_ai_cyber_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/19HGPd4Be7aUWst1SiCWZCyIfFpl4BUan",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1dTM1JfhouK4pVo2hH7LKtbLqx2traduJ"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHayVp6TKw"
      }
    ],
    "sortOrder": 1,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s01",
    "sessionLabel": "Session 01",
    "titleEn": "Course Orientation, MD Welcome & Prompt Writing Basics (CLEAR Framework)",
    "titleBn": "কোর্স পরিচিতি, এমডি স্বাগত বার্তা ও প্রম্পট রাইটিং বেসিকস (CLEAR ফ্রেমওয়ার্ক)",
    "descriptionEn": "Day 1 · Morning — 5-day capstone overview, CLEAR prompt engineering framework, structured tables & summaries, and 10 starter freelance prompt templates.",
    "descriptionBn": "দিন ১ · সকাল — ৫ দিনের ক্যাপস্টোন রোডম্যাপ, CLEAR প্রম্পট রাইটিং ফ্রেমওয়ার্ক, নির্ভুল টেবিল-সারাংশ ও ১০টি স্টার্টার প্রম্পট লাইব্রেরি।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1tYSB7xhaYLwiQmf7q31DMo3rsNB4WyCu",
    "bodyEn": "Covers the complete 5-day continuous capstone journey, grading rubric (Attendance 10%, Daily Arena Quizzes 25%, Practical Tasks 30%, Final Exam & Capstone Defense 35%), the CLEAR Prompt Writing Framework (Context, Length/Layout, Exact Role, Audience, Rules/Restrictions), weak vs professional prompt examples, hallucination-free tables & summaries, and a 10-template Starter Prompt Library for freelancers.",
    "bodyBn": "# সেশন ০১: পূর্ণাঙ্গ কোর্স ম্যাটেরিয়াল ও শিক্ষার্থী হ্যান্ডবুক\n## কোর্স পরিচিতি, প্রম্পট রাইটিং বেসিকস ও ১০টি স্টার্টার প্রম্পট লাইব্রেরি\n\n**আয়োজনে:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প এবং ক্লাউড কানেক্ট এআই লিমিটেড  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**দিন ১ • সেশন ০১:** সকাল ০৯:০০ – দুপুর ১২:০০ (৩ ঘণ্টা)  \n**ব্যবহৃত টুলস:** Google AI Studio, Google Gemini, ChatGPT, Claude, Onnesha Arena (`https://arena.onnesha.courses/`)\n\n---\n\n## অধ্যায় ১: কোর্স পরিচিতি ও আপনার ৫ দিনের ভ্রমণ\n\nবাংলাদেশ আনসার ও ভিডিপি-র মূলমন্ত্র **“শান্তি, শৃঙ্খলা, উন্নয়ন, নিরাপত্তায় সর্বত্র আমরা”**-কে সামনে রেখে **সঞ্জীবন প্রকল্পের** মাধ্যমে আপনাকে একজন দক্ষ, স্বনির্ভর **এআই-সক্ষম ডিজিটাল মার্কেটিং ফ্রিল্যান্সার** হিসেবে গড়ে তোলার জন্য এই ৫ দিনের (৩০ ঘণ্টার) নিবিড় অনলাইন প্রশিক্ষণটি তৈরি করা হয়েছে।\n\n### ১.১ এই ৫ দিনে আপনি ধাপে ধাপে কী তৈরি করবেন? (একটি পূর্ণাঙ্গ প্রজেক্ট)\nদিন ১-এর প্রথম সেশন থেকেই আপনি আপনার এলাকার বা পছন্দের **একটি বাস্তব পণ্য বা ফ্রিল্যান্সিং ব্র্যান্ড** নির্বাচন করবেন (যেমন: *সঞ্জীবন সুন্দরবন খাঁটি মধু*, *কুমিল্লার খাদি বস্ত্র*, *বগুড়ার ঐতিহ্যবাহী দই*, *পাবনার তাঁত শাড়ি*, *কক্সবাজার অর্গানিক শুঁটকি*, অথবা আপনার নিজস্ব *ডিজিটাল মার্কেটিং এজেন্সি*)। এরপর ৫ দিনে ধাপে ধাপে তৈরি করবেন:\n1. **দিন ১ (সেশন ১–২):** ১০টি প্রম্পট টেমপ্লেট লাইব্রেরি + আপনার ব্যবসার সম্পূর্ণ মার্কেট রিসার্চ রিপোর্ট ও কাস্টম এআই হেল্পার।\n2. **দিন ২ (সেশন ৩–৪):** ৫টি স্টুডিও-মানের প্রোডাক্ট ছবি + Canva-তে ৬টি সোশ্যাল মিডিয়া অ্যাড ব্যানার।\n3. **দিন ৩ (সেশন ৫–৬):** বাংলা/ইংরেজি এআই ভয়েসওভারসহ ১৫–৩০ সেকেন্ডের ভিডিও অ্যাড + ১০টি সেলস কপি।\n4. **দিন ৪ (সেশন ৭–৮):** কোডিং ছাড়াই মোবাইল-বান্ধব ওয়ান-পেজ ওয়েবসাইট + লাইভ ইন্টারনেট লিংক (URL) ও SEO।\n5. **দিন ৫ (সেশন ৯–১০):** আপনার লাইভ ওয়েবসাইটে ২৪/৭ এআই চ্যাটবট + Google Sheet ও ইমেইল অটোমেশন + CCAI বোর্ডের সামনে লাইভ প্রজেক্ট প্রেজেন্টে\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 23 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (23 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/ZGEAoPzsCB5sEqE"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/rGw5vBDDThNdJRo"
      },
      {
        "labelEn": "Slides (PDF · 23 slides)",
        "labelBn": "স্লাইড (PDF · ২৩ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1Iil1o5asipTq6qxXBX2cLcCD9vhRrJ-E/view",
        "fileName": "Session_01_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/107AZ0CZX5ZgzGpsfGe6aima0TylA5tYH/view",
        "fileName": "Session_01_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1QoDcC6wBnF9voHV_MNovz_2StX5f_jhu/view",
        "fileName": "Session_01_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/136I9Xkh6luohjMbUHU7-Dt8CWcOZq49K/view",
        "fileName": "Session_01_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1uKKJpaptxEmo5h94Pk_i4RjkIhW-FO8J/view",
        "fileName": "Session_01_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1U4_vwg_JQX3UrmIW9gDHOMRiVMQVVC-2/view",
        "fileName": "Session_01_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1L9iORhoWbCdhe2Te8KTAgxIKzQACHwAE/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Freelance Products",
        "labelBn": "ভিজ্যুয়াল: ফ্রিল্যান্স প্রোডাক্টস",
        "kind": "image",
        "url": "https://drive.google.com/file/d/144k8hcD2FpNSyVuZZamhw9irno5E7aDT/view",
        "fileName": "session1_freelance_products.png"
      },
      {
        "labelEn": "Visual: MD Orientation",
        "labelBn": "ভিজ্যুয়াল: এমডি ওরিয়েন্টেশন",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1LjXIhRy7-IuCfuM9Enei0d-RBvqNjdW9/view",
        "fileName": "session1_md_orientation.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1G3KOUheO7KbXDcVm1W9yK7Itr8Bdu5YM",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1tYSB7xhaYLwiQmf7q31DMo3rsNB4WyCu"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHavxWcMa8"
      }
    ],
    "sortOrder": 2,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s02",
    "sessionLabel": "Session 02",
    "titleEn": "AI Market, Competitor & Customer Research + Custom AI Helper",
    "titleBn": "এআই দিয়ে মার্কেট, প্রতিযোগী ও ক্রেতা রিসার্চ এবং কাস্টম এআই হেল্পার",
    "descriptionEn": "Day 1 · Afternoon — Buyer Persona, customer review mining, Competitor Matrix & USP discovery, and building a reusable Custom AI Helper in Google AI Studio.",
    "descriptionBn": "দিন ১ · বিকাল — বায়ার পার্সোনা, ক্রেতা রিভিউ বিশ্লেষণ, প্রতিযোগী ম্যাট্রিক্স ও USP নির্ধারণ এবং Google AI Studio-তে কাস্টম এআই হেল্পার তৈরি।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1xwDyy49fEe6lskNt_gLvjvwvWwlICqsM",
    "bodyEn": "Teaches market research fundamentals for Bangladeshi & global freelance brands: 5 core Buyer Persona questions, Customer Feedback Mining from real reviews, Competitor Matrix & Market Gap / USP mapping for Sanjibon products, and step-by-step setup of a free reusable Custom AI Helper using System Instructions in Google AI Studio / Gemini Gems.",
    "bodyBn": "# সেশন ০২: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে বাজার, প্রতিযোগী ও ক্রেতা গবেষণা এবং নিজস্ব Custom AI Helper তৈরি  \n**সেশন:** ১ম দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: মার্কেট রিসার্চ কেন প্রতিটি ডিজিটাল মার্কেটারের প্রথম ধাপ?\nফ্রিল্যান্সিং মার্কেটপ্লেস (যেমন Fiverr বা Upwork) অথবা দেশের কোনো ব্যবসায়ীর জন্য ফেসবুক পেজ চালানোর সময় নতুনদের সবচেয়ে বড় ভুল হলো—গবেষণা না করেই পোস্ট বা বিজ্ঞাপন তৈরি করা। আপনি যদি না জানেন:\n- আপনার পণ্যটি **কে** কিনবে,\n- ক্রেতার মূল **সমস্যা বা ভয়** কী, এবং\n- বাজারে থাকা **অন্য বিক্রেতারা (Competitors)** কোথায় ভুল করছে—\n\nতাহলে সবচেয়ে সুন্দর পোস্টার বা ভিডিও বানিয়েও বিক্রি পাওয়া কঠিন হবে। এআই টুল (**Google AI Studio**, **Gemini**, **ChatGPT**, **Claude**) মাত্র ১০–১৫ মিনিটে আপনাকে একজন পেশাদার মার্কেট রিসার্চ বিশ্লেষকের মতো সাহায্য করতে পারে।\n\n> **গুরুত্বপূর্ণ সতর্কতা:** এআই অনেক সময় অনুমান করে ভুয়া সংখ্যা (যেমন: \"বাংলাদেশের ৭৮% মানুষ এটি পছন্দ করে\") বানিয়ে বলতে পারে। তাই গবেষণা করার সময় সবসময় এআইকে বলুন: *\"মনগড়া পরিসংখ্যান বা মিথ্যা তথ্য দেবে না; কেবল যৌক্তিক বিশ্লেষণ ও আমার দেওয়া তথ্যের ওপর ভিত্তি করে সাজিয়ে দাও।\"*\n\n---\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/po0MPtqSaTlDizx"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/XJPZep6KTsegQhF"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1Dsra0wsVLaPY-76QKdVwg1AjzruhZ_CV/view",
        "fileName": "Session_02_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1ke-S1Koe7AX2r6u2KqZlu_2y93-nd43S/view",
        "fileName": "Session_02_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1FlCmo4ASZ7GwlEvQ95iPMrNLQjYqL6nD/view",
        "fileName": "Session_02_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1xIwmwk6FoGB5-QZ8eYAkLSWJLj4TyKGz/view",
        "fileName": "Session_02_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1s_srna2qmT1YmN9MIJI1cfk_PmknDQaN/view",
        "fileName": "Session_02_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1pAHGUjDYpSxPJncziQzyWUICaFx9djdu/view",
        "fileName": "Session_02_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1cGWQRQVjZbXiAXewKxh6eaXivzU703bU/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Customer Feedback Helper",
        "labelBn": "ভিজ্যুয়াল: ক্রেতা ফিডব্যাক হেল্পার",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1Kq0Bv0EES2i39u4yJWWU_Gk1WKmXPH8W/view",
        "fileName": "s2_customer_feedback_helper.png"
      },
      {
        "labelEn": "Visual: Market Research Lab",
        "labelBn": "ভিজ্যুয়াল: মার্কেট রিসার্চ ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1g3StjeOIDJSzZqVgLN8I7494z4Aj7ORF/view",
        "fileName": "s2_market_research_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1q7ltIwu2oUbUYXOgupyHLY-Gp6d_RGWb",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1xwDyy49fEe6lskNt_gLvjvwvWwlICqsM"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav281-Lg"
      }
    ],
    "sortOrder": 3,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s03",
    "sessionLabel": "Session 03",
    "titleEn": "Professional AI Product Photography & Studio Visuals (SLABC Formula)",
    "titleBn": "এআই দিয়ে প্রফেশনাল প্রোডাক্ট ফটোগ্রাফি ও স্টুডিও ইমেজ তৈরি (SLABC সূত্র)",
    "descriptionEn": "Day 2 · Morning — 5-element SLABC studio photo formula, 1:1 / 9:16 / 16:9 aspect ratios, 5 copy-paste Sanjibon product templates, and Visual QA checklist.",
    "descriptionBn": "দিন ২ · সকাল — স্টুডিও-মানের ছবির ৫-উপাদান SLABC প্রম্পট সূত্র, ১:১ / ৯:১৬ / ১৬:৯ মাপ, ৫টি কপি-পেস্ট প্রম্পট টেমপ্লেট ও Visual QA চেকলিস্ট।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1nP27RxdIBwRhrEaILZgFz2G8YE7Uv5qT",
    "bodyEn": "Master commercial e-commerce product photography using free AI image tools (Google Gemini Imagen, ChatGPT Free, Canva Magic Media). Covers the 5-element SLABC Formula (Subject, Lighting, Angle/Composition, Background/Props, Camera/Color Mood), mandatory aspect ratios (1:1 Feed, 9:16 Reels/Story, 16:9 Hero Banner), 5 ready-to-use Sanjibon templates (honey, Khadi/handloom, dry fish, packaging proof), and the Visual QA checklist.",
    "bodyBn": "# সেশন ০৩: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে স্টুডিও-মানের প্রোডাক্ট ফটোগ্রাফি ও সোশ্যাল মিডিয়া-ওয়েব ইমেজ তৈরি  \n**সেশন:** ২য় দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: ই-কমার্স ও ফ্রিল্যান্সিংয়ে পেশাদার ছবির গুরুত্ব\nঅনলাইনে ক্রেতা আপনার পণ্য হাত দিয়ে ছুঁয়ে দেখতে পারেন না—তিনি কেবল **ছবি দেখে বিশ্বাস করেন**। মোবাইল ফোনে অন্ধকার ঘরে তোলা ঝাপসা ছবিতে যতই দামি পণ্য থাকুক না কেন, ক্রেতার কাছে তা অবিশ্বস্ত মনে হয়। আগে প্রতিটি ব্র্যান্ডকে ফটোগ্রাফার ও স্টুডিও ভাড়া করতে হাজার হাজার টাকা খরচ করতে হতো। এখন এআই টুল (**Google Gemini / Imagen 3**, **ChatGPT Image Generation**) ব্যবহার করে আপনি আপনার সঞ্জীবন পণ্যের জন্য—বা বিদেশি ফ্রিল্যান্সিং ক্লায়েন্টের জন্য—মাত্র কয়েক মিনিটে প্রাকৃতিক ও স্টুডিও-মানের প্রোডাক্ট ছবি তৈরি করতে পারবেন।\n\n> **একটি পেশাদার নিয়ম সবসময় মনে রাখবেন:** ছবি জেনারেট করার সময় কখনো বলবেন না *\"Write Bangla offer text on the image\"*। কারণ ইমেজ-জেনারেশন এআই বাংলা যুক্তবর্ণ ঠিকমতো আঁকতে পারে না। বরং এআই দিয়ে **পরিষ্কার ও বাস্তবসম্মত ছবি (Clean Image)** তৈরি করুন, আর আজ বিকালের সেশন ০৪-এ **Canva** ব্যবহার করে সেই ছবির ওপর নিখুঁত বাংলা ও ইংরেজি লেখা বসান!\n\n---\n\n## অধ্যায় ২: স্টুডিও-মানের ছবির ৫-উপাদান প্রম্পট সূত্র (SLABC Formula)\nইমেজ জেনারেটর টুলগুলো ইংরেজি ফটোগ্রাফি শব্দ বেশি নিখুঁতভাবে বোঝে। তাই আপনি বাংলায় ভাবনা সাজিয়ে নিচের **৫টি উপাদান (SLABC)** অনুসারে ইংরেজি প্রম্পট লিখবেন (চাইলে আপনার Session 02 Custom AI Helper-কেও বলতে পারেন *\"আমার এই পণ্যের জন্য নিচের SLABC সূত্রে ইংরেজি ইমেজ প্রম্পট লিখে দাও\"*):\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/2YhiHq3WrO-iIoF"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/9wnYFf431evafgn"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1N7JS2wxFEHOY0beJqp5wvnjbJyzFLCqX/view",
        "fileName": "Session_03_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1cYnIJnTs28wLvy4tldVOn4kNQP_EEPUh/view",
        "fileName": "Session_03_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1X1Wfi7e7XGsCZRlHCfq6429qFY1w7kHZ/view",
        "fileName": "Session_03_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/12xU-_Zh7XhakEZt2GX0ug-v5JGgantqG/view",
        "fileName": "Session_03_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/10t0wS012fWlhDfGX1kLJumOXCGOGl9w5/view",
        "fileName": "Session_03_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1aFZAR9haJobyS-LTXTxye-AUnvms3y3Z/view",
        "fileName": "Session_03_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1HN5P9Gg-UoVkwGd1gFu4at-EjYvAOyc_/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Product Photo Trainee Lab",
        "labelBn": "ভিজ্যুয়াল: প্রোডাক্ট ফটো ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1PghILIZG-Lt7Y8litlOmt3jc54E4Dvf2/view",
        "fileName": "s3_product_photo_trainee_lab.png"
      },
      {
        "labelEn": "Visual: Studio Honey Sample",
        "labelBn": "ভিজ্যুয়াল: স্টুডিও মধু নমুনা",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1l13PMByFgPLP9svWDdl2vskJZRpWclJG/view",
        "fileName": "s3_studio_honey_sample.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1pyDyi2-X5oEf0eDUFVdIy0sP_ZXEY0nw",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1nP27RxdIBwRhrEaILZgFz2G8YE7Uv5qT"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav4Kwhys"
      }
    ],
    "sortOrder": 4,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s04",
    "sessionLabel": "Session 04",
    "titleEn": "Social Media & Google Ad Banner Design in Canva (6-Banner Campaign)",
    "titleBn": "সোশ্যাল মিডিয়া ও গুগল অ্যাড ব্যানার ডিজাইন (Canva ৬-ব্যানার ক্যাম্পেইন)",
    "descriptionEn": "Day 2 · Afternoon — 3-second scroll test, platform-safe margins, Canva Layers & Bangla typography, Gemini short ad headlines, and 6-banner campaign blueprint.",
    "descriptionBn": "দিন ২ · বিকাল — ৩-সেকেন্ড পরীক্ষা, নিরাপদ মার্জিন, Canva Layers ও বাংলা টাইপোগ্রাফি, Gemini শর্ট কপি ও ৬-ব্যানার ক্যাম্পেইন ব্লুপ্রিন্ট।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1Pm7RcOnZ9iK0ogYbrRhXv3Q3HcuhNGrr",
    "bodyEn": "Turn AI product photos from Session 03 into high-converting Meta & Google Display ad banners in Canva. Covers the 3-second scroll-stop rule, platform sizes & safe margins, Canva Layers (Position -> Layers), clean Bangla typography, Tidy Up alignment, Gemini prompts for short punchy Bengali banner headlines, and a complete 6-Banner Campaign Lab Blueprint + 10 practice MCQs.",
    "bodyBn": "# সেশন ০৪: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** Facebook, Instagram ও Google বিজ্ঞাপন ব্যানার ডিজাইন এবং Canva Layers ব্যবহার  \n**সেশন:** ২য় দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: ডিজিটাল বিজ্ঞাপনে ব্যানারের ভূমিকা (৩-সেকেন্ড পরীক্ষা)\nসকালে আপনি এআই দিয়ে চমৎকার প্রোডাক্ট ছবি তৈরি করেছেন। কিন্তু কেবল একটি সুন্দর ছবি ফেসবুকে ছাড়লে ক্রেতা বুঝবেন না এটি কত টাকা, কেন অন্যদের চেয়ে ভালো, বা কীভাবে অর্ডার করতে হবে। **প্রোমোশনাল ব্যানার** সেই পরিষ্কার ছবির সাথে **সঠিক ক্রেতার বার্তা (Hook + Trust + Offer + CTA)** যুক্ত করে ক্রেতাকে কেনার সিদ্ধান্ত নিতে সাহায্য করে।\n\n**একটি কার্যকর বিজ্ঞাপন ব্যানারের ৪টি স্বর্ণসূত্র:**\n1. **পড়ার যোগ্যতা (Contrast):** পটভূমির ওপর বাংলা লেখা এক পলকে পড়া যাচ্ছে কি না।\n2. **পরিমিত লেখা (Less is More Rule):** ব্যানারে গাদা গাদা কথা না লিখে সর্বোচ্চ **৮–১৪ শব্দে** মূল বক্তব্য দিন।\n3. **বিক্রির কারণ (Value/USP):** সেশন ০২-এ বের করা একটি বড় সমাধান (যেমন: *\"ল্যাব পরীক্ষিত খাঁটি\"*, *\"১০০% কেমিক্যালমুক্ত শুঁটকি\"*, *\"ভাঙনমুক্ত প্যাকিং\"*)।\n4. **পরিষ্কার নির্দেশ (CTA):** ক্রেতা এখন কী করবেন— *\"অর্ডার করুন\"*, *\"ইনবক্সে মেসেজ দিন\"*, বা *\"ভিজিট করুন\"*।\n\n---\n\n## অধ্যায় ২: প্ল্যাটফর্ম অনুযায়ী সঠিক ব্যানারের মাপ ও নিরাপদ মার্জিন\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/Z6meuZR29YewGac"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/FQDO_Q1OgoUOXu4"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1Y0A2VsEQTQBrOqFFcoN14qFAQCeaugbD/view",
        "fileName": "Session_04_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1L6wj0oC0gucT_hhwwLZEGHsLqgS5m82N/view",
        "fileName": "Session_04_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1e_supBLGPKauBAYVcnySKYtGzKORAwU6/view",
        "fileName": "Session_04_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1IMa8cCQAMOtecLb6jCFZYAn4MMrilkxD/view",
        "fileName": "Session_04_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1LFqvcLAW7MvUXnqfCO6E2ioSiTAzCmU7/view",
        "fileName": "Session_04_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1SAnP0pMg0YQiYly2xwaFIwXPV9IARi48/view",
        "fileName": "Session_04_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1pbJLSixXARQM77GNGDA2vEo-OVxAru5U/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Banner Formats Showcase",
        "labelBn": "ভিজ্যুয়াল: ব্যানার ফরম্যাট শোকেস",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1JnPrFjJtbZm2scNAIB3wucwzzYaw6t3l/view",
        "fileName": "s4_banner_formats_showcase.png"
      },
      {
        "labelEn": "Visual: Canva Ad Design Lab",
        "labelBn": "ভিজ্যুয়াল: ক্যানভা অ্যাড ডিজাইন ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1nJzuhMHsB2BsmRxa5CcDWdvc_m70b9U5/view",
        "fileName": "s4_canva_ad_design_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1Rm3x4ACYaYIB6kEN4_j0-ySephj-Ob0G",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1Pm7RcOnZ9iK0ogYbrRhXv3Q3HcuhNGrr"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav0Poy8c"
      }
    ],
    "sortOrder": 5,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s05",
    "sessionLabel": "Session 05",
    "titleEn": "AI Short Video Ads & Natural Bangla/English Voiceover (HPPC Formula)",
    "titleBn": "এআই ভয়েসওভারসহ শর্ট ভিডিও অ্যাড তৈরি (HPPC স্ক্রিপ্ট ও Clipchamp)",
    "descriptionEn": "Day 3 · Morning — 15-30s Reels/Shorts HPPC script framework, image-to-video motion, free Microsoft Clipchamp bn-BD voiceover, audio mixing, and captions.",
    "descriptionBn": "দিন ৩ · সকাল — ১৫–৩০ সেকেন্ড ভিডিও অ্যাডের HPPC ফর্মুলা, ছবি থেকে মুভিং ক্লিপ, ফ্রি Clipchamp বাংলা ভয়েসওভার, অডিও মিক্সিং ও ক্যাপশন।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1cdhVRNOhgsGIC0LmMAZqmIouMgW8yE6J",
    "bodyEn": "Create high-retention 15-30 second Facebook Reels, YouTube Shorts, and TikTok product ads. Covers the 4-part HPPC Script Formula (Hook, Problem, Proof/Product, Call-to-Action), bilingual Gemini script prompts, visual motion generation from Session 03 images, natural free Bangla (bn-BD) & English voiceover via Microsoft Clipchamp / ElevenLabs, audio mixing ratios, bold on-screen captions, and a 25s storyboard sample.",
    "bodyBn": "# সেশন ০৫: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে শর্ট প্রোমোশনাল ভিডিও বিজ্ঞাপন, বাংলা/ইংরেজি ভয়েসওভার ও ক্যাপশন তৈরি  \n**সেশন:** ৩য় দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: কেন এখন শর্ট ভিডিও বিজ্ঞাপন সবচেয়ে বেশি কাজ করে?\nফেসবুক রিলস (Reels), ইউটিউব শর্টস (Shorts) ও টিকটকের যুগে স্থির ছবির চেয়ে ১৫–৩০ সেকেন্ডের **শর্ট ভার্টিক্যাল ভিডিও (`9:16`)** ক্রেতাদের অনেক দ্রুত বিশ্বাস অর্জন করে। আগে একটি ৩০ সেকেন্ডের ভিডিও বিজ্ঞাপন বানাতে ক্যামেরাম্যান, ভয়েস আর্টিস্ট ও এডিটর মিলে হাজার হাজার টাকা লাগত। এখন এআই ব্যবহার করে আপনি একা বসেই—\n1. স্ক্রিপ্ট লিখতে পারবেন (**Gemini**),\n2. ছবি বা টেক্সট থেকে মুভিং ভিডিও ক্লিপ বানাতে পারবেন (**Canva / CapCut / Free AI Video Tools**),\n3. বাস্তবসম্মত বাংলা ও ইংরেজি ভয়েসওভার বানাতে পারবেন (**Microsoft Clipchamp `bn-BD` / Google AI Studio / ElevenLabs**), এবং\n4. অটো-ক্যাপশন যুক্ত করে রপ্তানি করতে পারবেন!\n\n---\n\n## অধ্যায় ২: ১৫–৩০ সেকেন্ড ভিডিও অ্যাডের ৪-অংশ স্ক্রিপ্ট কাঠামো (HPPC Formula)\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/wHhEgdZLGuQLO9i"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/lczgCckdjaDIA-F"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1KMndeR6plbwDwiR0vg1YVCZDeFcbP2kQ/view",
        "fileName": "Session_05_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1C2RZlibEmp7MazD40EByLglEIDLdiAfc/view",
        "fileName": "Session_05_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1a_Dfk-gNmfNVqRKKYp4YZEfSuKi57jew/view",
        "fileName": "Session_05_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1k8sRPF9t79_9zVBFf94RqHxx_5Lx751j/view",
        "fileName": "Session_05_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1TltRLMqMK1NBYr4AtwPwE6_5dhAdPuVd/view",
        "fileName": "Session_05_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1bsmiMqWbuCg0k0dNBOG-tmtguL0J44X6/view",
        "fileName": "Session_05_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1dG_1TH48ToKBk7sWdkaWNoa79799KSC5/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Reels Video Timeline",
        "labelBn": "ভিজ্যুয়াল: রিলস ভিডিও টাইমলাইন",
        "kind": "image",
        "url": "https://drive.google.com/file/d/15Xfbca_XR36j8LXHWrIYZuXMcRl613_F/view",
        "fileName": "s5_reels_video_timeline.png"
      },
      {
        "labelEn": "Visual: Video Voiceover Lab",
        "labelBn": "ভিজ্যুয়াল: ভিডিও ভয়েসওভার ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1JWbARlZeP2bDQ_DWfx9MdVWSuSbty7yn/view",
        "fileName": "s5_video_voiceover_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1rbmscLpyG8rHcsNGh-DIhmXWPi0H3ugI",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1cdhVRNOhgsGIC0LmMAZqmIouMgW8yE6J"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav0mfoE8"
      }
    ],
    "sortOrder": 6,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s06",
    "sessionLabel": "Session 06",
    "titleEn": "High-Converting Ad Copywriting (PAS, AIDA, BAB) & Practical Test 1",
    "titleBn": "বিক্রয়যোগ্য অ্যাড কপি ও সেলস টেক্সট লেখা (PAS, AIDA, BAB) ও প্র্যাকটিক্যাল টেস্ট ১",
    "descriptionEn": "Day 3 · Afternoon — PAS, AIDA & BAB copywriting formulas, audience tone segmentation, 5 Meta/Google ad policy safety rules, 10-copy master prompts & Practical Test 1.",
    "descriptionBn": "দিন ৩ · বিকাল — PAS, AIDA ও BAB কপিরাইটিং সূত্র, অডিয়েন্স টোন, অ্যাড রিজেকশন এড়ানোর ৫ নিয়ম, ১০টি অ্যাড কপি প্রম্পট ও প্র্যাকটিক্যাল টেস্ট ১।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1icLF_d_MX5IpT75fahFUJOwXaiiEimeC",
    "bodyEn": "Write persuasive Bangla & English sales copy that complies with Meta and Google Ads policies. Covers the 3 proven copywriting frameworks (PAS for Bangladeshi Facebook ads, AIDA for premium launches, BAB for transformation storytelling), audience tone adaptation, 5 policy rules to avoid Ad Rejection, master prompts to generate 7 Bengali + 3 international English ad copy variations, and the Day 3 Campaign Pack (Practical Test 1).",
    "bodyBn": "# সেশন ০৬: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** উচ্চ-রূপান্তরকারী সেলস কপি লেখা ও **Practical Test 1** (পূর্ণাঙ্গ অ্যাড ক্যাম্পেইন প্যাক)  \n**সেশন:** ৩য় দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: সেলস কপি (Ad Copy) কেন ডিজাইনের সমান গুরুত্বপূর্ণ?\nছবি এবং ভিডিও ক্রেতার চোখ থামায়, কিন্তু ক্রেতার মন জয় করে অর্ডার বাটনে চাপ দেওয়াতে বাধ্য করে আপনার **সেলস কপি বা ক্যাপশন**। ফেসবুকে একটি বিজ্ঞাপনের প্রথম **১২৫ অক্ষর (প্রায় ২ লাইন)** *\"See More\"* লেখার ওপরে দেখা যায়। তাই এই ২ লাইন যদি হয় দুর্বল, ক্রেতা বাকি লেখা না পড়েই চলে যান!\n\n---\n\n## অধ্যায় ২: কপিরাইটিংয়ের ৩টি বিশ্বমানের সূত্র (Google Gemini ব্যবহারের ফ্রেমওয়ার্ক)\n\n### ১. PAS সূত্র (বাংলাদেশি ফেসবুক বিজ্ঞাপনের সেরা সূত্র)\n- **P — Problem (সমস্যা):** ক্রেতার বাস্তব সমস্যা বা ভয় নিয়ে প্রশ্ন করুন (*\"বাজারের ভেজাল শুঁটকিতে ক্ষতিকর কেমিক্যাল নিয়ে চিন্তিত?\"*)\n- **A — Agitate (গভীরতা বোঝানো):** এই সমস্যায় ক্রেতা কীভাবে ক্ষতিগ্রস্ত হন তা মনে করান (*\"অনেকেই অজান্তে বিষাক্ত স্প্রে দেওয়া খাবার পরিবারের পাতে তুলে দিচ্ছেন।\"*)\n- **S — Solution (সমাধান ও CTA):** আপনার পণ্যের আসল প্রমাণ + সহজ অর্ডার নিয়ম দিন (*\"কক্সবাজারের রোদে শুকানো ১০০% কেমিক্যালমুক্ত ভ্যাকুয়াম প্যাক শুঁটকি পাচ্ছেন ক্যাশ অন ডেলিভারিতে! অর্ডার করতে মেসেজ দিন।\"*)\n\n### ২. AIDA সূত্র (নতুন ও প্রিমিয়াম পণ্যের জন্য)\n- **A — Attention (মনোযোগ):** চমকপ্রদ শুরু বা অফার\n- **I — Interest (আগ্রহ):** পণ্য কীভাবে তৈরি বা কেন অনন্য\n- **D — Desire (আকাঙ্ক্ষা):** এটি ব্যবহার করলে ক্রেতা কী অনুভূতি বা সুবিধা পাবেন\n- **A — Action (পদক্ষেপ):** স্পষ্ট CTA ও লিমিটেড টাইম সুবিধা\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/Fj4XuPXyofwWvca"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/Ev6ZPZbAFjXH0-6"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1oPseiY_cKIb-S1UxW0khe-lkvRdzIbKb/view",
        "fileName": "Session_06_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1I4eLNzysliVrs7cB17dU3LyeZhxlxu6G/view",
        "fileName": "Session_06_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1i_h9-_syynIx3kV4_DwUga5VDqKaRu7f/view",
        "fileName": "Session_06_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1RSE-HRxD-v4RRhDrFQwJMrPQMfY2QmT8/view",
        "fileName": "Session_06_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/14x-ZYbLSLM7pG8mhh9Xgqc_bqwesckl9/view",
        "fileName": "Session_06_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1IcMa4DvfF1sBuXHeS3l1Nac7BwXvSUpD/view",
        "fileName": "Session_06_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1UDOIoZjvADY5DrtPHGzgLymIMV9Hta3f/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Campaign Pack Flatlay",
        "labelBn": "ভিজ্যুয়াল: ক্যাম্পেইন প্যাক",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1vtH1h6cHMMoqwCFZG54-4Ncwv8DRQ4Zy/view",
        "fileName": "s6_campaign_pack_flatlay.png"
      },
      {
        "labelEn": "Visual: Copywriting Lab",
        "labelBn": "ভিজ্যুয়াল: কপিরাইটিং ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/197QmBlUfm7LyxrZchmWs61tf8Mzeg41d/view",
        "fileName": "s6_copywriting_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1UzCv1NxapTJrPmCZ0eGofUzeSVrLMTkX",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1icLF_d_MX5IpT75fahFUJOwXaiiEimeC"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav8aYZMM"
      }
    ],
    "sortOrder": 7,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s07",
    "sessionLabel": "Session 07",
    "titleEn": "No-Code Modern Sales Website Building with AI (Single index.html)",
    "titleBn": "কোডিং ছাড়াই এআই দিয়ে আধুনিক সেলস ওয়েবসাইট নির্মাণ",
    "descriptionEn": "Day 4 · Morning — 6 essential high-converting landing page sections, master copy-paste index.html prompt (Tailwind CDN + order form), local folder setup & responsive check.",
    "descriptionBn": "দিন ৪ · সকাল — বিক্রয়-উপযোগী ১-পৃষ্ঠার ওয়েবসাইটের ৬টি সেকশন, মাস্টার index.html প্রম্পট, ফোল্ডার ও ছবি যুক্ত করা এবং মোবাইল রেসপনসিভ চেক।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1b53seTz0Fx4aw6Yxqb-em2SgeJv-zcwg",
    "bodyEn": "Build a complete responsive one-page sales landing page without writing code manually using Gemini Canvas, Claude Artifacts, or ChatGPT Canvas (plus v0/Bolt/Lovable options). Covers the 6 essential landing page sections (Hero + CTA, Problem/Solution, Product Showcase, Social Proof/Reviews, Offer/Pricing, Cash-on-Delivery Order Form), master prompt for a single self-contained Tailwind CDN index.html, adding local images, and mobile/desktop testing.",
    "bodyBn": "# সেশন ০৭: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** কোডিং ছাড়াই কেবল টেক্সট প্রম্পট দিয়ে আধুনিক রেসপনসিভ ওয়েবসাইট নির্মাণ  \n**সেশন:** ৪র্থ দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: কোডিং না জেনেই ওয়েবসাইট তৈরি — নতুন যুগের ফ্রিল্যান্সিং\nএকসময় একটি সাধারণ ব্যবসায়িক ওয়েবসাইট তৈরি করতে HTML, CSS, JavaScript শেখা লাগত বা ওয়েব ডেভেলপারকে ১৫–৩০ হাজার টাকা দিতে হতো। এখন **Google Gemini (Canvas)**, **Claude (Artifacts)**, **ChatGPT (Canvas)**, **Bolt** বা **v0**-এর মতো আধুনিক এআই টুলে আপনি কেবল বাংলায় বা সহজ ইংরেজিতে *\"আমার কী ধরনের ওয়েবসাইট চাই\"* লিখে দিলেই এআই কয়েক সেকেন্ডে সম্পূর্ণ ওয়েবসাইট তৈরি করে আপনার চোখের সামনে লাইভ দেখিয়ে দেবে!\n\n**এই সেশনে তৈরি ওয়েবসাইটটি আমাদের পুরো ৫-দিনের ক্যাপস্টোন প্রজেক্টের কেন্দ্রবিন্দু:**\n- এতে বসবে সেশন ০২-এর **USP**, সেশন ০৩-এর **প্রোডাক্ট ছবি**, ও সেশন ০৬-এর **বিক্রয়যোগ্য লেখা**।\n- আজ বিকালে (সেশন ০৮) এটিকে আমরা সম্পূর্ণ ফ্রিতে অনলাইনে **পাবলিশ (Live URL)** করবো।\n- আগামীকাল (সেশন ০৯) এই সাইটে **২৪/৭ এআই চ্যাটবট ও স্বয়ংক্রিয় Google Sheet অর্ডার সেভিং** যুক্ত করবো!\n\n---\n\n## অধ্যায় ২: একটি বিক্রয়-উপযোগী ১-পৃষ্ঠার ওয়েবসাইটের ৬টি অপরিহার্য সেকশন\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 21 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (21 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/3d7UgyLknnOYaGy"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/XSHR8VidyrXyLaH"
      },
      {
        "labelEn": "Slides (PDF · 21 slides)",
        "labelBn": "স্লাইড (PDF · ২১ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1svf3GnO1NU59KAYbgwFZeyWSfN_PTTRF/view",
        "fileName": "Session_07_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1WA0-qlvH3p0hS3yF2Rir9oj-F8_x0NQr/view",
        "fileName": "Session_07_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1KsUuJCTRHgbM0CzTQkYBPYuX3m7syDa_/view",
        "fileName": "Session_07_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1h95qSv2f_lzc-AV38Qa82yNAXj-axdPC/view",
        "fileName": "Session_07_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1q73wApWidJ_cCbbcnK8eRxq4C4X-YDXY/view",
        "fileName": "Session_07_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1iEQUZTefKafJHnZOawBUYcDDMCGE5kpa/view",
        "fileName": "Session_07_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1JG43l9yHOhZSeziS4tcgQnLvq7wuTUSp/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Mobile & Desktop Preview",
        "labelBn": "ভিজ্যুয়াল: মোবাইল ও ডেস্কটপ প্রিভিউ",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1yZRUWn4tZ0CMwPrfyXh0Al0xeBUDwD3Z/view",
        "fileName": "s7_mobile_desktop_preview.png"
      },
      {
        "labelEn": "Visual: No-Code Web Lab",
        "labelBn": "ভিজ্যুয়াল: নো-কোড ওয়েব ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/12D5_JrAVNDwXVFfnXqeLcazfMhZpKTBJ/view",
        "fileName": "s7_nocode_web_lab.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1UBb0FJSYRpJuvUpc6vpsL5IDgw0zXBtl",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1b53seTz0Fx4aw6Yxqb-em2SgeJv-zcwg"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHavzkjP3M"
      }
    ],
    "sortOrder": 8,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s08",
    "sessionLabel": "Session 08",
    "titleEn": "Live Website Publishing (Netlify Drop / Vercel) & Basic SEO",
    "titleBn": "ওয়েবসাইট লাইভ পাবলিশিং (Netlify Drop / Vercel) ও বেসিক SEO",
    "descriptionEn": "Day 4 · Afternoon — Publish live HTTPS websites in 3 minutes on Netlify Drop, mobile & PageSpeed optimization, meta tags & Facebook Open Graph SEO.",
    "descriptionBn": "দিন ৪ · বিকাল — Netlify Drop-এ ৩ মিনিটে লাইভ HTTPS পাবলিশিং, মোবাইল ও স্পিড যাচাই, Google SEO ও Facebook Open Graph মেটা ট্যাগ।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1m3A-7kO7AMHu_mr0sHbJSQyIj8zVM3NN",
    "bodyEn": "Take your local sales landing page live on the global internet with free HTTPS hosting via Netlify Drop (app.netlify.com/drop) and Vercel. Includes image compression & PageSpeed checks, mobile QA, and ready-to-paste Gemini prompts for complete head SEO tags (Title, Meta Description, Open Graph og:title/og:image for crisp Facebook link previews) plus 10 deployment & SEO practice MCQs.",
    "bodyBn": "# সেশন ০৮: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** ওয়েবসাইট ফ্রি লাইভ পাবলিশিং (Netlify/Vercel), মোবাইল গতি পরীক্ষা ও বেসিক SEO  \n**সেশন:** ৪র্থ দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: কম্পিউটারের ফাইল থেকে সারা বিশ্বের ইন্টারনেটে (হোস্টিং ধারণা)\nসকালে আপনার তৈরি করা `index.html` ফাইলটি এখন কেবল **আপনার নিজের কম্পিউটারে** আছে। আপনি লিংক কাউকে পাঠালে (`C:\\Users\\...\\index.html`) সে দেখতে পারবে না! সবাই যেন নিজের মোবাইল ফোন থেকে পৃথিবীর যেকোনো জায়গা থেকে আপনার ওয়েবসাইট দেখতে পারেন, সেজন্য ফাইলটি একটি ২৪ ঘণ্টা চালু থাকা ইন্টারনেট সার্ভারে রাখতে হয়—একে বলে **ওয়েব হোস্টিং (Web Hosting)**।\n\n**সুখবর:** এখন শিক্ষার্থীদের অনুশীলন, পোর্টফোলিও এবং ছোট ব্যবসায়িক ল্যান্ডিং পেজ হোস্ট করার জন্য **Netlify** এবং **Vercel** সম্পূর্ণ বিনামূল্যে **HTTPS (`🔒` নিরাপদ তালা চিহ্নযুক্ত)** লাইভ লিংক প্রদান করে—কোনো ক্রেডিট কার্ড ছাড়াই!\n\n---\n\n## অধ্যায় ২: Netlify Drop-এ ৩ মিনিটে লাইভ ওয়েবসাইট প্রকাশ (ধাপে ধাপে)\n*(সবচেয়ে সহজ ও নির্ভরযোগ্য পদ্ধতি—কোনো কোডিং কমান্ড ছাড়াই)*\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/5oXXaoCDTGqzHDC"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/ADbyzoyptUPXdkH"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1w8isFzVB-7RGZljiizCnzy35jqoelzZ5/view",
        "fileName": "Session_08_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1Edj9g2Si8lD3aXHpvSES5H_DF5pjm6St/view",
        "fileName": "Session_08_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/15OYaplDPRjP3IhHrxHPSRLF_M89b-eln/view",
        "fileName": "Session_08_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1A5Rp4MBj7Y4T4MFbjUKEM4BYldW0FD_D/view",
        "fileName": "Session_08_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1QtxfmRu4A4lyu9omM3jT7GC5Ec7Q3k8m/view",
        "fileName": "Session_08_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1G-lhluukkF1GpdTyGysRGzF_NyMe8-hV/view",
        "fileName": "Session_08_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1NeCpgqlct7O5hgeYmn-SSNB8VijXyvZG/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Live Publish Lab",
        "labelBn": "ভিজ্যুয়াল: লাইভ পাবলিশ ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1FItmh-dtXFsuCIbVWifDYkzpixBiObKF/view",
        "fileName": "s8_live_publish_lab.png"
      },
      {
        "labelEn": "Visual: SEO & PageSpeed",
        "labelBn": "ভিজ্যুয়াল: SEO ও পেজস্পিড",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1t7q6fRfxHU8931WEIhGO0d98Np9k9y__/view",
        "fileName": "s8_seo_pagespeed_visual.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/14_0IqC4quPMYJP7IhzpOQZJZhs_huNU1",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1m3A-7kO7AMHu_mr0sHbJSQyIj8zVM3NN"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav-xsGzs"
      }
    ],
    "sortOrder": 9,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s09",
    "sessionLabel": "Session 09",
    "titleEn": "24/7 AI Customer Chatbot (Voiceflow) & Lead Automation (Make.com)",
    "titleBn": "২৪/৭ এআই কাস্টমার চ্যাটবট (Voiceflow) ও লিড অটোমেশন (Make.com)",
    "descriptionEn": "Day 5 · Morning — Autonomous marketing workflows, Voiceflow Knowledge Base chatbot embedded on website, and Make.com Custom Webhook -> Google Sheets + Email automation.",
    "descriptionBn": "দিন ৫ · সকাল — অটোনমাস ওয়ার্কফ্লো, Voiceflow নলেজবেস চ্যাটবট ওয়েবসাইটে যুক্ত করা এবং Make.com ওয়েবহুক দিয়ে অটোমেটিক Google Sheets ও ইমেইল লিড সেভিং।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1n-MYjIE951koiXFz_ZFYsoyuIBl4Be3L",
    "bodyEn": "Automate customer support and order capture 24/7 with zero server maintenance. Step-by-step lab building a Knowledge-Base-powered Voiceflow AI Chatbot embedded directly into your live landing page, plus connecting your website order form via Make.com Custom Webhook to automatically append leads into Google Sheets and trigger instant email notifications, finished with an End-to-End system test.",
    "bodyBn": "# সেশন ০৯: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** ২৪/৭ এআই কাস্টমার চ্যাটবট (`Voiceflow`) ও ফর্ম-টু-গুগল শিট-ইমেইল অটোমেশন (`Make.com`)  \n**সেশন:** ৫ম দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: ডিজিটাল মার্কেটিংয়ে স্বয়ংক্রিয় কর্মপ্রবাহ (Autonomous Workflow) কী?\nগত ৪ দিনে আপনি মার্কেট রিসার্চ, ছবি, ব্যানার, ভিডিও, সেলস কপি ও একটি লাইভ ওয়েবসাইট তৈরি করেছেন। কিন্তু ব্যবসা বা ক্লায়েন্টের কাজ শুরু হলে ২টি বড় বাস্তব সমস্যা দেখা দেয়:\n1. **রাত-দিন ক্রেতার একই প্রশ্নের উত্তর দেওয়া:** *\"দাম কত?\", \"খাঁটি তো?\", \"ডেলিভারি কবে পাবো?\"* — মানুষ একা ২৪ ঘণ্টা অনলাইনে বসে থাকতে পারে না।\n2. **অর্ডার ফর্মের তথ্য হারিয়ে যাওয়া:** ক্রেতা ওয়েবসাইটে ফর্ম পূরণ করলেন, কিন্তু বিক্রেতা সাথে সাথে না জানলে বা ডাটা সংরক্ষিত না থাকলে বিক্রি হাতছাড়া হয়।\n\nআজ আমরা কোনো সার্ভার খরচ বা প্রোগ্রামিং ছাড়াই **Voiceflow** ও **Make.com** দিয়ে এই পুরো প্রক্রিয়াটিকে স্বয়ংক্রিয় (**Autonomous Workflow**) করবো!\n\n---\n\n## অধ্যায় ২: Voiceflow-তে ২৪/৭ এআই কাস্টমার চ্যাটবট তৈরি (ধাপে ধাপে)\n*(ফ্রি প্ল্যানে সরাসরি কাজ করে এবং এক টুকরো স্ক্রিপ্টেই আপনার ওয়েবসাইটে বসে যায়)*\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 23 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (23 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/Q0czCFJtc3GSYGw"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/lBgTE6wTe2T28Vk"
      },
      {
        "labelEn": "Slides (PDF · 23 slides)",
        "labelBn": "স্লাইড (PDF · ২৩ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1BicqSZMfz4VQtnb0SWiN_9_YT8BpEhx7/view",
        "fileName": "Session_09_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1sJDK3QxVkH9s3rfKpaZ-j-xM0FfJGSxQ/view",
        "fileName": "Session_09_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1ZVczaBwlawEGbr1R8DUqD5cwy6Il2VEU/view",
        "fileName": "Session_09_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/14W0ZBN9-DDSReg_RRqVpLxMJfr_Mg_Bk/view",
        "fileName": "Session_09_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/16EVQpK-E06zNq5XiHr0fbwVkT2G0mTNr/view",
        "fileName": "Session_09_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1i0st2XhxJS3_3JibNnPpKpbueLcxhxol/view",
        "fileName": "Session_09_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1kc4Tj4PAIqsJ0hPwlT0MyL84wQLwzcha/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Chatbot Automation Lab",
        "labelBn": "ভিজ্যুয়াল: চ্যাটবট অটোমেশন ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/10gZJJxN-9jCZFM_sA_oQVYNapjD-uDTt/view",
        "fileName": "s9_chatbot_automation_lab.png"
      },
      {
        "labelEn": "Visual: Workflow Diagram Desk",
        "labelBn": "ভিজ্যুয়াল: ওয়ার্কফ্লো ডায়াগ্রাম",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1pCgKkb0gO75oMiYgDxRV0svsu9Pde5pe/view",
        "fileName": "s9_workflow_diagram_desk.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1v3Chzs4VmVB6Anc4XNgX61h907jZnx-1",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1n-MYjIE951koiXFz_ZFYsoyuIBl4Be3L"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav3NCbbg"
      }
    ],
    "sortOrder": 10,
    "published": true
  },
  {
    "id": "mat-sanjibon-drive-s10",
    "sessionLabel": "Session 10",
    "titleEn": "Final Exam, 3-Minute Capstone Defense & 7/30/90-Day Freelance Career Roadmap",
    "titleBn": "চূড়ান্ত পরীক্ষা, ক্যাপস্টোন ডিফেন্স ও ফ্রিল্যান্সিং ক্যারিয়ার রোডম্যাপ",
    "descriptionEn": "Day 5 · Afternoon — 30-question Final Mock Exam bank, 3-minute live capstone pitch script, LMS submission checklist, 5 sellable AI services & Fiverr/Upwork outreach templates.",
    "descriptionBn": "দিন ৫ · বিকাল — ৩০টি চূড়ান্ত অনুশীলন প্রশ্ন ব্যাংক, ৩ মিনিটের লাইভ ক্যাপস্টোন ডিফেন্স স্ক্রিপ্ট, জমার চেকলিস্ট ও ৭/৩০/৯০ দিনের ফ্রিল্যান্সিং রোডম্যাপ।",
    "type": "slide",
    "url": "https://drive.google.com/drive/folders/1PE0ZfFRo5IXBTtW6X8neQFgMDSpB_2_L",
    "bodyEn": "Capstone graduation and freelance launch guide. Includes complete course recap, 30-question Final Comprehensive Mock Exam Bank, 3-minute Live Capstone Defense Pitch Script & final submission checklist, 5 high-demand AI services you can offer immediately, a 7 / 30 / 90-day career action plan, copy-paste Bangladeshi & international client outreach message templates, and sample Fiverr Gig package tiers.",
    "bodyBn": "# সেশন ১০: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** চূড়ান্ত পরীক্ষা (Final Exam), লাইভ ক্যাপস্টোন ডিফেন্স ও ফ্রিল্যান্সিং ক্যারিয়ার রোডম্যাপ  \n**সেশন:** ৫ম দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: ফাইনাল পরীক্ষার নির্দেশনা ও সম্পূর্ণ কোর্সের সারসংক্ষেপ\nঅভিনন্দন! আপনি সফলভাবে ৫ দিনব্যাপী **৩০ ঘণ্টার Applied AI & Autonomous Workflows** প্রশিক্ষণের চূড়ান্ত ধাপে পৌঁছেছেন। দুপুর ০২:১৫-এ [arena.onnesha.courses](https://arena.onnesha.courses/)-এ **Final Comprehensive Exam** শুরু হবে। নিচের ১-নজরে ৫ দিনের মানচিত্রটি পরীক্ষার আগে ঝালাই করে নিন:\n\n| দিন | সকাল (০৯:০০–১২:০০) | বিকাল (০২:০০–০৫:০০) | মূল টুলস ও ডেলিভারেবল |\n| :---: | :--- | :--- | :--- |\n| **১ম দিন** | সেশন ০১: এআই পরিচিতি ও **CLEAR** প্রম্পট | সেশন ০২: মার্কেট রিসার্চ, USP ও **Custom AI Helper** | Google AI Studio, Gemini Gems, Market Report |\n| **২য় দিন** | সেশন ০৩: স্টুডিও প্রোডাক্ট ছবি (**SLABC**, `1:1`, `9:16`, `16:9`) | সেশন ০৪: অ্যাড ব্যানার ডিজাইন ও **Canva Layers** | Gemini Imagen, Canva (৬-ব্যানার সেট) |\n| **৩য় দিন** | সেশন ০৫: **১৫–৩০ সে. ভিডিও অ্যাড** ও বাংলা/ইংরেজি ভয়েস | সেশন ০৬: **PAS/AIDA/BAB** সেলস কপি + **Practical Test 1** | Clipchamp (`bn-BD`), ElevenLabs, Gemini Copy |\n| **৪র্থ দিন** | সেশন ০৭: কোডিং ছাড়া **Single-Page ওয়েবসাইট** (`index.html`) | সেশন ০৮: **Netlify/Vercel লাইভ হোস্টিং** ও বেসিক SEO | Gemini Canvas/Bolt, Netlify Drop, PageSpeed |\n| **৫ম দিন** | সেশন ০৯: **২৪/৭ Voiceflow চ্যাটবট** ও **Make.com অটোমেশন** | সেশন ১০: **ফাইনাল পরীক্ষা + ক্যাপস্টোন ডিফেন্স + ক্যারিয়ার** | Voiceflow, Make, Google Sheets, Onnesha Arena |\n\n---\n…",
    "resources": [
      {
        "labelEn": "Canva Slides (View · 22 slides)",
        "labelBn": "ক্যানভা স্লাইড দেখুন (22 স্লাইড)",
        "kind": "canva_view",
        "url": "https://www.canva.com/d/I1urVYG_5mYKnct"
      },
      {
        "labelEn": "Canva Editable Link",
        "labelBn": "ক্যানভা এডিটেবল লিংক",
        "kind": "canva_edit",
        "url": "https://www.canva.com/d/DSs3MtvcpXfJKkh"
      },
      {
        "labelEn": "Slides (PDF · 22 slides)",
        "labelBn": "স্লাইড (PDF · ২২ স্লাইড)",
        "kind": "pdf",
        "url": "https://drive.google.com/file/d/1BvJqQoPv9RdclYm_RZY7Jo9MJCPFu1jQ/view",
        "fileName": "Session_10_Slides.pdf"
      },
      {
        "labelEn": "Slides (PPTX)",
        "labelBn": "স্লাইড (PPTX)",
        "kind": "pptx",
        "url": "https://drive.google.com/file/d/1e6Q2YroX77oyA_yoYO03XDkCKHKFx_C5/view",
        "fileName": "Session_10_Slides.pptx"
      },
      {
        "labelEn": "Course Material (DOCX)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1KF_j5A2JiQEJ47p-kA-rpY1hd1gXqEgn/view",
        "fileName": "Session_10_Course_Material_BN.docx"
      },
      {
        "labelEn": "Course Material (MD)",
        "labelBn": "কোর্স ম্যাটেরিয়াল (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1i-ygQNl4DA8olbOvIPqSxWLWDIXojU3a/view",
        "fileName": "Session_10_Course_Material_BN.md"
      },
      {
        "labelEn": "Lesson Plan (DOCX)",
        "labelBn": "লেসন প্ল্যান (DOCX)",
        "kind": "docx",
        "url": "https://drive.google.com/file/d/1sUHrzi2g-7VFf9J9i_ptKUBMEEsjIMfR/view",
        "fileName": "Session_10_Lesson_Plan_BN.docx"
      },
      {
        "labelEn": "Lesson Plan (MD)",
        "labelBn": "লেসন প্ল্যান (MD)",
        "kind": "md",
        "url": "https://drive.google.com/file/d/1FKVFPb3moQW7dEGYuIfcm0nuwvVmwWCN/view",
        "fileName": "Session_10_Lesson_Plan_BN.md"
      },
      {
        "labelEn": "Canva Links (.txt)",
        "labelBn": "ক্যানভা লিংক (.txt)",
        "kind": "txt",
        "url": "https://drive.google.com/file/d/1LMffwXs2zhSUP9KvkfdQQhVdKFgSm5ZP/view",
        "fileName": "Canva_Editable_Link.txt"
      },
      {
        "labelEn": "Visual: Capstone Defense Lab",
        "labelBn": "ভিজ্যুয়াল: ক্যাপস্টোন ডিফেন্স ল্যাব",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1tmc_PAClLLLwe1hPGXIKx59mFaz9BH8D/view",
        "fileName": "s10_capstone_defense_lab.png"
      },
      {
        "labelEn": "Visual: Freelance Growth Roadmap",
        "labelBn": "ভিজ্যুয়াল: ফ্রিল্যান্স গ্রোথ রোডম্যাপ",
        "kind": "image",
        "url": "https://drive.google.com/file/d/1zWOud4B2spxziUZiXW0dnrmSbZLBUcnX/view",
        "fileName": "s10_freelance_growth_roadmap.png"
      },
      {
        "labelEn": "Visuals Folder (Drive)",
        "labelBn": "ভিজ্যুয়াল ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1HcisNeI_li5DzN3q27FI4veV-BW_M1aH",
        "fileName": "visuals/"
      },
      {
        "labelEn": "Session Folder (Drive)",
        "labelBn": "সেশন ফোল্ডার (Drive)",
        "kind": "folder",
        "url": "https://drive.google.com/drive/folders/1PE0ZfFRo5IXBTtW6X8neQFgMDSpB_2_L"
      },
      {
        "labelEn": "Canva Session Folder",
        "labelBn": "ক্যানভা সেশন ফোল্ডার",
        "kind": "canva_folder",
        "url": "https://www.canva.com/folder/FAHav_9vMNk"
      }
    ],
    "sortOrder": 11,
    "published": true
  }
] as Array<Omit<CourseMaterial, "courseId" | "createdAt" | "updatedAt">>).map(
    (item) => ({
      ...item,
      courseId,
      createdAt: DRIVE_SEED_TS,
      updatedAt: DRIVE_SEED_TS,
    }),
  );
}

export function buildSanjibonDriveKnowledgeBase(
  courseId: string = SANJIBON_COURSE.id,
): CourseKnowledgeEntry[] {
  return ([
  {
    "id": "kb-sanjibon-drive-master-syllabus",
    "titleEn": "Master Syllabus, 11 Training Centers (232 Trainees) & Zero-Paywall AI Tool Stack",
    "titleBn": "মাস্টার সিলেবাস, ১১টি প্রশিক্ষণ কেন্দ্র (২৩২ জন) ও ফ্রি এআই টুল স্ট্যাক",
    "category": "syllabus",
    "pinned": true,
    "enabled": true,
    "tags": [
      "syllabus",
      "232 trainees",
      "11 centers",
      "sanjibon",
      "canva",
      "schedule",
      "free tools",
      "drive"
    ],
    "sourceFileName": "00_Course_Master_Syllabus_Analysis_and_Canva_Index_BN.md",
    "content": "# বাংলাদেশ আনসার ও ভিডিপি (সঞ্জীবন প্রকল্প) — প্রয়োগিক এআই ও অটোনমাস ওয়ার্কফ্লো প্রশিক্ষণ\n## সিলেবাস গভীর বিশ্লেষণ, ৫ দিনের মাস্টার কারিকুলাম ও ক্যানভা কোর্স ইনডেক্স\n\n**আয়োজক অংশীদার:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প এবং ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited — `https://cloudconnect-ai.com.bd/`)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক (Prepared by & Lead Instructor):** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer `#FE2023APR00005` (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**কোর্স শিরোনাম:** Applied Artificial Intelligence & Autonomous Workflows for Digital Marketing Freelancers  \n**প্রশিক্ষণ শুরুর তারিখ:** ১৫ নভেম্বর ২০২৬ (৫ কর্মদিবস • ১০টি সেশন • মোট ৩০ ঘণ্টা)  \n**প্রশিক্ষণ মাধ্যম:** ১০০% অনলাইন লাইভ ক্লাস (লাইভ ভিডিও, স্ক্রিন শেয়ারিং ও সরাসরি ইনস্ট্রাক্টর মেন্টরিং)  \n**পরীক্ষা ও কুইজ পোর্টাল:** Onnesha Arena (`https://arena.onnesha.courses/`) এবং প্রকল্প জমা পোর্টাল: Sanjibon LMS  \n\n---\n\n## ১. সিলেবাসের গভীর বিশ্লেষণ (Deep Syllabus Analysis)\n\nমূল ৩-পৃষ্ঠার সিলেবাস (`Sanjibon_AI_Training_Online_3Page_Syllabus.pdf`) পর্যালোচনা করে প্রশিক্ষণটির সফল বাস্তবায়ন ও ২৩২ জন প্রশিক্ষণার্থীর সর্বোচ্চ আউটপুট নিশ্চিত করতে নিচের কৌশলগত দিকগুলো চিহ্নিত করা হয়েছে:\n\n### ক. অংশগ্রহণকারী ও ১১টি কেন্দ্রের ভৌগোলিক বৈচিত্র্য (মোট ২৩২ জন)\nপ্রশিক্ষণার্থীরা দেশের ৮টি বিভাগের বিভিন্ন প্রান্তের **১১টি আনসার ও ভিডিপি কম্পিউটার প্রশিক্ষণ কেন্দ্রে** উপস্থিত থেকে অনলাইনে যুক্ত হবেন:\n\n| ক্রমিক | কম্পিউটার প্রশিক্ষণ কেন্দ্র | প্রশিক্ষণার্থী সংখ্যা | আঞ্চলিক ব্যবসায়িক উদাহরণ (প্র্যাকটিক্যাল কেস স্টাডি) |\n| :---: | :--- | :---: | :--- |\n| ১ | গাজীপুর কম্পিউটার প্রশিক্ষণ কেন্দ্র | ১৯ | স্মার্ট এগ্রো-ফার্ম, অর্গানিক সবজি ও মধু ব্র্যান্ড |\n| ২ | কুমিল্লা কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২১ | ঐতিহ্যবাহী কুমিল্লার খাদি ও হ্যান্ডলুম পোশাক |\n| ৩ | ঝালকাঠি কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২৪ | পেয়ারা-আমড়া প্রক্রিয়াজাত পণ্য ও ক্ষুদ্র কৃষি উদ্যোক্তা |\n| ৪ | কক্সবাজার কম্পিউটার প্রশিক্ষণ কেন্দ্র | ১৬ | অর্গানিক শুঁটকি, সামুদ্রিক পণ্য ও ইকো-ট্যুরিজম |\n| ৫ | কিশোরগঞ্জ কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২১ | হাওরের মাছ, পনির (অষ্টগ্রাম) ও নকশিকাঁথা |\n| ৬ | সিলেট কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২১ | সিলেটের চা, শীতলপাটি ও আগর-আতর ব্র্যান্ড |\n| ৭ | নোয়াখালী কম্পিউটার প্রশিক্ষণ কেন্দ্র | ১৭ | নারিকেল-ভিত্তিক পণ্য, দুগ্ধজাত পণ্য ও স্থানীয় ই-কমার্স |\n| ৮ | পাবনা কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২৩ | পাবনার ঐতিহ্যবাহী তাঁতের শাড়ি ও লুঙ্গি |\n| ৯ | বগুড়া কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২২ | বগুড়ার ঐতিহ্যবাহী দই ও কৃষি যন্ত্রাংশ |\n| ১০ | বরিশাল কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২৪ | বালাম চাল, মৎস্য হ্যাচারি ও গ্রামীণ ই-শপ |\n| ১১ | ঝিনাইদহ কম্পিউটার প্রশিক্ষণ কেন্দ্র | ২৪ | কলা-কৃষি পণ্য, হস্তশিল্প ও লোকাল ডিজিটাল এজেন্সি |\n| **মোট** | **সর্বমোট ১১টি কম্পিউটার প্রশিক্ষণ কেন্দ্র** | **২৩২ জন** | **বাংলাদেশজুড়ে সঞ্জীবন প্রকল্পের ডিজিটাল উদ্যোক্তা নেটওয়ার্ক** |\n…\n\nDrive Root Folder: https://drive.google.com/drive/folders/13YXw5Lxs7-wMXFrG1jjhiGTZ5doyr-DM\nCanva Root Folder: https://www.canva.com/folder/FAHavzClUOM"
  },
  {
    "id": "kb-sanjibon-drive-s00",
    "titleEn": "Session 00: Cloud Connect AI Limited & Sanjibon AI Course Orientation",
    "titleBn": "Session 00: ক্লাউড কানেক্ট এআই লিমিটেড ও সঞ্জীবন এআই কোর্স পরিচিতি",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 0",
      "orientation",
      "ccai",
      "sanjibon",
      "ansar vdp",
      "instructors",
      "roadmap"
    ],
    "sourceFileName": "Session_00_CCAI_Introduction_BN.md",
    "content": "Session 00 (Orientation · Pre-Course / ওরিয়েন্টেশন · কোর্স পরিচিতি)\nSummary: Orientation pack introducing Cloud Connect AI Limited (CCAI), Lead Instructor Md. Jehad (Certified Google AI Professional, ITEE FE Level 2 Full Passer), strategic leadership, mentor panel, training track record, and how the 5-day, 10-session (30-hour) Applied AI & Autonomous Workflows curriculum for Bangladesh Ansar & VDP Sanjibon Project is structured across 11 computer training centers.\nDrive Folder: https://drive.google.com/drive/folders/1dTM1JfhouK4pVo2hH7LKtbLqx2traduJ\nCanva View: https://www.canva.com/d/6rGrs3OnjS8g93k\nCanva Editable: https://www.canva.com/d/0swyVkCHw4z-IO5\n\n---\n# ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited) এবং বিশেষায়িত কোর্স পরিচিতি\n## প্রাতিষ্ঠানিক প্রোফাইল, এআই বিশেষজ্ঞতা, পূর্ববর্তী প্রশিক্ষণ, গবেষণা-শিক্ষা কার্যক্রম ও প্রশিক্ষক মণ্ডলী\n\n**প্রস্তুতকারক প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited — `https://cloudconnect-ai.com.bd/`)  \n**অংশীদার প্রকল্প:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প (`১১টি কেন্দ্র`, `২৩২ জন প্রশিক্ষণার্থী`)  \n**কোর্স শিরোনাম:** Applied Artificial Intelligence & Autonomous Workflows for Digital Marketing Freelancers  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer `#FE2023APR00005` (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল লিংক:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n\n---\n\n## অধ্যায় ১: আমরা কারা — ক্লাউড কানেক্ট এআই লিমিটেড (Who We Are)\n\n**Cloud Connect AI Limited** বাংলাদেশের একটি অগ্রণী প্রযুক্তি, কৃত্রিম বুদ্ধিমত্তা (AI), সাইবার নিরাপত্তা এবং পেশাগত দক্ষতা উন্নয়ন প্রতিষ্ঠান, যার মূল দর্শন **\"Born To Connect\"** এবং **\"Connecting Intelligence to Infinity\"**। **\"Built in Bangladesh · AI-First · Security First · Global Ready\"** দৃষ্টিভঙ্গি নিয়ে প্রতিষ্ঠানটি সরকারি, প্রতিরক্ষা, কর্পোরেট ও শিক্ষাপ্রতিষ্ঠান পর্যায়ে নিরাপদ এআই সলিউশন, সফটওয়্যার প্রকৌশল, ডিজিটাল রূপান্তর ও হাতে-কলমে প্রযুক্তি প্রশিক্ষণ প্রদান করে আসছে।\n\n### ১.১ প্রাতিষ্ঠানিক তথ্য ও যোগাযোগ\n\n| তথ্য | বিবরণ |\n| :--- | :--- |\n| **প্রতিষ্ঠানের নাম** | ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited) |\n| **মূল স্লোগান** | *\"Born To Connect\"* • *\"Connecting Intelligence to Infinity\"* |\n| **দৃষ্টিভঙ্গি ও অবস্থান** | Built in Bangladesh · AI-First · Security First · Global Ready |\n| **প্রধান কার্যালয়** | B1, House No. 268, Road No. 19, Mohakhali DOHS, Dhaka-1206, Bangladesh (+ বনানী হাব ও ২৪/৭ SOC এবং প্রশিক্ষণ সুবিধা) |\n| **অফিশিয়াল ওয়েবসাইট** | `https://cloudconnect-ai.com.bd/` |\n| **ইমেইল ও হটলাইন** | `info@cloudconnect-ai.com.bd` • `+8801769056868` • `+8801713091635` |\n\n---\n\n## অধ্যায় ২: আমাদের মূল সেবাসমূহ ও প্রযুক্তিগত সক্ষমতা (What We Do)\n\nক্লাউড কানেক্ট এআই লিমিটেড প্রযুক্তি উদ্ভাবন, সাইবার সুরক্ষা ও মানবসম্পদ উন্নয়নের ১২টি সমন্বিত ডোমেইনে কাজ করে:\n…"
  },
  {
    "id": "kb-sanjibon-drive-s01",
    "titleEn": "Session 01: Course Orientation, MD Welcome & Prompt Writing Basics (CLEAR Framework)",
    "titleBn": "Session 01: কোর্স পরিচিতি, এমডি স্বাগত বার্তা ও প্রম্পট রাইটিং বেসিকস (CLEAR ফ্রেমওয়ার্ক)",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 1",
      "prompt engineering",
      "clear framework",
      "prompt library",
      "orientation"
    ],
    "sourceFileName": "Session_01_Course_Material_BN.md",
    "content": "Session 01 (Day 1 · Morning / দিন ১ · সকাল)\nSummary: Covers the complete 5-day continuous capstone journey, grading rubric (Attendance 10%, Daily Arena Quizzes 25%, Practical Tasks 30%, Final Exam & Capstone Defense 35%), the CLEAR Prompt Writing Framework (Context, Length/Layout, Exact Role, Audience, Rules/Restrictions), weak vs professional prompt examples, hallucination-free tables & summaries, and a 10-template Starter Prompt Library for freelancers.\nDrive Folder: https://drive.google.com/drive/folders/1tYSB7xhaYLwiQmf7q31DMo3rsNB4WyCu\nCanva View: https://www.canva.com/d/ZGEAoPzsCB5sEqE\nCanva Editable: https://www.canva.com/d/rGw5vBDDThNdJRo\n\n---\n# সেশন ০১: পূর্ণাঙ্গ কোর্স ম্যাটেরিয়াল ও শিক্ষার্থী হ্যান্ডবুক\n## কোর্স পরিচিতি, প্রম্পট রাইটিং বেসিকস ও ১০টি স্টার্টার প্রম্পট লাইব্রেরি\n\n**আয়োজনে:** বাংলাদেশ আনসার ও গ্রাম প্রতিরক্ষা বাহিনী (ভিডিপি) — সঞ্জীবন প্রকল্প এবং ক্লাউড কানেক্ট এআই লিমিটেড  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**দিন ১ • সেশন ০১:** সকাল ০৯:০০ – দুপুর ১২:০০ (৩ ঘণ্টা)  \n**ব্যবহৃত টুলস:** Google AI Studio, Google Gemini, ChatGPT, Claude, Onnesha Arena (`https://arena.onnesha.courses/`)\n\n---\n\n## অধ্যায় ১: কোর্স পরিচিতি ও আপনার ৫ দিনের ভ্রমণ\n\nবাংলাদেশ আনসার ও ভিডিপি-র মূলমন্ত্র **“শান্তি, শৃঙ্খলা, উন্নয়ন, নিরাপত্তায় সর্বত্র আমরা”**-কে সামনে রেখে **সঞ্জীবন প্রকল্পের** মাধ্যমে আপনাকে একজন দক্ষ, স্বনির্ভর **এআই-সক্ষম ডিজিটাল মার্কেটিং ফ্রিল্যান্সার** হিসেবে গড়ে তোলার জন্য এই ৫ দিনের (৩০ ঘণ্টার) নিবিড় অনলাইন প্রশিক্ষণটি তৈরি করা হয়েছে।\n\n### ১.১ এই ৫ দিনে আপনি ধাপে ধাপে কী তৈরি করবেন? (একটি পূর্ণাঙ্গ প্রজেক্ট)\nদিন ১-এর প্রথম সেশন থেকেই আপনি আপনার এলাকার বা পছন্দের **একটি বাস্তব পণ্য বা ফ্রিল্যান্সিং ব্র্যান্ড** নির্বাচন করবেন (যেমন: *সঞ্জীবন সুন্দরবন খাঁটি মধু*, *কুমিল্লার খাদি বস্ত্র*, *বগুড়ার ঐতিহ্যবাহী দই*, *পাবনার তাঁত শাড়ি*, *কক্সবাজার অর্গানিক শুঁটকি*, অথবা আপনার নিজস্ব *ডিজিটাল মার্কেটিং এজেন্সি*)। এরপর ৫ দিনে ধাপে ধাপে তৈরি করবেন:\n1. **দিন ১ (সেশন ১–২):** ১০টি প্রম্পট টেমপ্লেট লাইব্রেরি + আপনার ব্যবসার সম্পূর্ণ মার্কেট রিসার্চ রিপোর্ট ও কাস্টম এআই হেল্পার।\n2. **দিন ২ (সেশন ৩–৪):** ৫টি স্টুডিও-মানের প্রোডাক্ট ছবি + Canva-তে ৬টি সোশ্যাল মিডিয়া অ্যাড ব্যানার।\n3. **দিন ৩ (সেশন ৫–৬):** বাংলা/ইংরেজি এআই ভয়েসওভারসহ ১৫–৩০ সেকেন্ডের ভিডিও অ্যাড + ১০টি সেলস কপি।\n4. **দিন ৪ (সেশন ৭–৮):** কোডিং ছাড়াই মোবাইল-বান্ধব ওয়ান-পেজ ওয়েবসাইট + লাইভ ইন্টারনেট লিংক (URL) ও SEO।\n5. **দিন ৫ (সেশন ৯–১০):** আপনার লাইভ ওয়েবসাইটে ২৪/৭ এআই চ্যাটবট + Google Sheet ও ইমেইল অটোমেশন + CCAI বোর্ডের সামনে লাইভ প্রজেক্ট প্রেজেন্টেশন!\n\n### ১.২ নম্বর বণ্টন ও সার্টিফিকেট পাওয়ার শর্ত\n* **উপস্থিতি ও ক্লাস অংশগ্রহণ:** ১০% *(সার্টিফিকেট পেতে কমপক্ষে **৮০% ক্লাসে উপস্থিত** থাকতে হবে)*\n* **দৈনিক কুইজ (`https://arena.onnesha.courses/`):** ২৫% *(প্রতিদিন সকালের কুইজ ও ২–৩টি মিড-সেশন কুইজ)*\n* **প্রতিদিনের প্র্যাকটিক্যাল কাজ (Sanjibon LMS):** ৩০%\n* **চূড়ান্ত পরীক্ষা ও লাইভ ক্যাপস্টোন ডিফেন্স (দিন ৫):** ৩৫%\n\n> **ডিজিটাল নিরাপত্তা ও নীতিমালা (গুরুত্বপূর্ণ):** কখনোই কোনো ব্যক্তিগত মোবাইল নম্বর, এনআইডি (NID), ব্যাংক অ্যাকাউন্ট তথ্য কিংবা আনসার-ভিডিপির কোনো দাপ্তরিক বা গোপন নথি এআই টুলে আপলোড করবেন না। অনুশীলনে সর্বদা ডেমো বা ব্যবসায়িক তথ্য ব্যবহার করুন।\n\n---\n\n## অধ্যায় ২: এআই কীভাবে নির্দেশনা (Prompt) বোঝে?\n\nআমরা যখন ChatGPT, Gemini বা Claude-কে কিছু লিখতে বলি, সেটিকে বলে **প্রম্পট (Prompt)**। এআই মানুষের মতো নিজ থেকে অনুমান করতে পারে না; বরং আপনি যত স্পষ্টভাবে **ভূমিকা, তথ্য ও নিয়ম** লিখে দেবেন, এআই তত নির্ভুল উত্তর তৈরি করবে।\n\n### প্রম্পট লেখার গোল্ডেন রুল: **CLEAR ফ্রেমওয়ার্ক**\n…"
  },
  {
    "id": "kb-sanjibon-drive-s02",
    "titleEn": "Session 02: AI Market, Competitor & Customer Research + Custom AI Helper",
    "titleBn": "Session 02: এআই দিয়ে মার্কেট, প্রতিযোগী ও ক্রেতা রিসার্চ এবং কাস্টম এআই হেল্পার",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 2",
      "market research",
      "buyer persona",
      "competitor matrix",
      "usp",
      "google ai studio",
      "custom helper"
    ],
    "sourceFileName": "Session_02_Course_Material_BN.md",
    "content": "Session 02 (Day 1 · Afternoon / দিন ১ · বিকাল)\nSummary: Teaches market research fundamentals for Bangladeshi & global freelance brands: 5 core Buyer Persona questions, Customer Feedback Mining from real reviews, Competitor Matrix & Market Gap / USP mapping for Sanjibon products, and step-by-step setup of a free reusable Custom AI Helper using System Instructions in Google AI Studio / Gemini Gems.\nDrive Folder: https://drive.google.com/drive/folders/1xwDyy49fEe6lskNt_gLvjvwvWwlICqsM\nCanva View: https://www.canva.com/d/po0MPtqSaTlDizx\nCanva Editable: https://www.canva.com/d/XJPZep6KTsegQhF\n\n---\n# সেশন ০২: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে বাজার, প্রতিযোগী ও ক্রেতা গবেষণা এবং নিজস্ব Custom AI Helper তৈরি  \n**সেশন:** ১ম দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: মার্কেট রিসার্চ কেন প্রতিটি ডিজিটাল মার্কেটারের প্রথম ধাপ?\nফ্রিল্যান্সিং মার্কেটপ্লেস (যেমন Fiverr বা Upwork) অথবা দেশের কোনো ব্যবসায়ীর জন্য ফেসবুক পেজ চালানোর সময় নতুনদের সবচেয়ে বড় ভুল হলো—গবেষণা না করেই পোস্ট বা বিজ্ঞাপন তৈরি করা। আপনি যদি না জানেন:\n- আপনার পণ্যটি **কে** কিনবে,\n- ক্রেতার মূল **সমস্যা বা ভয়** কী, এবং\n- বাজারে থাকা **অন্য বিক্রেতারা (Competitors)** কোথায় ভুল করছে—\n\nতাহলে সবচেয়ে সুন্দর পোস্টার বা ভিডিও বানিয়েও বিক্রি পাওয়া কঠিন হবে। এআই টুল (**Google AI Studio**, **Gemini**, **ChatGPT**, **Claude**) মাত্র ১০–১৫ মিনিটে আপনাকে একজন পেশাদার মার্কেট রিসার্চ বিশ্লেষকের মতো সাহায্য করতে পারে।\n\n> **গুরুত্বপূর্ণ সতর্কতা:** এআই অনেক সময় অনুমান করে ভুয়া সংখ্যা (যেমন: \"বাংলাদেশের ৭৮% মানুষ এটি পছন্দ করে\") বানিয়ে বলতে পারে। তাই গবেষণা করার সময় সবসময় এআইকে বলুন: *\"মনগড়া পরিসংখ্যান বা মিথ্যা তথ্য দেবে না; কেবল যৌক্তিক বিশ্লেষণ ও আমার দেওয়া তথ্যের ওপর ভিত্তি করে সাজিয়ে দাও।\"*\n\n---\n\n## অধ্যায় ২: ক্রেতার প্রোফাইল (Buyer Persona) ও ফিডব্যাক বিশ্লেষণ\n### ২.১ ক্রেতার ৫টি মৌলিক প্রশ্ন\nযেকোনো সঞ্জীবন পণ্য বা ফ্রিল্যান্সিং ক্লায়েন্টের পণ্যের জন্য নিচের ৫টি বিষয় এআই দিয়ে বের করুন:\n1. **ক্রেতা কে?** (বয়স, পেশা, শহর নাকি মফস্বল, পরিবারের সিদ্ধান্তদাতা কে)\n2. **মূল ভয় বা বাধা কী?** (যেমন: অনলাইনে ঠকে যাওয়ার ভয়, ভেজাল পণ্য, বেশি ডেলিভারি চার্জ, দেরিতে পৌঁছানো)\n3. **মূল আকাঙ্ক্ষা (Desire) কী?** (পরিবারের সুস্থতা, আভিজাত্য, সাশ্রয়, আসল/খাঁটি স্বাদ, সম্মান)\n4. **কোন প্ল্যাটফর্মে সময় কাটান?** (Facebook Group, TikTok, YouTube, Instagram, Google Search)\n5. **কোন প্রমাণে বিশ্বাস করেন?** (আসল ক্রেতার ভিডিও রিভিউ, ক্যাশ অন ডেলিভারি, ল্যাব টেস্ট/মান সনদ, খোলার পর দাম পরিশোধের সুবিধা)\n\n### ২.২ বাস্তব রিভিউ বিশ্লেষণ (Customer Feedback Mining)\nপ্রতিযোগীর ফেসবুক পেজ, দারাজ পণ্যের রিভিউ বা কমেন্ট সেকশন থেকে ১০–১৫টি আসল ক্রেতার মন্তব্য কপি করুন (ক্রেতার নাম/ব্যক্তিগত তথ্য বাদ দিয়ে)। এরপর এআই-কে দিয়ে বের করুন:\n- **ক্রেতারা কী প্রশংসা করছেন?** (এটি বাজারের ন্যূনতম চাহিদা)\n- **ক্রেতারা কী নিয়ে অভিযোগ করছেন?** (এটিই আপনার **Market Gap** বা সুযোগ!)\n\n---\n\n## অধ্যায় ৩: প্রতিযোগী বিশ্লেষণ (Competitor Matrix), মার্কেট গ্যাপ ও Selling Points (USP)\nএকটি ভালো **Market Gap** মানে হলো: *ক্রেতা যে জিনিসটি খুব চাইছেন, কিন্তু বর্তমানে বাজারে থাকা বিক্রেতারা তা ঠিকমতো দিচ্ছেন না।*\n…"
  },
  {
    "id": "kb-sanjibon-drive-s03",
    "titleEn": "Session 03: Professional AI Product Photography & Studio Visuals (SLABC Formula)",
    "titleBn": "Session 03: এআই দিয়ে প্রফেশনাল প্রোডাক্ট ফটোগ্রাফি ও স্টুডিও ইমেজ তৈরি (SLABC সূত্র)",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 3",
      "product photography",
      "slabc",
      "imagen",
      "aspect ratio",
      "visual qa"
    ],
    "sourceFileName": "Session_03_Course_Material_BN.md",
    "content": "Session 03 (Day 2 · Morning / দিন ২ · সকাল)\nSummary: Master commercial e-commerce product photography using free AI image tools (Google Gemini Imagen, ChatGPT Free, Canva Magic Media). Covers the 5-element SLABC Formula (Subject, Lighting, Angle/Composition, Background/Props, Camera/Color Mood), mandatory aspect ratios (1:1 Feed, 9:16 Reels/Story, 16:9 Hero Banner), 5 ready-to-use Sanjibon templates (honey, Khadi/handloom, dry fish, packaging proof), and the Visual QA checklist.\nDrive Folder: https://drive.google.com/drive/folders/1nP27RxdIBwRhrEaILZgFz2G8YE7Uv5qT\nCanva View: https://www.canva.com/d/2YhiHq3WrO-iIoF\nCanva Editable: https://www.canva.com/d/9wnYFf431evafgn\n\n---\n# সেশন ০৩: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে স্টুডিও-মানের প্রোডাক্ট ফটোগ্রাফি ও সোশ্যাল মিডিয়া-ওয়েব ইমেজ তৈরি  \n**সেশন:** ২য় দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: ই-কমার্স ও ফ্রিল্যান্সিংয়ে পেশাদার ছবির গুরুত্ব\nঅনলাইনে ক্রেতা আপনার পণ্য হাত দিয়ে ছুঁয়ে দেখতে পারেন না—তিনি কেবল **ছবি দেখে বিশ্বাস করেন**। মোবাইল ফোনে অন্ধকার ঘরে তোলা ঝাপসা ছবিতে যতই দামি পণ্য থাকুক না কেন, ক্রেতার কাছে তা অবিশ্বস্ত মনে হয়। আগে প্রতিটি ব্র্যান্ডকে ফটোগ্রাফার ও স্টুডিও ভাড়া করতে হাজার হাজার টাকা খরচ করতে হতো। এখন এআই টুল (**Google Gemini / Imagen 3**, **ChatGPT Image Generation**) ব্যবহার করে আপনি আপনার সঞ্জীবন পণ্যের জন্য—বা বিদেশি ফ্রিল্যান্সিং ক্লায়েন্টের জন্য—মাত্র কয়েক মিনিটে প্রাকৃতিক ও স্টুডিও-মানের প্রোডাক্ট ছবি তৈরি করতে পারবেন।\n\n> **একটি পেশাদার নিয়ম সবসময় মনে রাখবেন:** ছবি জেনারেট করার সময় কখনো বলবেন না *\"Write Bangla offer text on the image\"*। কারণ ইমেজ-জেনারেশন এআই বাংলা যুক্তবর্ণ ঠিকমতো আঁকতে পারে না। বরং এআই দিয়ে **পরিষ্কার ও বাস্তবসম্মত ছবি (Clean Image)** তৈরি করুন, আর আজ বিকালের সেশন ০৪-এ **Canva** ব্যবহার করে সেই ছবির ওপর নিখুঁত বাংলা ও ইংরেজি লেখা বসান!\n\n---\n\n## অধ্যায় ২: স্টুডিও-মানের ছবির ৫-উপাদান প্রম্পট সূত্র (SLABC Formula)\nইমেজ জেনারেটর টুলগুলো ইংরেজি ফটোগ্রাফি শব্দ বেশি নিখুঁতভাবে বোঝে। তাই আপনি বাংলায় ভাবনা সাজিয়ে নিচের **৫টি উপাদান (SLABC)** অনুসারে ইংরেজি প্রম্পট লিখবেন (চাইলে আপনার Session 02 Custom AI Helper-কেও বলতে পারেন *\"আমার এই পণ্যের জন্য নিচের SLABC সূত্রে ইংরেজি ইমেজ প্রম্পট লিখে দাও\"*):\n…"
  },
  {
    "id": "kb-sanjibon-drive-s04",
    "titleEn": "Session 04: Social Media & Google Ad Banner Design in Canva (6-Banner Campaign)",
    "titleBn": "Session 04: সোশ্যাল মিডিয়া ও গুগল অ্যাড ব্যানার ডিজাইন (Canva ৬-ব্যানার ক্যাম্পেইন)",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 4",
      "canva",
      "ad banners",
      "layers",
      "typography",
      "social media ads",
      "google display"
    ],
    "sourceFileName": "Session_04_Course_Material_BN.md",
    "content": "Session 04 (Day 2 · Afternoon / দিন ২ · বিকাল)\nSummary: Turn AI product photos from Session 03 into high-converting Meta & Google Display ad banners in Canva. Covers the 3-second scroll-stop rule, platform sizes & safe margins, Canva Layers (Position -> Layers), clean Bangla typography, Tidy Up alignment, Gemini prompts for short punchy Bengali banner headlines, and a complete 6-Banner Campaign Lab Blueprint + 10 practice MCQs.\nDrive Folder: https://drive.google.com/drive/folders/1Pm7RcOnZ9iK0ogYbrRhXv3Q3HcuhNGrr\nCanva View: https://www.canva.com/d/Z6meuZR29YewGac\nCanva Editable: https://www.canva.com/d/FQDO_Q1OgoUOXu4\n\n---\n# সেশন ০৪: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** Facebook, Instagram ও Google বিজ্ঞাপন ব্যানার ডিজাইন এবং Canva Layers ব্যবহার  \n**সেশন:** ২য় দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: ডিজিটাল বিজ্ঞাপনে ব্যানারের ভূমিকা (৩-সেকেন্ড পরীক্ষা)\nসকালে আপনি এআই দিয়ে চমৎকার প্রোডাক্ট ছবি তৈরি করেছেন। কিন্তু কেবল একটি সুন্দর ছবি ফেসবুকে ছাড়লে ক্রেতা বুঝবেন না এটি কত টাকা, কেন অন্যদের চেয়ে ভালো, বা কীভাবে অর্ডার করতে হবে। **প্রোমোশনাল ব্যানার** সেই পরিষ্কার ছবির সাথে **সঠিক ক্রেতার বার্তা (Hook + Trust + Offer + CTA)** যুক্ত করে ক্রেতাকে কেনার সিদ্ধান্ত নিতে সাহায্য করে।\n\n**একটি কার্যকর বিজ্ঞাপন ব্যানারের ৪টি স্বর্ণসূত্র:**\n1. **পড়ার যোগ্যতা (Contrast):** পটভূমির ওপর বাংলা লেখা এক পলকে পড়া যাচ্ছে কি না।\n2. **পরিমিত লেখা (Less is More Rule):** ব্যানারে গাদা গাদা কথা না লিখে সর্বোচ্চ **৮–১৪ শব্দে** মূল বক্তব্য দিন।\n3. **বিক্রির কারণ (Value/USP):** সেশন ০২-এ বের করা একটি বড় সমাধান (যেমন: *\"ল্যাব পরীক্ষিত খাঁটি\"*, *\"১০০% কেমিক্যালমুক্ত শুঁটকি\"*, *\"ভাঙনমুক্ত প্যাকিং\"*)।\n4. **পরিষ্কার নির্দেশ (CTA):** ক্রেতা এখন কী করবেন— *\"অর্ডার করুন\"*, *\"ইনবক্সে মেসেজ দিন\"*, বা *\"ভিজিট করুন\"*।\n\n---\n\n## অধ্যায় ২: প্ল্যাটফর্ম অনুযায়ী সঠিক ব্যানারের মাপ ও নিরাপদ মার্জিন\n\n| ক্রমিক | প্ল্যাটফর্ম ও ফরম্যাট | সঠিক মাপ (Pixels) | নিরাপদ মার্জিন (Safe Margin) ও ব্যবহার টিপস |\n| :---: | :--- | :--- | :--- |\n| **১** | **Facebook / IG Square Feed** | `1080 × 1080` (`1:1`) | চারপাশে অন্তত **৫০–৭০ পিক্সেল** খালি রাখুন যেন লেখা বর্ডার ছুঁয়ে না যায়। |\n| **২** | **IG / FB Mobile Portrait Feed** | `1080 × 1350` (`4:5`) | মোবাইল স্ক্রিনে বর্গাকার ছবির চেয়ে ২৫% বেশি জায়গা দখল করে—ফলে বেশি মনোযোগ পায়। |\n| **৩** | **FB / IG Story & WhatsApp Ad** | `1080 × 1920` (`9:16`) | ওপরের **২৫০ px** ও নিচের **৩০০ px** ফাঁকা রাখুন (সেখানে প্রোফাইল নাম ও Swipe-Up/Reply থাকে)। |\n| **৪** | **Facebook Link Ad / Cover Banner** | `1200 × 628` | ডান পাশে পণ্য, বাম পাশে বড় হুক শিরোনাম ও \"Shop Now\" বাটন রাখুন। |\n| **৫** | **Google Display Medium Rectangle** | `300 × 250` | ছোট বক্স—কেবল ব্র্যান্ড নাম, পণ্যের ছবি, ১টি ছোট অফার ও উজ্জ্বল CTA বাটন রাখুন। |\n| **৬** | **Google Display Leaderboard (ঐচ্ছিক)** | `728 × 90` | ওয়েবসাইটের শীর্ষের লম্বা ফিতা ব্যানার—বাম থেকে ডানে (লোগো $\\rightarrow$ হুক $\\rightarrow$ ছবি $\\rightarrow$ বাটন) সাজান। |\n\n---\n\n## অধ্যায় ৩: Canva-তে Layers ও পেশাদার ব্যানার তৈরির ধাপ-বাই-ধাপ গাইড\nবাংলাদেশের একজন আনসার-ভিডিপি উদ্যোক্তা বা ফ্রিল্যান্সার হিসেবে Canva-তে দ্রুত ও নিখুঁত ডিজাইন করতে নিচের নিয়ম অনুসরণ করুন:\n…"
  },
  {
    "id": "kb-sanjibon-drive-s05",
    "titleEn": "Session 05: AI Short Video Ads & Natural Bangla/English Voiceover (HPPC Formula)",
    "titleBn": "Session 05: এআই ভয়েসওভারসহ শর্ট ভিডিও অ্যাড তৈরি (HPPC স্ক্রিপ্ট ও Clipchamp)",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 5",
      "short video",
      "voiceover",
      "hppc",
      "clipchamp",
      "reels",
      "captions",
      "elevenlabs"
    ],
    "sourceFileName": "Session_05_Course_Material_BN.md",
    "content": "Session 05 (Day 3 · Morning / দিন ৩ · সকাল)\nSummary: Create high-retention 15-30 second Facebook Reels, YouTube Shorts, and TikTok product ads. Covers the 4-part HPPC Script Formula (Hook, Problem, Proof/Product, Call-to-Action), bilingual Gemini script prompts, visual motion generation from Session 03 images, natural free Bangla (bn-BD) & English voiceover via Microsoft Clipchamp / ElevenLabs, audio mixing ratios, bold on-screen captions, and a 25s storyboard sample.\nDrive Folder: https://drive.google.com/drive/folders/1cdhVRNOhgsGIC0LmMAZqmIouMgW8yE6J\nCanva View: https://www.canva.com/d/wHhEgdZLGuQLO9i\nCanva Editable: https://www.canva.com/d/lczgCckdjaDIA-F\n\n---\n# সেশন ০৫: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** এআই দিয়ে শর্ট প্রোমোশনাল ভিডিও বিজ্ঞাপন, বাংলা/ইংরেজি ভয়েসওভার ও ক্যাপশন তৈরি  \n**সেশন:** ৩য় দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: কেন এখন শর্ট ভিডিও বিজ্ঞাপন সবচেয়ে বেশি কাজ করে?\nফেসবুক রিলস (Reels), ইউটিউব শর্টস (Shorts) ও টিকটকের যুগে স্থির ছবির চেয়ে ১৫–৩০ সেকেন্ডের **শর্ট ভার্টিক্যাল ভিডিও (`9:16`)** ক্রেতাদের অনেক দ্রুত বিশ্বাস অর্জন করে। আগে একটি ৩০ সেকেন্ডের ভিডিও বিজ্ঞাপন বানাতে ক্যামেরাম্যান, ভয়েস আর্টিস্ট ও এডিটর মিলে হাজার হাজার টাকা লাগত। এখন এআই ব্যবহার করে আপনি একা বসেই—\n1. স্ক্রিপ্ট লিখতে পারবেন (**Gemini**),\n2. ছবি বা টেক্সট থেকে মুভিং ভিডিও ক্লিপ বানাতে পারবেন (**Canva / CapCut / Free AI Video Tools**),\n3. বাস্তবসম্মত বাংলা ও ইংরেজি ভয়েসওভার বানাতে পারবেন (**Microsoft Clipchamp `bn-BD` / Google AI Studio / ElevenLabs**), এবং\n4. অটো-ক্যাপশন যুক্ত করে রপ্তানি করতে পারবেন!\n\n---\n\n## অধ্যায় ২: ১৫–৩০ সেকেন্ড ভিডিও অ্যাডের ৪-অংশ স্ক্রিপ্ট কাঠামো (HPPC Formula)\n\n| অংশ ও সময় | উদ্দেশ্য | সুন্দরবনের মধুর নমুনা বাংলা স্ক্রিপ্ট | আন্তর্জাতিক ক্লায়েন্টের জন্য ইংরেজি নমুনা |\n| :--- | :--- | :--- | :--- |\n| **১. হুক (০–৩ সে.)** | দর্শকের আঙুল থামানো | *\"খাঁটি ভেবে বাজারের যে মধু কিনছেন, তা আসল তো?\"* | *\"Stop buying watered-down honey labeled as organic!\"* |\n| **২. সমস্যা (৩–১০ সে.)** | ক্রেতার ভয় উসকে দেওয়া | *\"অনেকেই চিনির সিরা মেশানো নকল মধু খেয়ে ঠকছেন, আবার প্লাস্টিক বোতলে ডেলিভারিতে লিক হচ্ছে।\"* | *\"Most store jars are heated and lose their natural enzymes before reaching you.\"* |\n| **৩. প্রমাণ (১০–২২ সে.)** | সঞ্জীবন পণ্যের USP দেখানো | *\"তাই আমরা নিয়ে এসেছি সরাসরি সুন্দরবনের মৌয়াল সংগৃহীত কাঁচের জারে ১০০% প্রাকৃতিক মধু—কোনো ভেজাল নয়।\"* | *\"Meet pure wildflower honey—cold-extracted, sealed in leak-proof glass, straight to your door.\"* |\n| **৪. CTA (২২–২৮ সে.)** | অর্ডার করতে বলা | *\"আজই অর্ডার করতে ইনবক্স করুন—সারাদেশে রয়েছে নিরাপদ ক্যাশ অন ডেলিভারি!\"* | *\"Tap Order Now and get fresh harvest delivery with zero risk!\"* |\n\n> **গুরুত্বপূর্ণ টিপস:** ৩০ সেকেন্ডের বাংলা ভিডিওর স্ক্রিপ্ট **৫৫ থেকে ৬৫ শব্দের বেশি** লিখবেন না। নইলে কথা খুব দ্রুত হয়ে যাবে এবং দর্শক বুঝতে পারবেন না।\n\n---\n…"
  },
  {
    "id": "kb-sanjibon-drive-s06",
    "titleEn": "Session 06: High-Converting Ad Copywriting (PAS, AIDA, BAB) & Practical Test 1",
    "titleBn": "Session 06: বিক্রয়যোগ্য অ্যাড কপি ও সেলস টেক্সট লেখা (PAS, AIDA, BAB) ও প্র্যাকটিক্যাল টেস্ট ১",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 6",
      "ad copy",
      "copywriting",
      "pas",
      "aida",
      "bab",
      "ad policy",
      "practical test 1"
    ],
    "sourceFileName": "Session_06_Course_Material_BN.md",
    "content": "Session 06 (Day 3 · Afternoon / দিন ৩ · বিকাল)\nSummary: Write persuasive Bangla & English sales copy that complies with Meta and Google Ads policies. Covers the 3 proven copywriting frameworks (PAS for Bangladeshi Facebook ads, AIDA for premium launches, BAB for transformation storytelling), audience tone adaptation, 5 policy rules to avoid Ad Rejection, master prompts to generate 7 Bengali + 3 international English ad copy variations, and the Day 3 Campaign Pack (Practical Test 1).\nDrive Folder: https://drive.google.com/drive/folders/1icLF_d_MX5IpT75fahFUJOwXaiiEimeC\nCanva View: https://www.canva.com/d/Fj4XuPXyofwWvca\nCanva Editable: https://www.canva.com/d/Ev6ZPZbAFjXH0-6\n\n---\n# সেশন ০৬: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** উচ্চ-রূপান্তরকারী সেলস কপি লেখা ও **Practical Test 1** (পূর্ণাঙ্গ অ্যাড ক্যাম্পেইন প্যাক)  \n**সেশন:** ৩য় দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: সেলস কপি (Ad Copy) কেন ডিজাইনের সমান গুরুত্বপূর্ণ?\nছবি এবং ভিডিও ক্রেতার চোখ থামায়, কিন্তু ক্রেতার মন জয় করে অর্ডার বাটনে চাপ দেওয়াতে বাধ্য করে আপনার **সেলস কপি বা ক্যাপশন**। ফেসবুকে একটি বিজ্ঞাপনের প্রথম **১২৫ অক্ষর (প্রায় ২ লাইন)** *\"See More\"* লেখার ওপরে দেখা যায়। তাই এই ২ লাইন যদি হয় দুর্বল, ক্রেতা বাকি লেখা না পড়েই চলে যান!\n\n---\n\n## অধ্যায় ২: কপিরাইটিংয়ের ৩টি বিশ্বমানের সূত্র (Google Gemini ব্যবহারের ফ্রেমওয়ার্ক)\n\n### ১. PAS সূত্র (বাংলাদেশি ফেসবুক বিজ্ঞাপনের সেরা সূত্র)\n- **P — Problem (সমস্যা):** ক্রেতার বাস্তব সমস্যা বা ভয় নিয়ে প্রশ্ন করুন (*\"বাজারের ভেজাল শুঁটকিতে ক্ষতিকর কেমিক্যাল নিয়ে চিন্তিত?\"*)\n- **A — Agitate (গভীরতা বোঝানো):** এই সমস্যায় ক্রেতা কীভাবে ক্ষতিগ্রস্ত হন তা মনে করান (*\"অনেকেই অজান্তে বিষাক্ত স্প্রে দেওয়া খাবার পরিবারের পাতে তুলে দিচ্ছেন।\"*)\n- **S — Solution (সমাধান ও CTA):** আপনার পণ্যের আসল প্রমাণ + সহজ অর্ডার নিয়ম দিন (*\"কক্সবাজারের রোদে শুকানো ১০০% কেমিক্যালমুক্ত ভ্যাকুয়াম প্যাক শুঁটকি পাচ্ছেন ক্যাশ অন ডেলিভারিতে! অর্ডার করতে মেসেজ দিন।\"*)\n\n### ২. AIDA সূত্র (নতুন ও প্রিমিয়াম পণ্যের জন্য)\n- **A — Attention (মনোযোগ):** চমকপ্রদ শুরু বা অফার\n- **I — Interest (আগ্রহ):** পণ্য কীভাবে তৈরি বা কেন অনন্য\n- **D — Desire (আকাঙ্ক্ষা):** এটি ব্যবহার করলে ক্রেতা কী অনুভূতি বা সুবিধা পাবেন\n- **A — Action (পদক্ষেপ):** স্পষ্ট CTA ও লিমিটেড টাইম সুবিধা\n\n### ৩. BAB সূত্র (গল্প বা পরিবর্তনের জন্য)\n- **B — Before (আগের অবস্থা):** ক্রেতার বর্তমান অসুবিধা\n- **A — After (পরের অবস্থা):** আপনার পণ্য হাতে পাওয়ার পরের নিশ্চিন্ত অনুভূতি\n- **B — Bridge (সেতু):** আপনার সঞ্জীবন ব্র্যান্ড কীভাবে এই পরিবর্তন এনে দিচ্ছে\n\n---\n\n## অধ্যায় ৩: ক্রেতা ভেদে টোন পরিবর্তন (Audience Segmentation)\nএকই পণ্যের বিজ্ঞাপন সব মানুষের কাছে এক ভাষায় দিলে কাজ হয় না। আপনার ১০টি কপি তৈরি করার সময় অন্তত **৩ ধরনের ক্রেতার জন্য আলাদা টোন** লিখুন:\n…"
  },
  {
    "id": "kb-sanjibon-drive-s07",
    "titleEn": "Session 07: No-Code Modern Sales Website Building with AI (Single index.html)",
    "titleBn": "Session 07: কোডিং ছাড়াই এআই দিয়ে আধুনিক সেলস ওয়েবসাইট নির্মাণ",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 7",
      "landing page",
      "no-code website",
      "index.html",
      "tailwind",
      "gemini canvas",
      "responsive"
    ],
    "sourceFileName": "Session_07_Course_Material_BN.md",
    "content": "Session 07 (Day 4 · Morning / দিন ৪ · সকাল)\nSummary: Build a complete responsive one-page sales landing page without writing code manually using Gemini Canvas, Claude Artifacts, or ChatGPT Canvas (plus v0/Bolt/Lovable options). Covers the 6 essential landing page sections (Hero + CTA, Problem/Solution, Product Showcase, Social Proof/Reviews, Offer/Pricing, Cash-on-Delivery Order Form), master prompt for a single self-contained Tailwind CDN index.html, adding local images, and mobile/desktop testing.\nDrive Folder: https://drive.google.com/drive/folders/1b53seTz0Fx4aw6Yxqb-em2SgeJv-zcwg\nCanva View: https://www.canva.com/d/3d7UgyLknnOYaGy\nCanva Editable: https://www.canva.com/d/XSHR8VidyrXyLaH\n\n---\n# সেশন ০৭: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** কোডিং ছাড়াই কেবল টেক্সট প্রম্পট দিয়ে আধুনিক রেসপনসিভ ওয়েবসাইট নির্মাণ  \n**সেশন:** ৪র্থ দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: কোডিং না জেনেই ওয়েবসাইট তৈরি — নতুন যুগের ফ্রিল্যান্সিং\nএকসময় একটি সাধারণ ব্যবসায়িক ওয়েবসাইট তৈরি করতে HTML, CSS, JavaScript শেখা লাগত বা ওয়েব ডেভেলপারকে ১৫–৩০ হাজার টাকা দিতে হতো। এখন **Google Gemini (Canvas)**, **Claude (Artifacts)**, **ChatGPT (Canvas)**, **Bolt** বা **v0**-এর মতো আধুনিক এআই টুলে আপনি কেবল বাংলায় বা সহজ ইংরেজিতে *\"আমার কী ধরনের ওয়েবসাইট চাই\"* লিখে দিলেই এআই কয়েক সেকেন্ডে সম্পূর্ণ ওয়েবসাইট তৈরি করে আপনার চোখের সামনে লাইভ দেখিয়ে দেবে!\n\n**এই সেশনে তৈরি ওয়েবসাইটটি আমাদের পুরো ৫-দিনের ক্যাপস্টোন প্রজেক্টের কেন্দ্রবিন্দু:**\n- এতে বসবে সেশন ০২-এর **USP**, সেশন ০৩-এর **প্রোডাক্ট ছবি**, ও সেশন ০৬-এর **বিক্রয়যোগ্য লেখা**।\n- আজ বিকালে (সেশন ০৮) এটিকে আমরা সম্পূর্ণ ফ্রিতে অনলাইনে **পাবলিশ (Live URL)** করবো।\n- আগামীকাল (সেশন ০৯) এই সাইটে **২৪/৭ এআই চ্যাটবট ও স্বয়ংক্রিয় Google Sheet অর্ডার সেভিং** যুক্ত করবো!\n\n---\n\n## অধ্যায় ২: একটি বিক্রয়-উপযোগী ১-পৃষ্ঠার ওয়েবসাইটের ৬টি অপরিহার্য সেকশন\n\n| ক্রমিক | সেকশনের নাম | ভেতরে কী থাকবে? | ক্রেতার মনে প্রভাব |\n| :---: | :--- | :--- | :--- |\n| **১** | **Navbar (নেভিগেশন বার)** | ব্র্যান্ড লোগো/নাম, ৩টি শর্ট লিংক (*আমাদের পণ্য, রিভিউ, অর্ডার*), **\"অর্ডার করুন\"** বোতাম | পেশাদার ও গুছানো পরিচিতি |\n| **২** | **Hero Section (প্রথম দৃশ্য)** | বড় হুক শিরোনাম, ২ লাইনের USP উপ-শিরোনাম, সেশন ০৩-এর ১৬:৯ বা হিরো ছবি, প্রধান CTA বোতাম | প্রথম ৩ সেকেন্ডে বিশ্বাস ও আগ্রহ |\n| **৩** | **Trust Badges & Gallery** | ৩টি ভরসার কার্ড (*১০০% খাঁটি, সারাদেশে COD, সহজ রিটার্ন*) + **৩–৪টি প্রোডাক্ট কার্ড (ছবি, দাম, অর্ডার বাটন)** | পণ্য যাচাই ও পছন্দের সুবিধা |\n| **৪** | **Customer Testimonials** | ৩ জন সন্তুষ্ট ক্রেতার কার্ড (যেমন: ঢাকা, চট্টগ্রাম ও সিলেটের ক্রেতার বাস্তবসম্মত মন্তব্য) *(নোট: অনুশীলনের নমুনা রিভিউ হিসেবে চিহ্নিত)* | সামাজিক প্রমাণ (Social Proof) |\n| **৫** | **Order / Contact Form** | ক্রেতার নাম, মোবাইল নম্বর, জেলা/ঠিকানা, পণ্য বাছাই ড্রপডাউন ও \"কনফার্ম অর্ডার / মেসেজ পাঠান\" বোতাম | সরাসরি লিড ও অর্ডার সংগ্রহ |\n| **৬** | **Footer (নিচের অংশ)** | ব্র্যান্ড ঠিকানা (সঞ্জীবন উদ্যোগ/কেন্দ্র), হেল্পলাইন, ফেসবুক পেজ ও কপিরাইট | পূর্ণাঙ্গ প্রতিষ্ঠানের আস্থা |\n\n---\n\n## অধ্যায় ৩: মাস্টার ওয়েবসাইট প্রম্পট (কপি-পেস্ট করলেই সম্পূর্ণ `index.html` তৈরি হবে!)\n*(আপনার নিজের ব্র্যান্ড, পণ্য ও দামের অংশ `[ব্র্যাকেট]` পরিবর্তন করে Google Gemini (Canvas) অথবা Claude / ChatGPT-তে দিন)*\n…"
  },
  {
    "id": "kb-sanjibon-drive-s08",
    "titleEn": "Session 08: Live Website Publishing (Netlify Drop / Vercel) & Basic SEO",
    "titleBn": "Session 08: ওয়েবসাইট লাইভ পাবলিশিং (Netlify Drop / Vercel) ও বেসিক SEO",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 8",
      "netlify drop",
      "vercel",
      "hosting",
      "https",
      "seo",
      "open graph",
      "pagespeed"
    ],
    "sourceFileName": "Session_08_Course_Material_BN.md",
    "content": "Session 08 (Day 4 · Afternoon / দিন ৪ · বিকাল)\nSummary: Take your local sales landing page live on the global internet with free HTTPS hosting via Netlify Drop (app.netlify.com/drop) and Vercel. Includes image compression & PageSpeed checks, mobile QA, and ready-to-paste Gemini prompts for complete head SEO tags (Title, Meta Description, Open Graph og:title/og:image for crisp Facebook link previews) plus 10 deployment & SEO practice MCQs.\nDrive Folder: https://drive.google.com/drive/folders/1m3A-7kO7AMHu_mr0sHbJSQyIj8zVM3NN\nCanva View: https://www.canva.com/d/5oXXaoCDTGqzHDC\nCanva Editable: https://www.canva.com/d/ADbyzoyptUPXdkH\n\n---\n# সেশন ০৮: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** ওয়েবসাইট ফ্রি লাইভ পাবলিশিং (Netlify/Vercel), মোবাইল গতি পরীক্ষা ও বেসিক SEO  \n**সেশন:** ৪র্থ দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: কম্পিউটারের ফাইল থেকে সারা বিশ্বের ইন্টারনেটে (হোস্টিং ধারণা)\nসকালে আপনার তৈরি করা `index.html` ফাইলটি এখন কেবল **আপনার নিজের কম্পিউটারে** আছে। আপনি লিংক কাউকে পাঠালে (`C:\\Users\\...\\index.html`) সে দেখতে পারবে না! সবাই যেন নিজের মোবাইল ফোন থেকে পৃথিবীর যেকোনো জায়গা থেকে আপনার ওয়েবসাইট দেখতে পারেন, সেজন্য ফাইলটি একটি ২৪ ঘণ্টা চালু থাকা ইন্টারনেট সার্ভারে রাখতে হয়—একে বলে **ওয়েব হোস্টিং (Web Hosting)**।\n\n**সুখবর:** এখন শিক্ষার্থীদের অনুশীলন, পোর্টফোলিও এবং ছোট ব্যবসায়িক ল্যান্ডিং পেজ হোস্ট করার জন্য **Netlify** এবং **Vercel** সম্পূর্ণ বিনামূল্যে **HTTPS (`🔒` নিরাপদ তালা চিহ্নযুক্ত)** লাইভ লিংক প্রদান করে—কোনো ক্রেডিট কার্ড ছাড়াই!\n\n---\n\n## অধ্যায় ২: Netlify Drop-এ ৩ মিনিটে লাইভ ওয়েবসাইট প্রকাশ (ধাপে ধাপে)\n*(সবচেয়ে সহজ ও নির্ভরযোগ্য পদ্ধতি—কোনো কোডিং কমান্ড ছাড়াই)*\n\n1. **অ্যাকাউন্ট নিশ্চিত করুন:** ব্রাউজারে `https://app.netlify.com` খুলুন এবং আপনার Gmail দিয়ে **Sign up with Email / Google** করে লগইন করুন। *(লগইন না করে আপলোড করলে ১ ঘণ্টা পর সাইট মুছে যায়!)*\n2. **ফোল্ডার যাচাই করুন:** ডেস্কটপে থাকা `My_Sanjibon_Website` ফোল্ডারটি খুলুন এবং নিশ্চিত করুন ভেতরে সরাসরি **`index.html`** এবং **`images`** ফোল্ডার আছে (অতিরিক্ত সাব-ফোল্ডার নেই)।\n3. **ড্র্যাগ-অ্যান্ড-ড্রপ:** লগইন করা অবস্থায় Netlify ড্যাশবোর্ডে **Sites → Add new site → Deploy manually** অথবা `https://app.netlify.com/drop`-এ যান। আপনার `My_Sanjibon_Website` ফোল্ডারটি মাউস দিয়ে টেনে বক্সের ওপর ছেড়ে দিন!\n4. **তাৎক্ষণিক লাইভ:** ১০–২০ সেকেন্ডের মধ্যেই সবুজ রঙের **Live URL** পেয়ে যাবেন (যেমন `https://golden-star-12ab.netlify.app`)।\n5. **সুন্দর ব্র্যান্ড লিংক বানান:** **Site configuration → Change site name** ক্লিক করে এলোমেলো নামের বদলে নিজের ব্র্যান্ডের নাম লিখুন—যেমন: **`nirmol-sundarban-honey.netlify.app`**।\n6. **পরবর্তীতে আপডেট (Re-deploy):** কখনো `index.html`-এ নতুন কিছু বদলালে (যেমন SEO বা সেশন ০৯-এর চ্যাটবট কোড যোগ করলে), নেটলিফাইয়ের **Deploys** ট্যাবে গিয়ে ওই আপডেটেড ফোল্ডারটি আবার টেনে ছেড়ে দিলেই পুরনো একই লিংকে নতুন ভার্সন আপডেট হয়ে যাবে!\n\n*(বিকল্প টুল: যাদের GitHub বা Vercel অ্যাকাউন্ট রয়েছে, তারা Vercel ড্যাশবোর্ড বা CLI-এর মাধ্যমেও একই `vercel.app` ফ্রি HTTPS লিংক পেতে পারেন।)*\n\n---\n…"
  },
  {
    "id": "kb-sanjibon-drive-s09",
    "titleEn": "Session 09: 24/7 AI Customer Chatbot (Voiceflow) & Lead Automation (Make.com)",
    "titleBn": "Session 09: ২৪/৭ এআই কাস্টমার চ্যাটবট (Voiceflow) ও লিড অটোমেশন (Make.com)",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 9",
      "chatbot",
      "voiceflow",
      "make.com",
      "webhook",
      "google sheets",
      "lead automation",
      "autonomous workflow"
    ],
    "sourceFileName": "Session_09_Course_Material_BN.md",
    "content": "Session 09 (Day 5 · Morning / দিন ৫ · সকাল)\nSummary: Automate customer support and order capture 24/7 with zero server maintenance. Step-by-step lab building a Knowledge-Base-powered Voiceflow AI Chatbot embedded directly into your live landing page, plus connecting your website order form via Make.com Custom Webhook to automatically append leads into Google Sheets and trigger instant email notifications, finished with an End-to-End system test.\nDrive Folder: https://drive.google.com/drive/folders/1n-MYjIE951koiXFz_ZFYsoyuIBl4Be3L\nCanva View: https://www.canva.com/d/Q0czCFJtc3GSYGw\nCanva Editable: https://www.canva.com/d/lBgTE6wTe2T28Vk\n\n---\n# সেশন ০৯: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** ২৪/৭ এআই কাস্টমার চ্যাটবট (`Voiceflow`) ও ফর্ম-টু-গুগল শিট-ইমেইল অটোমেশন (`Make.com`)  \n**সেশন:** ৫ম দিন — সকাল (সকাল ০৯:০০ – দুপুর ১২:০০)  \n\n---\n\n## অধ্যায় ১: ডিজিটাল মার্কেটিংয়ে স্বয়ংক্রিয় কর্মপ্রবাহ (Autonomous Workflow) কী?\nগত ৪ দিনে আপনি মার্কেট রিসার্চ, ছবি, ব্যানার, ভিডিও, সেলস কপি ও একটি লাইভ ওয়েবসাইট তৈরি করেছেন। কিন্তু ব্যবসা বা ক্লায়েন্টের কাজ শুরু হলে ২টি বড় বাস্তব সমস্যা দেখা দেয়:\n1. **রাত-দিন ক্রেতার একই প্রশ্নের উত্তর দেওয়া:** *\"দাম কত?\", \"খাঁটি তো?\", \"ডেলিভারি কবে পাবো?\"* — মানুষ একা ২৪ ঘণ্টা অনলাইনে বসে থাকতে পারে না।\n2. **অর্ডার ফর্মের তথ্য হারিয়ে যাওয়া:** ক্রেতা ওয়েবসাইটে ফর্ম পূরণ করলেন, কিন্তু বিক্রেতা সাথে সাথে না জানলে বা ডাটা সংরক্ষিত না থাকলে বিক্রি হাতছাড়া হয়।\n\nআজ আমরা কোনো সার্ভার খরচ বা প্রোগ্রামিং ছাড়াই **Voiceflow** ও **Make.com** দিয়ে এই পুরো প্রক্রিয়াটিকে স্বয়ংক্রিয় (**Autonomous Workflow**) করবো!\n\n---\n\n## অধ্যায় ২: Voiceflow-তে ২৪/৭ এআই কাস্টমার চ্যাটবট তৈরি (ধাপে ধাপে)\n*(ফ্রি প্ল্যানে সরাসরি কাজ করে এবং এক টুকরো স্ক্রিপ্টেই আপনার ওয়েবসাইটে বসে যায়)*\n\n### ধাপ ১: Knowledge Base তৈরি (চ্যাটবটের মস্তিষ্ক)\n1. একটি নোটপ্যাড ফাইলে (`sanjibon_faq.txt`) বা সরাসরি Voiceflow টেক্সটে আপনার ব্যবসার সমস্ত সঠিক তথ্য গুছিয়ে লিখুন:\n   - ব্র্যান্ডের নাম ও ঠিকানা\n   - প্রতিটি পণ্যের নাম, পরিমাণ ও নির্দিষ্ট দাম (৳)\n   - ডেলিভারি চার্জ ও সময় (ঢাকা বনাম সারাদেশ, ক্যাশ অন ডেলিভারি নিয়ম)\n   - রিটার্ন/এক্সচেঞ্জ পলিসি ও হেল্পলাইন নম্বর\n2. **Gemini দিয়ে দ্রুত FAQ ডকুমেন্ট তৈরি করার প্রম্পট:**\n```text\nআমার ব্র্যান্ড [নাম ও পণ্যের ধরন]-এর কাস্টমার সাপোর্ট AI Chatbot (Voiceflow Knowledge Base)-এ আপলোড করার জন্য ১ পাতার পরিষ্কার বাংলা+ইংরেজি \"Product FAQ & Policy Document\" লিখে দাও। এতে পণ্য তালিকা, দাম, অর্ডার প্রক্রিয়া, ডেলিভারি চার্জ, খাঁটিত্ব যাচাই ও রিটার্ন নীতি পরিষ্কারভাবে থাকবে। বট যেন অজানা বিষয়ে ভুল তথ্য না দিয়ে হেল্পলাইনে যোগাযোগ করতে বলে—সেই নির্দেশও উল্লেখ করো।\n```\n…"
  },
  {
    "id": "kb-sanjibon-drive-s10",
    "titleEn": "Session 10: Final Exam, 3-Minute Capstone Defense & 7/30/90-Day Freelance Career Roadmap",
    "titleBn": "Session 10: চূড়ান্ত পরীক্ষা, ক্যাপস্টোন ডিফেন্স ও ফ্রিল্যান্সিং ক্যারিয়ার রোডম্যাপ",
    "category": "lecture_notes",
    "pinned": false,
    "enabled": true,
    "tags": [
      "session 10",
      "final exam",
      "capstone defense",
      "pitch",
      "freelancing",
      "fiverr",
      "upwork",
      "career roadmap"
    ],
    "sourceFileName": "Session_10_Course_Material_BN.md",
    "content": "Session 10 (Day 5 · Afternoon / দিন ৫ · বিকাল)\nSummary: Capstone graduation and freelance launch guide. Includes complete course recap, 30-question Final Comprehensive Mock Exam Bank, 3-minute Live Capstone Defense Pitch Script & final submission checklist, 5 high-demand AI services you can offer immediately, a 7 / 30 / 90-day career action plan, copy-paste Bangladeshi & international client outreach message templates, and sample Fiverr Gig package tiers.\nDrive Folder: https://drive.google.com/drive/folders/1PE0ZfFRo5IXBTtW6X8neQFgMDSpB_2_L\nCanva View: https://www.canva.com/d/I1urVYG_5mYKnct\nCanva Editable: https://www.canva.com/d/DSs3MtvcpXfJKkh\n\n---\n# সেশন ১০: সম্পূর্ণ কোর্স ম্যাটেরিয়াল ও হ্যান্ডবুক\n**প্রজেক্ট:** সঞ্জীবন প্রজেক্ট — বাংলাদেশ আনসার ও ভিডিপি (১১টি কেন্দ্র, ২৩২ জন প্রশিক্ষণার্থী)  \n**প্রশিক্ষণ প্রতিষ্ঠান:** ক্লাউড কানেক্ট এআই লিমিটেড (Cloud Connect AI Limited)  \n**প্রস্তুতকারক ও প্রধান প্রশিক্ষক:** মোঃ জিহাদ (Md. Jehad) — Certified Google AI Professional | Software Engineer, Cloud Connect AI Limited  \n**জাতীয় ও আন্তর্জাতিক স্বীকৃতি:** Passer #FE2023APR00005 (Level 2 Full Passer) — Fundamental IT Engineer Examination (FE) of Information Technology Engineers Examination (ITEE), Conducted by Bangladesh IT-engineers Examination Center (BD-ITEC), Bangladesh Computer Council (BCC)  \n**ভেরিফায়েড প্রোফাইল:** [Credly Badges (Google AI)](https://www.credly.com/users/jehadurre/badges/credly) • [LinkedIn Certifications](https://www.linkedin.com/in/jehadurre/details/certifications/)  \n**বিষয়:** চূড়ান্ত পরীক্ষা (Final Exam), লাইভ ক্যাপস্টোন ডিফেন্স ও ফ্রিল্যান্সিং ক্যারিয়ার রোডম্যাপ  \n**সেশন:** ৫ম দিন — বিকাল (দুপুর ০২:০০ – বিকাল ০৫:০০)  \n\n---\n\n## অধ্যায় ১: ফাইনাল পরীক্ষার নির্দেশনা ও সম্পূর্ণ কোর্সের সারসংক্ষেপ\nঅভিনন্দন! আপনি সফলভাবে ৫ দিনব্যাপী **৩০ ঘণ্টার Applied AI & Autonomous Workflows** প্রশিক্ষণের চূড়ান্ত ধাপে পৌঁছেছেন। দুপুর ০২:১৫-এ [arena.onnesha.courses](https://arena.onnesha.courses/)-এ **Final Comprehensive Exam** শুরু হবে। নিচের ১-নজরে ৫ দিনের মানচিত্রটি পরীক্ষার আগে ঝালাই করে নিন:\n\n| দিন | সকাল (০৯:০০–১২:০০) | বিকাল (০২:০০–০৫:০০) | মূল টুলস ও ডেলিভারেবল |\n| :---: | :--- | :--- | :--- |\n| **১ম দিন** | সেশন ০১: এআই পরিচিতি ও **CLEAR** প্রম্পট | সেশন ০২: মার্কেট রিসার্চ, USP ও **Custom AI Helper** | Google AI Studio, Gemini Gems, Market Report |\n| **২য় দিন** | সেশন ০৩: স্টুডিও প্রোডাক্ট ছবি (**SLABC**, `1:1`, `9:16`, `16:9`) | সেশন ০৪: অ্যাড ব্যানার ডিজাইন ও **Canva Layers** | Gemini Imagen, Canva (৬-ব্যানার সেট) |\n| **৩য় দিন** | সেশন ০৫: **১৫–৩০ সে. ভিডিও অ্যাড** ও বাংলা/ইংরেজি ভয়েস | সেশন ০৬: **PAS/AIDA/BAB** সেলস কপি + **Practical Test 1** | Clipchamp (`bn-BD`), ElevenLabs, Gemini Copy |\n| **৪র্থ দিন** | সেশন ০৭: কোডিং ছাড়া **Single-Page ওয়েবসাইট** (`index.html`) | সেশন ০৮: **Netlify/Vercel লাইভ হোস্টিং** ও বেসিক SEO | Gemini Canvas/Bolt, Netlify Drop, PageSpeed |\n| **৫ম দিন** | সেশন ০৯: **২৪/৭ Voiceflow চ্যাটবট** ও **Make.com অটোমেশন** | সেশন ১০: **ফাইনাল পরীক্ষা + ক্যাপস্টোন ডিফেন্স + ক্যারিয়ার** | Voiceflow, Make, Google Sheets, Onnesha Arena |\n\n---\n\n## অধ্যায় ২: ৩০টি চূড়ান্ত অনুশীলন প্রশ্ন ব্যাংক (Final Comprehensive Mock Exam)\n*(নিচের ৩০টি প্রশ্ন অনুশীলন করলে [arena.onnesha.courses](https://arena.onnesha.courses/)-এর চূড়ান্ত পরীক্ষার পূর্ণ প্রস্তুতি হয়ে যাবে)*\n…"
  }
] as Array<Omit<CourseKnowledgeEntry, "courseId" | "createdBy" | "createdAt" | "updatedAt">>).map(
    (item) => ({
      ...item,
      courseId,
      createdBy: "Google Drive Course Sync (232 AI Training)",
      createdAt: DRIVE_SEED_TS,
      updatedAt: DRIVE_SEED_TS,
    }),
  );
}
