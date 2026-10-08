import { DestroyRef, Injectable, inject } from '@angular/core';

export const SESSION_IDLE_MS = 8 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SessionActivity {
  private key = '';
  private lastActivity = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private expire: (() => void) | undefined;

  constructor() {
    const activity = (event: Event) => {
      if (event.isTrusted && document.visibilityState !== 'hidden') this.touch();
    };
    const resume = () => this.check();
    const storage = (event: StorageEvent) => {
      if (event.key === this.key) this.check();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
    for (const event of events)
      document.addEventListener(event, activity, { passive: true, capture: true });
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('storage', storage);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      for (const event of events) document.removeEventListener(event, activity, true);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('storage', storage);
    });
  }

  start(scope: string, userId: string, expire: () => void, fresh = false): boolean {
    const key = `session-activity:${scope}:${userId}`;
    if (this.key !== key || fresh) {
      this.stop();
      this.key = key;
      this.lastActivity = fresh ? Date.now() : this.read() || Date.now();
      this.write();
    }
    this.expire = expire;
    return this.check();
  }

  touch() {
    if (!this.key || !this.check()) return;
    // Persist genuine interaction, not background requests or token refreshes.
    if (Date.now() - this.lastActivity < 1000) return;
    this.lastActivity = Date.now();
    this.write();
    this.schedule();
  }

  check(): boolean {
    if (!this.key) return true;
    this.lastActivity = Math.max(this.lastActivity, this.read());
    if (Date.now() - this.lastActivity >= SESSION_IDLE_MS) {
      const expire = this.expire;
      this.stop();
      expire?.();
      return false;
    }
    this.schedule();
    return true;
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.key = '';
    this.expire = undefined;
  }

  private read(): number {
    try {
      const value = Number(localStorage.getItem(this.key));
      return Number.isFinite(value) && value > 0 && value <= Date.now() ? value : 0;
    } catch {
      return 0;
    }
  }
  private write() {
    try {
      localStorage.setItem(this.key, String(this.lastActivity));
    } catch {
      /* In-memory timer remains active. */
    }
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.check(),
      Math.max(1, SESSION_IDLE_MS - (Date.now() - this.lastActivity)),
    );
  }
}
