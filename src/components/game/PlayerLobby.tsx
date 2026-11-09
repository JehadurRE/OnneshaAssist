import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Region } from '@/lib/types';
import { DEFAULT_REGIONS } from '@/lib/mock-data';
import { serverGetJoinDirectory, serverLookupCandidateByNumber } from '@/lib/server-session';
import { JoinSessionParams, JoinSessionResult } from '@/lib/game-engine';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  MapPin,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

interface DirectoryCandidate {
  id: string;
  name: string;
  rollNumber: string;
  regionId: string;
  regionName: string;
  batch: string;
  maskedPhone: string;
  isAlreadyJoined: boolean;
}

interface PlayerLobbyProps {
  pin: string;
  onJoinVerified: (params: JoinSessionParams) => Promise<JoinSessionResult>;
  requireRoll?: boolean;
  allowedRegionId?: string;
  allowedRegionName?: string;
}

const CADET_CRESTS = ['🦅', '⚡', '🛡️', '🎯', '🚀', '⭐', '🔥', '🐯'];
const CADET_COLORS = ['#059669', '#0284c7', '#d97706', '#0d9488', '#2563eb', '#16a34a'];

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({
  pin,
  onJoinVerified,
  allowedRegionId = 'all',
  allowedRegionName = 'All Regions',
}) => {
  const { lang } = useLanguage();

  // Directory state from server
  const [regions, setRegions] = useState<Region[]>(DEFAULT_REGIONS);
  const [candidates, setCandidates] = useState<DirectoryCandidate[]>([]);
  const [sessionAllowedRegionId, setSessionAllowedRegionId] = useState<string>(allowedRegionId);
  const [sessionAllowedRegionName, setSessionAllowedRegionName] = useState<string>(allowedRegionName);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(true);

  // Entry Mode: 'number_search' | 'region_select' | 'new_candidate'
  const [entryMode, setEntryMode] = useState<'number_search' | 'region_select' | 'new_candidate'>('number_search');

  // Mode 1: Fast Number Search & Auto-Fill
  const [searchNumber, setSearchNumber] = useState('');
  const [isSearchingNumber, setIsSearchingNumber] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [matchedCandidate, setMatchedCandidate] = useState<{
    id: string;
    name: string;
    rollNumber: string;
    phone: string;
    regionId: string;
    regionName: string;
    batch: string;
    isSeatLocked: boolean;
  } | null>(null);

  // Mode 2: Region -> Candidate Selection -> Number Verification
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [candidateFilterText, setCandidateFilterText] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [verificationInput, setVerificationInput] = useState('');

  // Mode 3: New Candidate Registration (with Region + Name + Roll + Phone)
  const [customName, setCustomName] = useState('');
  const [customRoll, setCustomRoll] = useState('');
  const [customPhone, setCustomPhone] = useState('');

  // Crest & Visuals
  const [selectedCrest, setSelectedCrest] = useState(CADET_CRESTS[0]);
  const [selectedColor, setSelectedColor] = useState(CADET_COLORS[0]);

  // Submission status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Load Regions & Roster Directory from Server
  useEffect(() => {
    let active = true;
    async function fetchDirectory() {
      setIsLoadingDirectory(true);
      try {
        const res = await serverGetJoinDirectory({ data: { pin } });
        if (active && res.success) {
          const loadedRegions = res.regions?.length ? res.regions : DEFAULT_REGIONS;
          setRegions(loadedRegions);
          setCandidates(res.candidates || []);
          const effRegId = res.allowedRegionId || allowedRegionId || 'all';
          setSessionAllowedRegionId(effRegId);
          setSessionAllowedRegionName(res.allowedRegionName || allowedRegionName || 'All Regions');
          setSelectedRegionId(effRegId !== 'all' ? effRegId : loadedRegions[0]?.id || 'reg-dhaka');
        }
      } catch {
        if (active) {
          setSelectedRegionId(DEFAULT_REGIONS[0].id);
        }
      } finally {
        if (active) setIsLoadingDirectory(false);
      }
    }
    fetchDirectory();
    return () => {
      active = false;
    };
  }, [pin, allowedRegionId, allowedRegionName]);

  // Live auto-lookup when user types Mobile Number or Roll Number in Mode 1
  useEffect(() => {
    const clean = searchNumber.trim();
    setSubmitError(null);
    if (clean.length < 3) {
      setMatchedCandidate(null);
      setLookupError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingNumber(true);
      setLookupError(null);
      try {
        const res = await serverLookupCandidateByNumber({
          data: { pin, query: clean, regionId: selectedRegionId },
        });
        if (res.success && res.candidate) {
          setMatchedCandidate(res.candidate);
          setSelectedRegionId(res.candidate.regionId);
          setLookupError(null);
        } else {
          setMatchedCandidate(null);
          setLookupError(res.error || 'No candidate found with this number.');
        }
      } catch {
        setLookupError('Unable to reach verification server.');
      } finally {
        setIsSearchingNumber(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchNumber, pin]);

  const availableRegions = useMemo(() => {
    if (sessionAllowedRegionId && sessionAllowedRegionId !== 'all') {
      return regions.filter((r) => r.id === sessionAllowedRegionId);
    }
    return regions;
  }, [regions, sessionAllowedRegionId]);

  const regionCandidates = useMemo(() => {
    return candidates
      .filter((c) => !selectedRegionId || c.regionId === selectedRegionId)
      .filter((c) => {
        if (!candidateFilterText.trim()) return true;
        const q = candidateFilterText.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.rollNumber.toLowerCase().includes(q);
      });
  }, [candidates, selectedRegionId, candidateFilterText]);

  const selectedDirectoryCandidate = useMemo(
    () => candidates.find((c) => c.id === selectedCandidateId) || null,
    [candidates, selectedCandidateId]
  );

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (entryMode === 'number_search') {
      if (!matchedCandidate) {
        setSubmitError(
          lang === 'bn'
            ? 'অনুগ্রহ করে আপনার নিবন্ধিত মোবাইল নম্বর বা রোল নম্বর দিয়ে সার্চ করুন।'
            : 'Please enter your registered Mobile Number or Roll Number to auto-fill your identity.'
        );
        return;
      }

      setIsSubmitting(true);
      const res = await onJoinVerified({
        pin,
        candidateId: matchedCandidate.id,
        nickname: matchedCandidate.name,
        avatarEmoji: selectedCrest,
        avatarBg: selectedColor,
        rollNumber: matchedCandidate.rollNumber,
        phone: matchedCandidate.phone,
        regionId: matchedCandidate.regionId,
        regionName: matchedCandidate.regionName,
        verificationNumber: searchNumber.trim(),
      });
      setIsSubmitting(false);

      if (!res.success) {
        setSubmitError(res.error || 'Verification failed.');
      }
      return;
    }

    if (entryMode === 'region_select') {
      if (!selectedDirectoryCandidate) {
        setSubmitError(
          lang === 'bn'
            ? 'অনুগ্রহ করে আপনার রেঞ্জ/অঞ্চল এবং নাম নির্বাচন করুন।'
            : 'Please select your Region and your Name from the roster.'
        );
        return;
      }
      if (!verificationInput.trim() || verificationInput.trim().length < 3) {
        setSubmitError(
          lang === 'bn'
            ? 'অন্য কেউ যাতে আপনার নামে পরীক্ষা দিতে না পারে, সেজন্য আপনার মোবাইল নম্বর বা রোল নম্বরটি লিখুন।'
            : 'To prevent impersonation, please enter your registered Mobile Number or Roll Number to verify ownership.'
        );
        return;
      }

      setIsSubmitting(true);
      const res = await onJoinVerified({
        pin,
        candidateId: selectedDirectoryCandidate.id,
        nickname: selectedDirectoryCandidate.name,
        avatarEmoji: selectedCrest,
        avatarBg: selectedColor,
        rollNumber: selectedDirectoryCandidate.rollNumber,
        regionId: selectedDirectoryCandidate.regionId,
        regionName: selectedDirectoryCandidate.regionName,
        verificationNumber: verificationInput.trim(),
      });
      setIsSubmitting(false);

      if (!res.success) {
        setSubmitError(res.error || 'Identity verification failed.');
      }
      return;
    }

    // Mode 3: New Candidate Registration
    const regObj = regions.find((r) => r.id === selectedRegionId) || DEFAULT_REGIONS[0];
    if (!customName.trim() || !customRoll.trim() || !customPhone.trim()) {
      setSubmitError(
        lang === 'bn'
          ? 'রেঞ্জ, পূর্ণ নাম, রোল এবং মোবাইল নম্বর আবশ্যক।'
          : 'Region, Full Name, Roll Number, and Mobile Number are required.'
      );
      return;
    }

    setIsSubmitting(true);
    const res = await onJoinVerified({
      pin,
      nickname: customName.trim(),
      avatarEmoji: selectedCrest,
      avatarBg: selectedColor,
      rollNumber: customRoll.trim(),
      phone: customPhone.trim(),
      regionId: regObj.id,
      regionName: regObj.nameEn,
      verificationNumber: customPhone.trim(),
    });
    setIsSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error || 'Could not register seat.');
    }
  };

  return (
    <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-tactical transition-all">
      {/* Header Pass & Security Notice */}
      <div className="text-center border-b border-border/70 pb-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 font-mono text-xs font-bold text-primary">
          <Shield className="h-3.5 w-3.5" />
          <span>EXAM PIN: {pin}</span>
          {sessionAllowedRegionId !== 'all' && (
            <>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400">{sessionAllowedRegionName}</span>
            </>
          )}
        </div>

        <h2 className="mt-3 font-display text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
          {lang === 'bn'
            ? 'পরীক্ষার্থী ভেরিফিকেশন ও আসন গ্রহণ'
            : 'Candidate Identity & Region Verification'}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === 'bn'
            ? 'আপনার মোবাইল/রোল নম্বর দিয়ে সার্চ করুন অথবা অঞ্চল (Region) ও নাম নির্বাচন করুন'
            : 'Search by Mobile/Roll Number to auto-fill, or select your Region & Name'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5 border border-border/60">
        <button
          type="button"
          onClick={() => {
            setEntryMode('number_search');
            setSubmitError(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all ${
            entryMode === 'number_search'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'নম্বর দিয়ে অটো-ফিল' : 'Number Search'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryMode('region_select');
            setSubmitError(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all ${
            entryMode === 'region_select'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'রেঞ্জ ও নাম নির্বাচন' : 'Region & Name'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryMode('new_candidate');
            setSubmitError(null);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-bold transition-all ${
            entryMode === 'new_candidate'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'নতুন নিবন্ধন' : 'New Entry'}</span>
        </button>
      </div>

      <form onSubmit={handleJoinSubmit} className="mt-5 space-y-5">
        {/* MODE 1: TYPE MOBILE NUMBER OR ROLL NUMBER -> AUTO-SEARCH & FILL */}
        {entryMode === 'number_search' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                {lang === 'bn'
                  ? 'আপনার মোবাইল নম্বর অথবা রোল/আইডি নম্বর লিখুন *'
                  : 'Type Registered Mobile Number or Roll / ID Number *'}
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: 01711000101 অথবা 2026-101'
                      : 'e.g. 01711000101 or 2026-101'
                  }
                  className="w-full rounded-2xl border-2 border-border bg-background pl-11 pr-4 py-3.5 font-mono text-sm font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {lang === 'bn'
                  ? 'নম্বর টাইপ করার সাথে সাথে আপনার নাম, রোল এবং অঞ্চল (Region) স্বয়ংক্রিয়ভাবে পূরণ হবে।'
                  : 'Your verified Full Name, Region, and Roll will auto-fill automatically from the official roster.'}
              </p>
            </div>

            {/* Quick Sample Hint Pills for Instant Testing */}
            {candidates.length > 0 && !matchedCandidate && (
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 space-y-2">
                <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>
                    {lang === 'bn'
                      ? 'দ্রুত টেস্ট করতে নিচের যেকোনো নিবন্ধিত নম্বর ট্যাপ করুন:'
                      : 'Tap a registered candidate number to test instant auto-fill:'}
                  </span>
                  <span className="font-mono text-[10px] text-primary">{candidates.length} Enrolled</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {candidates.slice(0, 4).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSearchNumber(c.rollNumber)}
                      className="rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-mono font-semibold text-foreground hover:border-primary hover:text-primary transition"
                    >
                      {c.rollNumber} · {c.name.split(' ')[0]} ({c.regionName.replace(' Range', '')})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Filled Verified Candidate Identity Card */}
            {matchedCandidate && (
              <div
                className={`rounded-2xl border-2 p-4 space-y-3 transition-all ${
                  matchedCandidate.isSeatLocked
                    ? 'border-amber-500/60 bg-amber-500/10'
                    : 'border-emerald-500/60 bg-emerald-500/10'
                }`}
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      {lang === 'bn' ? 'ভেরিফাইড পরীক্ষার্থী প্রোফাইল' : 'Verified Roster Identity Matched'}
                    </span>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary border border-border">
                    {matchedCandidate.regionName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {lang === 'bn' ? 'পরীক্ষার্থীর নাম' : 'Candidate Name'}
                    </div>
                    <div className="font-display text-sm font-extrabold text-foreground mt-0.5">
                      {matchedCandidate.name}
                    </div>
                  </div>

                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {lang === 'bn' ? 'রোল / ক্যাডেট আইডি' : 'Roll / Service ID'}
                    </div>
                    <div className="font-mono text-sm font-extrabold text-primary mt-0.5">
                      {matchedCandidate.rollNumber}
                    </div>
                  </div>

                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {lang === 'bn' ? 'অঞ্চল / রেঞ্জ' : 'Assigned Region'}
                    </div>
                    <div className="font-semibold text-foreground mt-0.5">{matchedCandidate.regionName}</div>
                  </div>

                  <div className="rounded-xl bg-background/80 p-2.5 border border-border/60">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">
                      {lang === 'bn' ? 'আসন নিরাপত্তা' : 'Seat Lock Status'}
                    </div>
                    <div className="font-semibold mt-0.5 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-emerald-600" />
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {matchedCandidate.isSeatLocked ? 'Active (Reconnect)' : 'Protected Seat'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {lookupError && !isSearchingNumber && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: SELECT REGION -> SELECT STUDENT NAME -> VERIFY NUMBER */}
        {entryMode === 'region_select' && (
          <div className="space-y-4">
            {/* Step 1: Select Region */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-foreground mb-1.5">
                {lang === 'bn' ? '১. আপনার অঞ্চল (Region / Range) নির্বাচন করুন *' : '1. Select Your Region / Range *'}
              </label>
              <select
                value={selectedRegionId}
                onChange={(e) => {
                  setSelectedRegionId(e.target.value);
                  setSelectedCandidateId('');
                }}
                className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary"
              >
                {availableRegions.map((reg) => {
                  const count = candidates.filter((c) => c.regionId === reg.id).length;
                  return (
                    <option key={reg.id} value={reg.id}>
                      {lang === 'bn' ? `${reg.nameBn} (${reg.nameEn})` : `${reg.nameEn} (${reg.nameBn})`} — {count} Candidates
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Step 2: Filter & Select Candidate Name in that Region */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  {lang === 'bn' ? '২. তালিকা থেকে আপনার নাম নির্বাচন করুন *' : '2. Select Your Name from Region Roster *'}
                </label>
                <span className="font-mono text-[11px] text-primary font-bold">
                  {regionCandidates.length} {lang === 'bn' ? 'জন পাওয়া গেছে' : 'in Region'}
                </span>
              </div>

              {candidates.filter((c) => c.regionId === selectedRegionId).length > 5 && (
                <div className="relative mb-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={candidateFilterText}
                    onChange={(e) => setCandidateFilterText(e.target.value)}
                    placeholder={lang === 'bn' ? 'নাম বা রোল দিয়ে খুঁজুন...' : 'Filter name or roll in this region...'}
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-xs font-semibold text-foreground outline-none focus:border-primary"
                  />
                </div>
              )}

              <div className="max-h-44 overflow-y-auto rounded-2xl border-2 border-border bg-background divide-y divide-border/60">
                {isLoadingDirectory ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">Loading regional roster...</div>
                ) : regionCandidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No candidates enrolled in this Region yet. Switch to &quot;New Entry&quot; to register.
                  </div>
                ) : (
                  regionCandidates.map((cand) => {
                    const isSelected = selectedCandidateId === cand.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => {
                          setSelectedCandidateId(cand.id);
                          setSubmitError(null);
                        }}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-bold'
                            : 'hover:bg-accent text-foreground'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm">{cand.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            Roll: {cand.rollNumber} · {cand.regionName}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {cand.isAlreadyJoined && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                              LOCKED
                            </span>
                          )}
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-primary bg-primary text-white' : 'border-muted-foreground'
                            }`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 3: Anti-Impersonation Verification Number */}
            {selectedDirectoryCandidate && (
              <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>
                      {lang === 'bn'
                        ? '৩. পরিচয় নিশ্চিত করতে আপনার মোবাইল বা রোল নম্বর দিন *'
                        : '3. Verify Your Mobile or Roll Number *'}
                    </span>
                  </label>
                  {selectedDirectoryCandidate.maskedPhone && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      Hint: {selectedDirectoryCandidate.maskedPhone}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={verificationInput}
                  onChange={(e) => setVerificationInput(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? `মোবাইল নম্বর (${selectedDirectoryCandidate.maskedPhone || '017...'}) অথবা রোল (${selectedDirectoryCandidate.rollNumber})`
                      : `Enter your Mobile Number or Roll (${selectedDirectoryCandidate.rollNumber})`
                  }
                  className="w-full rounded-xl border-2 border-border bg-background px-3.5 py-2.5 font-mono text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  {lang === 'bn'
                    ? 'নিরাপত্তা লক: সঠিক নম্বর ছাড়া অন্য কেউ আপনার নামে পরীক্ষায় অংশ নিতে পারবে না।'
                    : 'Anti-Impersonation Lock: Prevents anyone else from taking the exam under your name.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: NEW CANDIDATE REGISTRATION WITH REGION */}
        {entryMode === 'new_candidate' && (
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === 'bn' ? 'অঞ্চল / রেঞ্জ নির্বাচন করুন *' : 'Select Region / Range *'}
              </label>
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 text-xs sm:text-sm font-bold text-foreground outline-none focus:border-primary"
              >
                {availableRegions.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.nameEn} ({reg.nameBn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                {lang === 'bn' ? 'পরীক্ষার্থীর পূর্ণ নাম *' : 'Candidate Full Name *'}
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={lang === 'bn' ? 'আপনার পূর্ণ নাম লিখুন' : 'e.g. Cadet Mahmudul Hasan'}
                className="w-full rounded-2xl border-2 border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {lang === 'bn' ? 'রোল / সার্ভিস আইডি *' : 'Roll / Service ID *'}
                </label>
                <input
                  type="text"
                  required
                  value={customRoll}
                  onChange={(e) => setCustomRoll(e.target.value)}
                  placeholder="e.g. 2026-125"
                  className="w-full rounded-2xl border-2 border-border bg-background px-3.5 py-2.5 font-mono text-sm font-bold text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  {lang === 'bn' ? 'মোবাইল নম্বর (সিট লক) *' : 'Mobile Number (Seat Lock) *'}
                </label>
                <input
                  type="tel"
                  required
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full rounded-2xl border-2 border-border bg-background px-3.5 py-2.5 font-mono text-sm font-bold text-foreground outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        {/* Compact Badge Selector */}
        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-sm"
              style={{ backgroundColor: selectedColor }}
            >
              {selectedCrest}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {lang === 'bn' ? 'ক্যাডেট প্রতীক:' : 'Insignia:'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {CADET_CRESTS.map((crest, idx) => (
              <button
                key={crest}
                type="button"
                onClick={() => {
                  setSelectedCrest(crest);
                  setSelectedColor(CADET_COLORS[idx % CADET_COLORS.length]);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition ${
                  selectedCrest === crest ? 'ring-2 ring-primary bg-card scale-105' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {crest}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="flex items-start gap-2 rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-3.5 text-xs font-bold text-destructive animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            isSubmitting ||
            (entryMode === 'number_search' && !matchedCandidate) ||
            (entryMode === 'region_select' && (!selectedDirectoryCandidate || !verificationInput.trim()))
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-md transition-all hover:bg-primary/90 disabled:opacity-40"
        >
          <UserCheck className="h-4 w-4" />
          <span>
            {isSubmitting
              ? lang === 'bn'
                ? 'আসন যাচাই ও লক করা হচ্ছে...'
                : 'Verifying Identity & Locking Seat...'
              : lang === 'bn'
              ? 'পরিচয় নিশ্চিত করে পরীক্ষায় প্রবেশ করুন'
              : 'Verify Identity & Lock Exam Seat'}
          </span>
        </button>
      </form>
    </div>
  );
};
