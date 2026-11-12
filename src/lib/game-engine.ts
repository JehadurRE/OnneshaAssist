import {
  GameSession,
  GameSettings,
  Participant,
  ParticipantAnswer,
  Question,
  Quiz,
} from './types';
import { DEFAULT_REGIONS, READY_MADE_PACKS } from './mock-data';
import { db } from './db';
import {
  serverCreateSession,
  serverGetSession,
  serverHostControl,
  serverJoinSession,
  serverReportProctorIncident,
  serverSubmitAnswer,
  serverSyncSession,
} from './server-session';

export type GameEvent =
  | { type: 'SESSION_UPDATED'; session: GameSession }
  | { type: 'PLAYER_JOINED'; pin: string; participant: Participant }
  | { type: 'PLAYER_LEFT'; pin: string; participantId: string }
  | { type: 'ANSWER_SUBMITTED'; pin: string; participantId: string; answer: ParticipantAnswer }
  | { type: 'OFFLINE_QUEUE_CHANGED'; count: number; isOnline: boolean };

interface QueuedAnswerPayload {
  pin: string;
  participantId: string;
  questionId: string;
  selectedOptionIds: string[];
  writtenAnswer?: string | undefined;
  seatToken?: string | undefined;
  clientAnsweredAt: number;
}

const BOT_NAMES = [
  { name: 'Cadet Tanvir', emoji: '🦅', bg: '#059669' },
  { name: 'Cadet Sadia', emoji: '⚡', bg: '#0284c7' },
  { name: 'Cadet Rafiul', emoji: '🛡️', bg: '#d97706' },
  { name: 'Cadet Nusrat', emoji: '🎯', bg: '#0d9488' },
  { name: 'Cadet Farhan', emoji: '🚀', bg: '#2563eb' },
  { name: 'Cadet Mehnaz', emoji: '⭐', bg: '#e11d48' },
  { name: 'Cadet Tahmid', emoji: '🔥', bg: '#ea580c' },
  { name: 'Cadet Sumaiya', emoji: '🏆', bg: '#16a34a' },
];

export interface JoinSessionParams {
  pin: string;
  nickname: string;
  avatarEmoji: string;
  avatarBg: string;
  rollNumber?: string | undefined;
  phone?: string | undefined;
  regionId?: string | undefined;
  regionName?: string | undefined;
  candidateId?: string | undefined;
  verificationNumber?: string | undefined;
}

export interface JoinSessionResult {
  success: boolean;
  reconnected?: boolean | undefined;
  participant?: Participant | undefined;
  error?: string | undefined;
  code?: string | undefined;
}

class RealtimeGameEngine {
  private channel: BroadcastChannel | null = null;
  private listeners: ((event: GameEvent) => void)[] = [];
  private botTimers: number[] = [];
  private activePollingPin: string | null = null;
  private pollingRole: 'host' | 'player' = 'player';
  private pollingParticipantId: string | undefined = undefined;
  private lastKnownUpdatedAt = 0;
  private pollingTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        this.channel = new BroadcastChannel('onnesha_quiz_sync');
        this.channel.onmessage = (ev) => {
          if (ev.data) {
            this.notifyListeners(ev.data as GameEvent);
          }
        };
      }
      window.addEventListener('online', () => {
        this.flushOfflineOutbox();
        this.notifyListeners({
          type: 'OFFLINE_QUEUE_CHANGED',
          count: this.getOfflineOutbox().length,
          isOnline: true,
        });
      });
      window.addEventListener('offline', () => {
        this.notifyListeners({
          type: 'OFFLINE_QUEUE_CHANGED',
          count: this.getOfflineOutbox().length,
          isOnline: false,
        });
      });
    }
  }

  public getOfflineOutbox(): QueuedAnswerPayload[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = sessionStorage.getItem('onnesha_offline_outbox');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveOfflineOutbox(queue: QueuedAnswerPayload[]) {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('onnesha_offline_outbox', JSON.stringify(queue));
      this.notifyListeners({
        type: 'OFFLINE_QUEUE_CHANGED',
        count: queue.length,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      });
    } catch {}
  }

  private enqueueOfflineAnswer(item: QueuedAnswerPayload) {
    const queue = this.getOfflineOutbox().filter(
      (q) => !(q.pin === item.pin && q.participantId === item.participantId && q.questionId === item.questionId)
    );
    queue.push(item);
    this.saveOfflineOutbox(queue);
  }

  public async flushOfflineOutbox(): Promise<void> {
    const queue = this.getOfflineOutbox();
    if (queue.length === 0) return;

    const remaining: QueuedAnswerPayload[] = [];
    for (const item of queue) {
      try {
        const res = await serverSubmitAnswer({ data: item });
        if (res.success && res.session) {
          this.cacheSessionLocally(res.session);
        }
      } catch {
        remaining.push(item);
      }
    }
    this.saveOfflineOutbox(remaining);
  }

  public subscribe(cb: (event: GameEvent) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(event: GameEvent) {
    this.listeners.forEach((l) => l(event));
  }

  private broadcast(event: GameEvent) {
    this.notifyListeners(event);
    if (this.channel) {
      this.channel.postMessage(event);
    }
  }

  public getStoredSeatToken(pin: string): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem(`onnesha_seat_token_${pin}`) || undefined;
  }

  public saveStoredSeatToken(pin: string, participantId: string, seatToken: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`onnesha_seat_token_${pin}`, seatToken);
    localStorage.setItem(`onnesha_seat_pid_${pin}`, participantId);
  }

  public getStoredParticipantId(pin: string): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return localStorage.getItem(`onnesha_seat_pid_${pin}`) || undefined;
  }

  public getStoredHostToken(pin: string): string | undefined {
    if (typeof window === 'undefined') return undefined;
    return (
      sessionStorage.getItem(`onnesha_host_token_${pin}`) ||
      localStorage.getItem(`onnesha_host_token_${pin}`) ||
      undefined
    );
  }

  public saveStoredHostToken(pin: string, hostToken?: string) {
    if (typeof window === 'undefined' || !hostToken) return;
    sessionStorage.setItem(`onnesha_host_token_${pin}`, hostToken);
    localStorage.setItem(`onnesha_host_token_${pin}`, hostToken);
  }

  public getSession(pin: string): GameSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(`onnesha_session_${pin}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private cacheSessionLocally(session: GameSession) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`onnesha_session_${session.pin}`, JSON.stringify(session));
      if (session.updatedAt && session.updatedAt > this.lastKnownUpdatedAt) {
        this.lastKnownUpdatedAt = session.updatedAt;
      }
      this.broadcast({ type: 'SESSION_UPDATED', session });
    } catch {
      // ignore storage quota errors on large sessions
    }
  }

  public async getSessionAsync(
    pin: string,
    role: 'host' | 'player' = 'player',
    participantId?: string
  ): Promise<GameSession | null> {
    try {
      const effectivePid = participantId || this.getStoredParticipantId(pin);
      const res = await serverGetSession({
        data: {
          pin,
          role,
          ...(effectivePid ? { participantId: effectivePid } : {}),
        },
      });
      if (res.success && res.session) {
        this.cacheSessionLocally(res.session);
        this.startPolling(pin, role, effectivePid);
        return res.session;
      }
    } catch (e) {
      console.warn('Server session fetch fallback error:', e);
    }

    const local = this.getSession(pin);
    if (local) {
      this.startPolling(pin, role, participantId);
      return local;
    }
    return null;
  }

  // Host-only local + server sync
  public saveSession(session: GameSession) {
    if (typeof window === 'undefined') return;
    session.updatedAt = Date.now();
    this.cacheSessionLocally(session);
    const hostToken = this.getStoredHostToken(session.pin);
    serverSyncSession({ data: { session, hostToken } })
      .then((res) => {
        if (res.success && res.hostToken) {
          this.saveStoredHostToken(session.pin, res.hostToken);
        }
      })
      .catch(() => {});
  }

  // Jittered Delta Polling engineered for 500+ concurrent clients
  public startPolling(pin: string, role: 'host' | 'player' = 'player', participantId?: string) {
    if (typeof window === 'undefined') return;
    if (
      this.activePollingPin === pin &&
      this.pollingRole === role &&
      this.pollingParticipantId === participantId &&
      this.pollingTimer
    ) {
      return;
    }

    this.stopPolling();
    this.activePollingPin = pin;
    this.pollingRole = role;
    this.pollingParticipantId = participantId;

    // Host polls every 800ms; 500 Players poll every 1250ms + 0-250ms random jitter to prevent thundering herd
    const intervalMs = role === 'host' ? 800 : 1250 + Math.floor(Math.random() * 250);

    this.pollingTimer = setInterval(async () => {
      try {
        if (this.pollingRole === 'player' && this.getOfflineOutbox().length > 0) {
          await this.flushOfflineOutbox();
        }
        const effectivePid = this.pollingParticipantId || this.getStoredParticipantId(pin);
        const res = await serverGetSession({
          data: {
            pin,
            role: this.pollingRole,
            ...(effectivePid ? { participantId: effectivePid } : {}),
            sinceUpdatedAt: this.lastKnownUpdatedAt,
          },
        });

        if (res.success && !res.unchanged && res.session) {
          this.cacheSessionLocally(res.session);
        }
      } catch {
        // quiet fallback
      }
    }, intervalMs);
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.activePollingPin = null;
    }
  }

  // Create Session (Host)
  public createSession(
    quiz: Quiz,
    isFormal = true,
    allowedRegionId = 'all',
    allowedRegionName = 'All Regions (National)'
  ): GameSession {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const session: GameSession = {
      pin,
      quizId: quiz.id,
      quizTitleEn: quiz.titleEn,
      quizTitleBn: quiz.titleBn,
      hostId: 'host-' + now,
      phase: 'lobby',
      currentQuestionIndex: -1,
      questionStartTime: 0,
      questionEndTime: 0,
      settings: {
        speedBonus: true,
        negativeMarking: isFormal ? 0.25 : 0,
        shuffleQuestions: false,
        shuffleOptions: false,
        soundEnabled: true,
        musicEnabled: true,
        isFormalAssessment: isFormal,
        requireRollNumber: isFormal,
        requireRosterVerification: true,
        allowedRegionId,
        allowedRegionName,
      },
      participants: {},
      totalQuestions: quiz.questions.length,
      createdAt: now,
      updatedAt: now,
      participantCount: 0,
      answeredCount: 0,
      proctorIncidents: [],
    };

    this.saveSession(session);
    this.startPolling(pin, 'host');
    return session;
  }

  public async createSessionAsync(
    quiz: Quiz,
    isFormal = true,
    allowedRegionId = 'all',
    allowedRegionName = 'All Regions (National)'
  ): Promise<GameSession> {
    try {
      const res = await serverCreateSession({
        data: {
          quiz,
          isFormal,
          allowedRegionId,
          allowedRegionName,
        },
      });
      if (res.success && res.session) {
        if (res.hostToken) {
          this.saveStoredHostToken(res.session.pin, res.hostToken);
        }
        this.cacheSessionLocally(res.session);
        this.startPolling(res.session.pin, 'host');
        return res.session;
      }
    } catch (err) {
      console.warn('Server createSession fallback:', err);
    }
    return this.createSession(quiz, isFormal, allowedRegionId, allowedRegionName);
  }

  public async resumeHostSessionAsync(pin: string): Promise<GameSession | null> {
    try {
      const res = await serverGetSession({
        data: { pin: pin.trim(), role: 'host' },
      });
      if (res.success && res.session) {
        this.cacheSessionLocally(res.session);
        this.startPolling(res.session.pin, 'host');
        return res.session;
      }
    } catch (err) {
      console.warn('Host session resume error:', err);
    }
    const local = this.getSession(pin.trim());
    if (local) {
      this.startPolling(local.pin, 'host');
      return local;
    }
    return null;
  }

  public async closeRoomAsync(pin: string): Promise<boolean> {
    try {
      const res = await serverHostControl({
        data: {
          pin,
          hostToken: this.getStoredHostToken(pin),
          action: 'close_room',
        },
      });
      if (this.activePollingPin === pin) {
        this.stopPolling();
      }
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`onnesha_game_${pin}`);
      }
      return !!res.success;
    } catch {
      return false;
    }
  }

  public updateSessionSettings(pin: string, settings: Partial<GameSettings>) {
    const session = this.getSession(pin);
    if (session) {
      session.settings = { ...session.settings, ...settings };
      this.cacheSessionLocally(session);
    }
    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'update_settings',
        settings,
      },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {});
  }

  // Add Bot Players for testing
  public addBotPlayers(pin: string, count = 8) {
    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'add_bots',
        botCount: count,
      },
    })
      .then((res) => {
        if (res.success && res.session) {
          this.cacheSessionLocally(res.session);
        }
      })
      .catch(() => {
        const session = this.getSession(pin);
        if (!session) return;
        const regions = db.getRegions();
        BOT_NAMES.slice(0, count).forEach((b, idx) => {
          const reg = regions[idx % regions.length] || DEFAULT_REGIONS[0];
          const botId = `bot-${idx + 1}-${Date.now()}`;
          session.participants[botId] = {
            id: botId,
            name: b.name,
            nickname: b.name,
            avatarEmoji: b.emoji,
            avatarBg: b.bg,
            rollNumber: `2026-${200 + idx + 1}`,
            regionId: reg?.id || 'reg-dhaka',
            regionName: reg?.nameEn || 'Dhaka Range',
            score: 0,
            streak: 0,
            rank: idx + 1,
            isBot: true,
            answers: {},
            connected: true,
            lastActive: Date.now(),
          };
        });
        this.saveSession(session);
      });
  }

  // Verified Async Join with Anti-Impersonation Seat Lock
  public async joinSessionVerified(params: JoinSessionParams): Promise<JoinSessionResult> {
    const existingSeatToken = this.getStoredSeatToken(params.pin);
    const existingParticipantId = this.getStoredParticipantId(params.pin);
    const participantId =
      existingParticipantId || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const participant: Participant = {
      id: participantId,
      candidateId: params.candidateId,
      name: params.nickname,
      nickname: params.nickname,
      avatarEmoji: params.avatarEmoji,
      avatarBg: params.avatarBg,
      rollNumber: params.rollNumber,
      phone: params.phone,
      regionId: params.regionId || 'reg-dhaka',
      regionName: params.regionName || 'Dhaka Range',
      score: 0,
      streak: 0,
      rank: 1,
      isBot: false,
      answers: {},
      connected: true,
      lastActive: Date.now(),
      proctorFlags: 0,
      isSuspended: false,
    };

    try {
      const res = await serverJoinSession({
        data: {
          pin: params.pin,
          participant,
          verificationNumber: params.verificationNumber || params.phone || params.rollNumber,
          seatToken: existingSeatToken,
        },
      });

      if (!res.success || !res.participant) {
        return {
          success: false,
          error: res.error || 'Could not join exam session.',
          code: (res as any).code,
        };
      }

      if (res.seatToken) {
        this.saveStoredSeatToken(params.pin, res.participant.id, res.seatToken);
      }
      if (res.session) {
        this.cacheSessionLocally(res.session);
      }

      this.startPolling(params.pin, 'player', res.participant.id);
      this.broadcast({ type: 'PLAYER_JOINED', pin: params.pin, participant: res.participant });

      return {
        success: true,
        reconnected: res.reconnected,
        participant: res.participant,
      };
    } catch (err) {
      // Fallback for offline local mode
      const fallback = this.joinSession(
        params.pin,
        params.nickname,
        params.avatarEmoji,
        params.avatarBg,
        params.rollNumber,
        params.regionId,
        params.regionName,
        params.phone
      );
      if (fallback) {
        return { success: true, participant: fallback };
      }
      return { success: false, error: 'Network error while joining examination session.' };
    }
  }

  // Synchronous fallback Join
  public joinSession(
    pin: string,
    nickname: string,
    avatarEmoji: string,
    avatarBg: string,
    rollNumber?: string,
    regionId = 'reg-dhaka',
    regionName = 'Dhaka Range',
    phone?: string
  ): Participant | null {
    const session = this.getSession(pin);
    if (!session) return null;

    const participantId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const participant: Participant = {
      id: participantId,
      name: nickname,
      nickname,
      avatarEmoji,
      avatarBg,
      rollNumber,
      phone,
      regionId,
      regionName,
      score: 0,
      streak: 0,
      rank: Object.keys(session.participants).length + 1,
      isBot: false,
      answers: {},
      connected: true,
      lastActive: Date.now(),
    };

    session.participants[participantId] = participant;
    this.cacheSessionLocally(session);
    this.broadcast({ type: 'PLAYER_JOINED', pin, participant });

    serverJoinSession({ data: { pin, participant } }).catch(() => {});
    return participant;
  }

  // Host starts game
  public startGame(pin: string) {
    const session = this.getSession(pin);
    if (session) {
      session.phase = 'countdown';
      this.cacheSessionLocally(session);
    }

    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'start_game',
      },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {});

    setTimeout(() => {
      this.nextQuestion(pin, 0);
    }, 3000);
  }

  // Host advances to question index
  public nextQuestion(pin: string, index: number) {
    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'next_question',
        questionIndex: index,
      },
    })
      .then((res) => {
        if (res.success && res.session) {
          this.cacheSessionLocally(res.session);
          if (res.session.phase === 'podium') {
            try {
              db.recordExamSession(res.session);
            } catch {}
          }
        }
      })
      .catch(() => {
        const session = this.getSession(pin);
        if (!session) return;
        const quiz =
          db.getQuizBySlug(session.quizId) ||
          db.getQuizzes().find((q) => q.id === session.quizId) ||
          READY_MADE_PACKS[0];
        const question = quiz?.questions[index];
        if (!quiz || !question || index >= quiz.questions.length) {
          this.endGame(pin);
          return;
        }
        session.phase = 'question';
        session.currentQuestionIndex = index;
        session.currentQuestion = question;
        session.questionStartTime = Date.now();
        session.questionEndTime = Date.now() + question.timeLimitSec * 1000;
        this.saveSession(session);
      });
  }

  // Submit Answer (Atomic Server Call with Offline Outbox Queue & Auto-Retry!)
  public submitAnswer(
    pin: string,
    participantId: string,
    questionId: string,
    selectedOptionIds: string[],
    writtenAnswer?: string
  ) {
    const seatToken = this.getStoredSeatToken(pin);
    const clientAnsweredAt = Date.now();
    const payload: QueuedAnswerPayload = {
      pin,
      participantId,
      questionId,
      selectedOptionIds,
      writtenAnswer,
      seatToken,
      clientAnsweredAt,
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.enqueueOfflineAnswer(payload);
      return;
    }

    serverSubmitAnswer({
      data: payload,
    })
      .then((res) => {
        if (res.success && res.session) {
          this.cacheSessionLocally(res.session);
          if (res.answer) {
            this.broadcast({
              type: 'ANSWER_SUBMITTED',
              pin,
              participantId,
              answer: res.answer,
            });
          }
        }
      })
      .catch((e) => {
        console.warn('Network drop during answer submit — queued in Offline Outbox for auto-sync:', e);
        this.enqueueOfflineAnswer(payload);
      });
  }

  public reportProctorIncident(
    pin: string,
    participantId: string,
    type: 'tab_switch' | 'window_blur' | 'fullscreen_exit' | 'copy_attempt' | 'devtools_attempt'
  ) {
    return serverReportProctorIncident({
      data: { pin, participantId, type },
    });
  }

  public kickPlayer(pin: string, participantId: string) {
    const session = this.getSession(pin);
    if (session && session.participants[participantId]) {
      delete session.participants[participantId];
      this.cacheSessionLocally(session);
    }
    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'kick_player',
        participantId,
      },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {});
  }

  public pardonPlayer(pin: string, participantId: string) {
    serverHostControl({
      data: {
        pin,
        hostToken: this.getStoredHostToken(pin),
        action: 'pardon_player',
        participantId,
      },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {});
  }

  private clearBotTimers() {
    this.botTimers.forEach((t) => clearTimeout(t));
    this.botTimers = [];
  }

  public showChart(pin: string) {
    this.clearBotTimers();
    serverHostControl({
      data: { pin, hostToken: this.getStoredHostToken(pin), action: 'show_chart' },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {
        const session = this.getSession(pin);
        if (!session) return;
        session.phase = 'chart';
        this.saveSession(session);
      });
  }

  public showLeaderboard(pin: string) {
    serverHostControl({
      data: { pin, hostToken: this.getStoredHostToken(pin), action: 'show_leaderboard' },
    })
      .then((res) => {
        if (res.success && res.session) this.cacheSessionLocally(res.session);
      })
      .catch(() => {
        const session = this.getSession(pin);
        if (!session) return;
        this.recalculateRanks(session);
        session.phase = 'leaderboard';
        this.saveSession(session);
      });
  }

  public endGame(pin: string) {
    this.clearBotTimers();
    serverHostControl({
      data: { pin, hostToken: this.getStoredHostToken(pin), action: 'end_game' },
    })
      .then((res) => {
        if (res.success && res.session) {
          this.cacheSessionLocally(res.session);
          this.stopPolling();
          try {
            db.recordExamSession(res.session);
            db.syncFromServerStore();
          } catch {}
        }
      })
      .catch(() => {
        const session = this.getSession(pin);
        if (!session) return;
        this.recalculateRanks(session);
        session.phase = 'podium';
        this.saveSession(session);
        this.stopPolling();
        try {
          db.recordExamSession(session);
        } catch {}
      });
  }

  private recalculateRanks(session: GameSession) {
    const sorted = Object.values(session.participants).sort((a, b) => b.score - a.score);
    sorted.forEach((p, idx) => {
      const target = session.participants[p.id];
      if (target) target.rank = idx + 1;
    });
  }
}

export const gameEngine = new RealtimeGameEngine();
