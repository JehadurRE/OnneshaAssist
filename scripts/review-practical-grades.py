#!/usr/bin/env python3
"""
One-shot practical marking pass for AI-DM Final Exam.
Reads /tmp/full_ungraded.json, reviews each answer, writes
scripts/data/practical-grades-reviewed.json with bilingual EN/BN comments.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

IN = Path("/tmp/full_ungraded.json")
OUT = Path("/workspace/scripts/data/practical-grades-reviewed.json")

URL_RE = re.compile(r"https?://[^\s)\]>\"']+", re.I)
VIDEO_EXT = re.compile(r"\.(mp4|webm|mov|m4v)(\b|$)", re.I)
IMAGE_EXT = re.compile(r"\.(png|jpe?g|webp|gif)(\b|$)", re.I)
DOC_EXT = re.compile(r"\.(pdf|docx?|txt|zip)(\b|$)", re.I)
LIVE = re.compile(
    r"(netlify\.app|vercel\.app|github\.io|pages\.dev|web\.app|firebaseapp|"
    r"infinityfree|free\.je|kit\.com|carrd\.co|framer\.website|webflow\.io|"
    r"wordpress\.com|blogspot|wixsite|sites\.google\.com|shopify|myshopify|"
    r"ghost\.io|notion\.site|linktr\.ee|bio\.link|canva\.link|ai\.studio|"
    r"gemini\.google|cartvai\.com|softr\.app|glitch\.me|replit\.dev|"
    r"onrender\.com|railway\.app|surge\.sh)",
    re.I,
)
FAKE_LANDING = re.compile(
    r"(support\.google\.com|forms\.gle|docs\.google\.com/document|"
    r"facebook\.com/?(\?|$)|google\.com/search|ahrefs\.com|chatgpt\.com)",
    re.I,
)
SOCIAL = re.compile(
    r"(facebook\.com|fb\.watch|instagram\.com|youtu\.be|youtube\.com|tiktok\.com|reel/)",
    re.I,
)
DRIVE = re.compile(r"(drive\.google\.com|docs\.google\.com|canva\.com)", re.I)
AI = re.compile(
    r"(ai\s*(assistant|chatbot|bot)|চ্যাটবট|এআই|chat\s*widget|tawk|crisp|intercom|"
    r"bonus:\s*ai|assistant added)",
    re.I,
)
RESEARCH = re.compile(
    r"(audience|competitor|pain|offer|target|market|প্রতিযোগ|অডিয়েন্স|পেইন|"
    r"customer|segment|competitor|research|গবেষণা|টার্গেট)",
    re.I,
)
SCRIPT = re.compile(
    r"(hook|problem|solution|cta|call\s*to\s*action|হুক|সমস্যা|সমাধান|tagline)",
    re.I,
)


def bi(en: str, bn: str) -> str:
    return f"{en} / {bn}"


def clamp(m: float, mx: float) -> float:
    return max(0.0, min(mx, round(m * 10) / 10))


def ans_map(s):
    return {a["taskId"]: a for a in s.get("answers") or []}


def brand_of(am) -> str:
    t = (am.get("task-brand-name") or {}).get("text") or ""
    t = t.replace("\\n", "\n").replace("\r", "\n")
    # first non-empty line
    for line in t.split("\n"):
        line = line.strip().strip("*").strip()
        if not line:
            continue
        line = re.sub(r"^(ব্র্যান্ডের?\s*নাম|brand\s*name)\s*[:\-–—]?\s*", "", line, flags=re.I)
        line = re.split(r"[–\-—|:]", line)[0].strip().strip("*").strip()
        if line.lower().startswith("http"):
            continue
        if len(line) >= 2:
            if len(line) > 48:
                line = line[:45] + "…"
            return line
    return "your brand"


def urls(*parts: str):
    out = []
    for p in parts:
        out.extend(URL_RE.findall(p or ""))
    return out


def plain_len(text: str) -> int:
    return len(URL_RE.sub(" ", text or "").strip())


def grade_brand(a, brand, mx=3):
    text = (a or {}).get("text") or ""
    L = plain_len(text)
    if not text.strip():
        return 0, bi("Brand name missing.", "ব্র্যান্ড নাম নেই।"), "missing"
    if text.strip().lower().startswith("http") or (L < 8 and urls(text)):
        return clamp(1, mx), bi(
            f"Need a clear brand name for “{brand}”, not only a link.",
            f"“{brand}”-এর জন্য শুধু লিংক নয় — স্পষ্ট ব্র্যান্ড নাম লিখুন।",
        ), "weak"
    if 2 <= L <= 90:
        return mx, bi(
            f"Brand name “{brand}” is clear and usable.",
            f"ব্র্যান্ড নাম “{brand}” স্পষ্ট ও ব্যবহারযোগ্য।",
        ), "strong"
    return clamp(2.5, mx), bi(
        f"Brand idea for “{brand}” is there — keep the official name shorter.",
        f"“{brand}”-এর ধারণা আছে; অফিসিয়াল নাম আরও সংক্ষিপ্ত রাখুন।",
    ), "adequate"


def grade_research(a, brand, mx=8):
    a = a or {}
    text = a.get("text") or ""
    link = a.get("link") or ""
    file = a.get("file") or ""
    has_file = a.get("hasFile") or bool(file)
    L = plain_len(text)
    hints = len(RESEARCH.findall(text))
    looks_filename = bool(re.match(r"^[\w\s.\-()০-৯]+\.(pdf|docx?|txt)$", text.strip(), re.I))

    if not text.strip() and not has_file and not link:
        return 0, bi(
            f"No market research for “{brand}”.",
            f"“{brand}”-এর মার্কেট রিসার্চ নেই।",
        ), "missing"

    if L >= 350 and hints >= 3:
        m = mx if has_file or DRIVE.search(text + link) else clamp(7.5, mx)
        return m, bi(
            f"Strong research for “{brand}” (audience / competitors / pain points).",
            f"“{brand}”-এর রিসার্চ ভালো — অডিয়েন্স, প্রতিযোগী ও পেইন পয়েন্ট আছে।",
        ), "strong"

    if L >= 180 and hints >= 2:
        return clamp(6.5, mx), bi(
            f"Good research notes for “{brand}”; add sharper competitor contrast.",
            f"“{brand}”-এর রিসার্চ নোট ভালো; প্রতিযোগী তুলনা আরও ধারালো করুন।",
        ), "adequate"

    if has_file and (DOC_EXT.search(file) or looks_filename or L >= 40):
        # file evidence but thin pasted notes
        if L < 40 or looks_filename:
            return clamp(5, mx), bi(
                f"Research file attached for “{brand}”; paste a short summary next time (audience, competitors, offer).",
                f"“{brand}”-এর রিসার্চ ফাইল আছে; পাশাপাশি সংক্ষিপ্ত সারাংশ লিখুন (অডিয়েন্স, প্রতিযোগী, অফার)।",
            ), "adequate"
        return clamp(6, mx), bi(
            f"Research evidence for “{brand}” accepted via notes/file.",
            f"“{brand}”-এর রিসার্চ প্রমাণ (নোট/ফাইল) গ্রহণযোগ্য।",
        ), "adequate"

    if L >= 60 or has_file or link:
        return clamp(3.5, mx), bi(
            f"Thin research for “{brand}” — needs clearer audience, competitors, and pain points.",
            f"“{brand}”-এর রিসার্চ দুর্বল — অডিয়েন্স, প্রতিযোগী ও পেইন পয়েন্ট স্পষ্ট করুন।",
        ), "weak"

    return clamp(2, mx), bi(
        f"Insufficient market research detail for “{brand}”.",
        f"“{brand}”-এর মার্কেট রিসার্চ অপর্যাপ্ত।",
    ), "weak"


def grade_fb(a, brand, mx=8):
    a = a or {}
    text = a.get("text") or ""
    link = a.get("link") or ""
    file = a.get("file") or ""
    has_file = a.get("hasFile") or bool(file)
    L = plain_len(text)
    visual = has_file and (IMAGE_EXT.search(file) or DOC_EXT.search(file) or VIDEO_EXT.search(file))
    has_link = bool(link or urls(text, link))
    two = bool(re.search(r"\b(2|two|দুই|২)\b", text, re.I)) or text.count("\n") >= 1 or (
        has_file and "," in file
    )

    if not text.strip() and not has_file and not has_link:
        return 0, bi(
            f"No Facebook creatives for “{brand}”.",
            f"“{brand}”-এর ফেসবুক ক্রিয়েটিভ নেই।",
        ), "missing"

    if L >= 100 and (visual or has_link) and two:
        return mx, bi(
            f"Two creatives for “{brand}” with captions + visual/link evidence.",
            f"“{brand}”-এর দুটি ক্রিয়েটিভ — ক্যাপশন ও ভিজ্যুয়াল/লিংক আছে।",
        ), "strong"

    if (L >= 50 and (visual or has_link)) or (visual and has_link):
        return clamp(6, mx), bi(
            f"Creatives for “{brand}” submitted; make both captions and visuals explicit.",
            f"“{brand}”-এর ক্রিয়েটিভ জমা আছে; দুটি ক্যাপশন ও ভিজ্যুয়াল আরও স্পষ্ট করুন।",
        ), "adequate"

    if has_file or has_link or L >= 25:
        return clamp(3.5, mx), bi(
            f"Partial creatives for “{brand}” — need two distinct posts with captions.",
            f"“{brand}”-এর ক্রিয়েটিভ আংশিক — দুটি আলাদা পোস্ট ও ক্যাপশন দরকার।",
        ), "weak"

    return clamp(1.5, mx), bi(
        f"Facebook creatives incomplete for “{brand}”.",
        f"“{brand}”-এর ফেসবুক ক্রিয়েটিভ অসম্পূর্ণ।",
    ), "weak"


def grade_script(a, brand, mx=6):
    a = a or {}
    text = a.get("text") or ""
    link = a.get("link") or ""
    blob = f"{text} {link}"
    L = plain_len(text)
    structured = len(SCRIPT.findall(blob)) >= 2
    doc = bool(DRIVE.search(blob))
    social_only = bool(SOCIAL.search(blob)) and not doc and L < 80

    if not text.strip() and not link:
        return 0, bi(
            f"Ad script missing for “{brand}”.",
            f"“{brand}”-এর অ্যাড স্ক্রিপ্ট নেই।",
        ), "missing"

    if social_only:
        return clamp(1.5, mx), bi(
            f"A social link is not a script for “{brand}” — write hook / problem / solution / CTA.",
            f"“{brand}”-এর জন্য সোশ্যাল লিংক স্ক্রিপ্ট নয় — হুক/সমস্যা/সমাধান/CTA লিখুন।",
        ), "weak"

    if L >= 140 and structured:
        return mx, bi(
            f"Clear ~10s script for “{brand}” (hook → problem → solution → CTA).",
            f"“{brand}”-এর ~১০ সেকেন্ড স্ক্রিপ্ট স্পষ্ট (হুক → সমস্যা → সমাধান → CTA)।",
        ), "strong"

    if (L >= 70 and structured) or (doc and L >= 8) or (doc and not social_only):
        return clamp(4.5, mx), bi(
            f"Script evidence for “{brand}” is OK; tighten the hook and final CTA.",
            f"“{brand}”-এর স্ক্রিপ্ট গ্রহণযোগ্য; হুক ও শেষ CTA আরও শক্ত করুন।",
        ), "adequate"

    if L >= 35 or doc:
        return clamp(2.5, mx), bi(
            f"Script for “{brand}” is thin — structure it for a 10-second ad.",
            f"“{brand}”-এর স্ক্রিপ্ট দুর্বল — ১০ সেকেন্ড অ্যাডের কাঠামো দিন।",
        ), "weak"

    return clamp(1, mx), bi(
        f"Ad script incomplete for “{brand}”.",
        f"“{brand}”-এর অ্যাড স্ক্রিপ্ট অসম্পূর্ণ।",
    ), "weak"


def grade_video(a, brand, mx=8):
    a = a or {}
    text = a.get("text") or ""
    link = a.get("link") or ""
    file = a.get("file") or ""
    mime = a.get("mime") or ""
    has_file = a.get("hasFile") or bool(file)
    blob = f"{text} {link} {file}"
    video_file = (has_file and (VIDEO_EXT.search(file) or mime.startswith("video/"))) or bool(
        VIDEO_EXT.search(blob)
    )
    video_link = bool(
        (SOCIAL.search(blob) or DRIVE.search(blob) or re.search(r"reel|vimeo|canva\.link", blob, re.I))
        and not re.search(r"ahrefs\.com|facebook\.com/?(\?|$)|google\.com/search", blob, re.I)
    )
    wrong = has_file and not video_file and (DOC_EXT.search(file) or IMAGE_EXT.search(file))

    if not has_file and not link and plain_len(text) < 5:
        return 0, bi(
            f"No ad video for “{brand}”.",
            f"“{brand}”-এর অ্যাড ভিডিও নেই।",
        ), "missing"

    if wrong and not video_link:
        return clamp(1.5, mx), bi(
            f"“{brand}”: uploaded {file or 'a non-video file'} — need a ~10s MP4/WebM or video link.",
            f"“{brand}”: {file or 'নন-ভিডিও ফাইল'} আপলোড — ~১০ সেকেন্ড MP4/WebM বা ভিডিও লিংক দরকার।",
        ), "weak"

    if video_file:
        return mx, bi(
            f"Video file submitted for “{brand}” (~10s ad).",
            f"“{brand}”-এর ~১০ সেকেন্ড অ্যাড ভিডিও ফাইল জমা হয়েছে।",
        ), "strong"

    if video_link:
        return clamp(6.5, mx), bi(
            f"Video link for “{brand}” accepted — confirm it matches the script.",
            f"“{brand}”-এর ভিডিও লিংক গ্রহণযোগ্য — স্ক্রিপ্টের সাথে মিল আছে কিনা দেখুন।",
        ), "adequate"

    return clamp(2.5, mx), bi(
        f"Video evidence for “{brand}” is unclear.",
        f"“{brand}”-এর ভিডিও প্রমাণ অস্পষ্ট।",
    ), "weak"


def grade_landing(a, brand, mx=7):
    a = a or {}
    text = a.get("text") or ""
    link = a.get("link") or ""
    blob = f"{text}\n{link}"
    us = urls(blob)
    primary = link.strip() or (us[0] if us else "")
    fake = bool(FAKE_LANDING.search(primary) or FAKE_LANDING.search(blob))
    # AI bonus only counts with a real live site (not a pasted “Bonus: AI” on junk URLs)
    ai = bool(AI.search(blob)) and not fake
    live = (not fake) and (
        bool(LIVE.search(primary))
        or (
            primary.startswith("https://")
            and not SOCIAL.search(primary)
            and not DRIVE.search(primary)
            and not FAKE_LANDING.search(primary)
        )
    )
    drive_only = bool(DRIVE.search(primary)) and not live
    social_only = bool(SOCIAL.search(primary)) and not live

    if not primary and plain_len(text) < 15:
        return 0, bi(
            f"Landing URL missing for “{brand}”.",
            f"“{brand}”-এর ল্যান্ডিং URL নেই।",
        ), "missing"

    if fake:
        return clamp(1, mx), bi(
            f"“{brand}”: this URL is not a brand landing page (support/form/generic link).",
            f"“{brand}”: এই URL ব্র্যান্ড ল্যান্ডিং পেজ নয় (সাপোর্ট/ফর্ম/জেনেরিক লিংক)।",
        ), "weak"

    if social_only:
        return clamp(1.5, mx), bi(
            f"“{brand}”: social post/reel is not a landing page — submit a live https site.",
            f"“{brand}”: সোশ্যাল পোস্ট/রিল ল্যান্ডিং নয় — লাইভ https সাইট দিন।",
        ), "weak"

    if drive_only:
        return clamp(3, mx), bi(
            f"“{brand}”: Drive/design file is not a live landing URL.",
            f"“{brand}”: Drive/ডিজাইন ফাইল লাইভ ল্যান্ডিং URL নয়।",
        ), "weak"

    if live and ai:
        return mx, bi(
            f"Live landing for “{brand}” with AI assistant bonus noted.",
            f"“{brand}”-এর লাইভ ল্যান্ডিং + AI অ্যাসিস্ট্যান্ট বোনাস উল্লেখ আছে।",
        ), "strong"

    if live:
        return clamp(6, mx), bi(
            f"Live landing URL for “{brand}” looks good. Add/confirm AI chatbot for full bonus.",
            f"“{brand}”-এর লাইভ ল্যান্ডিং ভালো। পূর্ণ বোনাসের জন্য AI চ্যাটবট নিশ্চিত করুন।",
        ), "strong"

    if us:
        return clamp(4, mx), bi(
            f"URL for “{brand}” present — verify it is a public live landing page.",
            f"“{brand}”-এর URL আছে — পাবলিক লাইভ ল্যান্ডিং কিনা যাচাই করুন।",
        ), "adequate"

    return clamp(1.5, mx), bi(
        f"Landing evidence incomplete for “{brand}”.",
        f"“{brand}”-এর ল্যান্ডিং প্রমাণ অসম্পূর্ণ।",
    ), "weak"


GRADERS = {
    "task-brand-name": (grade_brand, 3),
    "task-market-research": (grade_research, 8),
    "task-fb-creatives": (grade_fb, 8),
    "task-ad-script": (grade_script, 6),
    "task-ad-video": (grade_video, 8),
    "task-landing-page": (grade_landing, 7),
}


def review_one(s: dict) -> dict:
    am = ans_map(s)
    brand = brand_of(am)
    grades = []
    weak = 0
    strong = 0
    earned = 0.0
    max_total = 0.0
    for tid, (fn, mx) in GRADERS.items():
        marks, comment, band = fn(am.get(tid), brand, mx)
        grades.append(
            {
                "taskId": tid,
                "marks": marks,
                "maxMarks": mx,
                "comment": comment,
                "band": band,
            }
        )
        earned += marks
        max_total += mx
        if band in ("weak", "missing"):
            weak += 1
        if band == "strong":
            strong += 1

    pct = round((earned / max_total) * 1000) / 10 if max_total else 0
    name = s.get("name") or s.get("roll") or "Student"
    overview_en = (
        f"Marked package for {name} ({brand}): {earned:g}/{max_total:g} ({pct}%). "
        + (
            "Solid overall — spot-check links/files before certificate."
            if weak == 0
            else f"{strong} strong task(s), {weak} need attention — review those first."
        )
    )
    overview_bn = (
        f"{name} ({brand}) প্যাকেজ মার্ক: {earned:g}/{max_total:g} ({pct}%)। "
        + (
            "মোট ভালো — সনদের আগে লিংক/ফাইল একবার দেখুন।"
            if weak == 0
            else f"শক্তিশালী {strong}টি, রিভিউ দরকার {weak}টি — আগে সেগুলো দেখুন।"
        )
    )
    return {
        "submissionId": s["id"],
        "rollNumber": s["roll"],
        "studentName": name,
        "brand": brand,
        "earned": earned,
        "max": max_total,
        "pct": pct,
        "weakTasks": weak,
        "grades": [{k: g[k] for k in ("taskId", "marks", "maxMarks", "comment")} for g in grades],
        "instructorFeedback": f"{overview_en}\n{overview_bn}",
        "bands": {g["taskId"]: g["band"] for g in grades},
    }


def main():
    subs = json.loads(IN.read_text())
    reviewed = [review_one(s) for s in subs]
    reviewed.sort(key=lambda r: (r["weakTasks"], -r["pct"], r["rollNumber"] or ""))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "courseId": "course-sanjibon-ai-dm",
        "practicalExamId": "practical-course-sanjibon-ai-dm-final",
        "reviewedAt": "2026-11-21T22:10:00Z",
        "note": "Instructor-style marking pass with bilingual EN/BN comments. Staff should spot-check weak tasks before certificates.",
        "count": len(reviewed),
        "rows": reviewed,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    pcts = sorted(r["pct"] for r in reviewed)
    weakish = sum(1 for r in reviewed if r["weakTasks"] >= 2)
    print(
        f"wrote {OUT} n={len(reviewed)} "
        f"pct min/med/max={pcts[0]}/{pcts[len(pcts)//2]}/{pcts[-1]} "
        f"with>=2 weak={weakish}"
    )
    # show a few
    for r in reviewed[:3] + reviewed[-3:]:
        print(
            r["rollNumber"],
            r["brand"][:30],
            f"{r['earned']}/{r['max']}",
            r["pct"],
            "weak",
            r["weakTasks"],
        )


if __name__ == "__main__":
    main()
