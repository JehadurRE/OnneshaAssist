export type ProctorIncidentType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_attempt'
  | 'devtools_attempt';

export interface ProctorIncident {
  id: string;
  type: ProctorIncidentType;
  timestamp: string;
  durationSec?: number;
  candidateId: string;
  candidateName: string;
}

export interface ProctorOptions {
  enforceFullscreen?: boolean;
  blockCopyPaste?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

type ProctorCallback = (incident: ProctorIncident) => void;

class ProctorEngine {
  private active = false;
  private candidateId = '';
  private candidateName = '';
  private callback: ProctorCallback | null = null;
  private options: ProctorOptions = {
    enforceFullscreen: false,
    blockCopyPaste: true,
  };
  private blurStartTime: number | null = null;
  private lastIncidentAt = 0;
  private wakeLockSentinel: any = null;

  start(
    candidateId: string,
    candidateName: string,
    onIncident: ProctorCallback,
    options?: ProctorOptions
  ) {
    if (typeof window === 'undefined') return;
    this.stop();

    this.active = true;
    this.candidateId = candidateId;
    this.candidateName = candidateName;
    this.callback = onIncident;
    this.options = {
      enforceFullscreen: options?.enforceFullscreen ?? false,
      blockCopyPaste: options?.blockCopyPaste ?? true,
      onFullscreenChange: options?.onFullscreenChange,
    };

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);

    if (this.options.blockCopyPaste) {
      document.addEventListener('copy', this.handleClipboardBlock);
      document.addEventListener('cut', this.handleClipboardBlock);
      document.addEventListener('paste', this.handleClipboardBlock);
      document.addEventListener('contextmenu', this.handleContextMenuBlock);
      window.addEventListener('keydown', this.handleKeyDownGuard, true);
    }

    this.acquireWakeLock();
  }

  stop() {
    if (typeof window === 'undefined') return;
    this.active = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('copy', this.handleClipboardBlock);
    document.removeEventListener('cut', this.handleClipboardBlock);
    document.removeEventListener('paste', this.handleClipboardBlock);
    document.removeEventListener('contextmenu', this.handleContextMenuBlock);
    window.removeEventListener('keydown', this.handleKeyDownGuard, true);
    this.releaseWakeLock();
  }

  public isFullscreenSupported(): boolean {
    if (typeof document === 'undefined') return false;
    return !!(
      document.fullscreenEnabled &&
      typeof document.documentElement?.requestFullscreen === 'function'
    );
  }

  public isInFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    return !!document.fullscreenElement;
  }

  public async requestExamFullscreen(): Promise<boolean> {
    if (typeof document === 'undefined') return false;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      return !!document.fullscreenElement;
    } catch {
      return false;
    }
  }

  public async exitExamFullscreen(): Promise<void> {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  }

  private async acquireWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    try {
      this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    } catch {
      // wakeLock not supported or declined
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  private handleVisibilityChange = () => {
    if (!this.active) return;
    if (document.hidden) {
      this.blurStartTime = Date.now();
      this.triggerIncident('tab_switch');
    } else if (this.blurStartTime) {
      this.blurStartTime = null;
      this.acquireWakeLock();
    }
  };

  private handleWindowBlur = () => {
    if (!this.active) return;
    // Note: if document.hidden is already true, visibilitychange handles it;
    // the 1800ms debounce in triggerIncident also guarantees single-counting.
    this.triggerIncident('window_blur');
  };

  private handleWindowFocus = () => {
    this.acquireWakeLock();
  };

  private handleFullscreenChange = () => {
    const isFull = !!document.fullscreenElement;
    if (this.options.onFullscreenChange) {
      this.options.onFullscreenChange(isFull);
    }
    if (this.active && this.options.enforceFullscreen && !isFull) {
      this.triggerIncident('fullscreen_exit');
    }
  };

  private handleClipboardBlock = (e: ClipboardEvent) => {
    if (!this.active || !this.options.blockCopyPaste) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      // Block pasting external answers into written input fields
      if (e.type === 'paste') {
        e.preventDefault();
        this.triggerIncident('copy_attempt');
      }
      return;
    }
    e.preventDefault();
    this.triggerIncident('copy_attempt');
  };

  private handleContextMenuBlock = (e: MouseEvent) => {
    if (!this.active || !this.options.blockCopyPaste) return;
    e.preventDefault();
  };

  private handleKeyDownGuard = (e: KeyboardEvent) => {
    if (!this.active || !this.options.blockCopyPaste) return;
    const key = e.key.toLowerCase();

    // Block F12, Ctrl+Shift+I/J/C, Ctrl+U (DevTools / View Source)
    if (
      e.key === 'F12' ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)) ||
      ((e.ctrlKey || e.metaKey) && key === 'u')
    ) {
      e.preventDefault();
      e.stopPropagation();
      this.triggerIncident('devtools_attempt');
      return;
    }

    // Block PrintScreen or Ctrl+P / Ctrl+C
    if (
      e.key === 'PrintScreen' ||
      ((e.ctrlKey || e.metaKey) && ['p', 'c', 'x'].includes(key))
    ) {
      e.preventDefault();
      this.triggerIncident('copy_attempt');
    }
  };

  private triggerIncident(type: ProctorIncidentType) {
    if (!this.callback) return;
    const now = Date.now();
    // 1800ms debounce so a single tab switch firing both visibilitychange and blur only counts as 1 strike!
    if (now - this.lastIncidentAt < 1800) {
      return;
    }
    this.lastIncidentAt = now;

    const incident: ProctorIncident = {
      id: `proc-${now}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      timestamp: new Date().toISOString(),
      candidateId: this.candidateId,
      candidateName: this.candidateName,
    };
    this.callback(incident);
  }
}

export const proctorEngine = new ProctorEngine();
