import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Feedback } from './feedback';

@Component({
  imports: [Feedback],
  template: `<app-feedback message="Primeiro aviso" /><app-feedback message="Segundo aviso" />`,
})
class MultipleMessages {}

describe('Fila de avisos', () => {
  it('mostra um aviso por vez e preserva os pendentes', async () => {
    TestBed.configureTestingModule({ imports: [MultipleMessages] });
    const fixture = TestBed.createComponent(MultipleMessages);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role=dialog]').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Segundo aviso');
    (fixture.nativeElement.querySelector('.feedback-actions button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role=dialog]').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Primeiro aviso');
    (fixture.nativeElement.querySelector('.feedback-actions button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
