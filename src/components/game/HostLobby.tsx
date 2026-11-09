import React, { useMemo, useState } from 'react';
import { GameSession } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { db } from '@/lib/db';
import { Bot, LockOpen, MapPin, Maximize2, Play, QrCode, ShieldAlert, ShieldCheck, Users, Volume2, VolumeX, X } from 'lucide-react';
import { audioEngine } from '@/lib/audio-engine';

interface HostLobbyProps {
  session: GameSession;
  onStartGame: () => void;
  onAddBots: () => void;
  onKickPlayer: (participantId: string) => void;
  onToggleSound: () => void;
  onUpdateSettings?: (settings: Partial<GameSession['settings']>) => void;
}

export const HostLobby: React.FC<HostLobbyProps> = ({
  session,
  onStartGame,
  onAddBots,
  onKickPlayer,
  onToggleSound,
  onUpdateSettings,
}) => {
  const { lang, t } = useLanguage();
  const [showQr, setShowQr] = useState(false);
  const [isMuted, setIsMuted] = useState(audioEngine.isMuted());
  const [filterRegionId, setFilterRegionId] = useState<string>('all');

  const regions = db.getRegions();
  const participants = Object.values(session.participants);
  const playerCount = participants.length;

  const filteredParticipants = useMemo(() => {
    if (filterRegionId === 'all') return participants;
    return participants.filter((p) => p.regionId === filterRegionId);
  }, [participants, filterRegionId]);

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    participants.forEach((p) => {
      const rId = p.regionId || 'reg-dhaka';
      counts[rId] = (counts[rId] || 0) + 1;
    });
    return counts;
  }, [participants]);

  const toggleAudio = () => {
    const next = audioEngine.toggleMute();
    setIsMuted(next);
    onToggleSound();
  };

  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/play?pin=${session.pin}`
      : `https://onnesha.app/play?pin=${session.pin}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(joinUrl)}`;

  const handleRegionRestrictionChange = (regId: string) => {
    if (!onUpdateSettings) return;
    if (regId === 'all') {
      onUpdateSettings({
        allowedRegionId: 'all',
        allowedRegionName: 'All Regions (National)',
      });
    } else {
      const reg = regions.find((r) => r.id === regId);
      if (reg) {
        onUpdateSettings({
          allowedRegionId: reg.id,
          allowedRegionName: `${reg.nameEn} (${reg.nameBn})`,
        });
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Banner with Giant PIN & Region Scope Control */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 text-center shadow-tactical">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 items-center justify-center">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('lobby_title')} · 500+ Seat Delta Engine Active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Allowed Region Selector */}
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-2.5 py-1 text-xs">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold text-muted-foreground hidden sm:inline">Scope:</span>
              <select
                value={session.settings.allowedRegionId || 'all'}
                onChange={(e) => handleRegionRestrictionChange(e.target.value)}
                className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
              >
                <option value="all">All Regions (National)</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameEn} Only
                  </option>
                ))}
              </select>
            </div>

            {/* Anti-Cheat Proctoring Toggle */}
            {onUpdateSettings && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    blockCopyPaste: !(session.settings.blockCopyPaste ?? true),
                    proctorMode: !(session.settings.blockCopyPaste ?? true),
                  })
                }
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                  (session.settings.blockCopyPaste ?? true)
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
                title="Detect tab/screen switches, DevTools, and Copy/Paste"
              >
                {(session.settings.blockCopyPaste ?? true) ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>Proctor: {(session.settings.blockCopyPaste ?? true) ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {/* Fullscreen Lock Toggle */}
            {onUpdateSettings && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    enforceFullscreen: !session.settings.enforceFullscreen,
                  })
                }
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                  session.settings.enforceFullscreen
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
                title="Require examinees to stay in Fullscreen mode during questions"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Screen Lock: {session.settings.enforceFullscreen ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleAudio}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-foreground hover:bg-accent"
              title={isMuted ? 'Unmute Sound FX' : 'Mute Sound FX'}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-destructive" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-500" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent shadow-sm"
            >
              <QrCode className="h-4 w-4 text-primary" />
              <span>QR Pass</span>
            </button>
          </div>
        </div>

        {/* Join Prompt & Giant PIN */}
        <div className="my-6">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {lang === 'bn' ? 'অংশগ্রহণ করতে ব্রাউজারে প্রবেশ করুন' : 'Candidates join on mobile at'}{' '}
            <span className="font-mono text-primary underline">/play</span>
          </p>
          <div className="mt-2 font-mono text-5xl sm:text-8xl font-black tracking-widest text-foreground tabular-nums select-all">
            {session.pin}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {session.quizTitleBn || session.quizTitleEn} · {session.totalQuestions}{' '}
            {t('questions_count')} · Scope:{' '}
            <strong className="text-primary">
              {session.settings.allowedRegionName || 'All Regions'}
            </strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onStartGame}
            disabled={playerCount === 0}
            className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-extrabold uppercase tracking-wider text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:opacity-40"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>
              {t('start_game_now')} ({playerCount})
            </span>
          </button>

          <button
            onClick={onAddBots}
            className="flex items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 text-sm font-bold text-foreground shadow-sm hover:bg-accent transition-all"
          >
            <Bot className="h-4 w-4 text-primary" />
            <span>{t('add_bot_players')}</span>
          </button>
        </div>
      </div>

      {/* Real Scannable QR Code Popup Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl">
            <button
              onClick={() => setShowQr(false)}
              className="absolute right-4 top-4 rounded-xl border border-border p-1.5 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-display text-lg font-bold text-foreground">
              Scan QR to Join Exam Room
            </h3>
            <div className="my-5 flex justify-center">
              <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-white p-3 shadow-md border border-border">
                <img
                  src={qrImageUrl}
                  alt={`QR Code for PIN ${session.pin}`}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <p className="font-mono text-base font-black text-primary">PIN: {session.pin}</p>
            <p className="mt-1 text-xs text-muted-foreground break-all">{joinUrl}</p>
          </div>
        </div>
      )}

      {/* Connected Candidates Roster with Region Breakdown */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-display text-base font-bold text-foreground">
              {t('players_connected')} ({playerCount})
            </h3>
          </div>

          {/* Region Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterRegionId('all')}
              className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                filterRegionId === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({playerCount})
            </button>
            {regions.map((r) => {
              const c = regionCounts[r.id] || 0;
              if (c === 0) return null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setFilterRegionId(r.id)}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition ${
                    filterRegionId === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r.code}: {c}
                </button>
              );
            })}
          </div>
        </div>

        {playerCount === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <p>
              {lang === 'bn'
                ? 'এখনো কোনো পরীক্ষার্থী যুক্ত হয়নি।'
                : 'No candidates have locked their seats yet.'}
            </p>
            <p className="mt-1.5 text-xs">
              {lang === 'bn'
                ? 'পরীক্ষার্থীরা মোবাইল নম্বর বা রোল দিয়ে প্রবেশ করলে এখানে অঞ্চলসহ (Region) দেখা যাবে।'
                : 'Candidates appear here with their verified Region & Roll as soon as they join.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {filteredParticipants.map((p) => (
              <div
                key={p.id}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2 shadow-sm transition-all hover:border-primary/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm shadow-sm"
                    style={{ backgroundColor: p.avatarBg + '25' }}
                  >
                    {p.avatarEmoji}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{p.nickname}</div>
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <span>{p.rollNumber || 'N/A'}</span>
                      {p.regionName && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-semibold truncate">
                            {p.regionName.replace(' Range', '')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onKickPlayer(p.id)}
                  title="Unlock & Reset Candidate Seat (allows candidate to rejoin if they switched devices)"
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground hover:border-destructive hover:bg-destructive/10 hover:text-destructive transition"
                >
                  <LockOpen className="h-3 w-3" />
                  <span>Unlock</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
