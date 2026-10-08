import { TestBed } from '@angular/core/testing';
import { SESSION_IDLE_MS, SessionActivity } from './session-activity';

describe('Expiração por inatividade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    localStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    localStorage.clear();
  });
  it('expira após oito minutos sem interação', () => {
    const activity = TestBed.inject(SessionActivity);
    const expire = vi.fn();
    activity.start('project', 'user', expire);
    vi.advanceTimersByTime(SESSION_IDLE_MS - 1);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledOnce();
  });
  it('interação renova o prazo mas monitoramento de sessão não renova', () => {
    const activity = TestBed.inject(SessionActivity);
    const expire = vi.fn();
    activity.start('project', 'user', expire);
    vi.advanceTimersByTime(4 * 60000);
    activity.touch();
    vi.advanceTimersByTime(4 * 60000);
    activity.start('project', 'user', expire);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4 * 60000);
    expect(expire).toHaveBeenCalledOnce();
  });
  it('reabrir sessão antiga não reinicia a contagem; login novo reinicia', () => {
    const activity = TestBed.inject(SessionActivity);
    const expire = vi.fn();
    activity.start('project', 'user', expire);
    activity.stop();
    vi.advanceTimersByTime(SESSION_IDLE_MS);
    expect(activity.start('project', 'user', expire)).toBe(false);
    expect(expire).toHaveBeenCalledOnce();
    expect(activity.start('project', 'user', expire, true)).toBe(true);
    vi.advanceTimersByTime(SESSION_IDLE_MS - 1);
    expect(expire).toHaveBeenCalledOnce();
  });
  it('considera atividade compartilhada por outra aba e verifica prazo ao retomar', () => {
    const activity = TestBed.inject(SessionActivity);
    const expire = vi.fn();
    activity.start('project', 'user', expire);
    vi.advanceTimersByTime(4 * 60000);
    localStorage.setItem('session-activity:project:user', String(Date.now()));
    vi.advanceTimersByTime(4 * 60000);
    expect(expire).not.toHaveBeenCalled();
    vi.setSystemTime(Date.now() + 4 * 60000);
    window.dispatchEvent(new Event('focus'));
    expect(expire).toHaveBeenCalledOnce();
  });
});
