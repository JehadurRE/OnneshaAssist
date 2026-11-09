export interface ProctorIncident {
  id: string;
  type: 'tab_switch' | 'window_blur' | 'fullscreen_exit';
  timestamp: string;
  durationSec?: number;
  candidateId: string;
  candidateName: string;
}

type ProctorCallback = (incident: ProctorIncident) => void;

class ProctorEngine {
  private active = false;
  private candidateId = '';
  private candidateName = '';
  private callback: ProctorCallback | null = null;
  private blurStartTime: number | null = null;

  start(candidateId: string, candidateName: string, onIncident: ProctorCallback) {
    if (typeof window === 'undefined') return;
    this.active = true;
    this.candidateId = candidateId;
    this.candidateName = candidateName;
    this.callback = onIncident;

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
  }

  stop() {
    if (typeof window === 'undefined') return;
    this.active = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
  }

  private handleVisibilityChange = () => {
    if (!this.active) return;
    if (document.hidden) {
      this.blurStartTime = Date.now();
      this.triggerIncident('tab_switch');
    } else if (this.blurStartTime) {
      const durationSec = Math.round((Date.now() - this.blurStartTime) / 1000);
      this.blurStartTime = null;
      console.log(`Candidate ${this.candidateName} returned after ${durationSec}s away`);
    }
  };

  private handleWindowBlur = () => {
    if (!this.active) return;
    this.triggerIncident('window_blur');
  };

  private handleWindowFocus = () => {
    // Focus recovered
  };

  private triggerIncident(type: 'tab_switch' | 'window_blur' | 'fullscreen_exit') {
    if (!this.callback) return;
    const incident: ProctorIncident = {
      id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      timestamp: new Date().toISOString(),
      candidateId: this.candidateId,
      candidateName: this.candidateName,
    };
    this.callback(incident);
  }
}

export const proctorEngine = new ProctorEngine();
