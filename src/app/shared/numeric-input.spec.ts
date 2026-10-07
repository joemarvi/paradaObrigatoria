import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputMaskDirective } from './input-mask';
import { NumericInputDirective } from './numeric-input';

@Component({
  imports: [ReactiveFormsModule, InputMaskDirective, NumericInputDirective],
  template: `<input type="number" step="1" [formControl]="quantity" />
    <input type="number" step="0.01" [formControl]="amount" />
    <input [appInputMask]="'document'" [formControl]="document" />
    <input type="tel" [formControl]="phone" />`,
})
class TestForm {
  quantity = new FormControl(1);
  amount = new FormControl(10);
  document = new FormControl('');
  phone = new FormControl('');
}

describe('Campos numéricos', () => {
  it('bloqueia letras e notação científica, preservando números e atalhos', async () => {
    TestBed.configureTestingModule({ imports: [TestForm] });
    const fixture = TestBed.createComponent(TestForm);
    await fixture.whenStable();
    const fields: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input');
    for (const field of fields) {
      for (const key of ['a', 'e', 'E', '+', '-']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        field.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
      }
      for (const key of ['1', 'Backspace', 'Tab', 'ArrowLeft']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        field.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      const selectAll = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, cancelable: true });
      field.dispatchEvent(selectAll);
      expect(selectAll.defaultPrevented).toBe(false);
    }
    const decimal = new KeyboardEvent('keydown', { key: '.', cancelable: true });
    fields[1].dispatchEvent(decimal);
    expect(decimal.defaultPrevented).toBe(false);
  });

  it('rejeita letras coladas em valores e aceita decimais com vírgula', async () => {
    TestBed.configureTestingModule({ imports: [TestForm] });
    const fixture = TestBed.createComponent(TestForm);
    await fixture.whenStable();
    const field: HTMLInputElement = fixture.nativeElement.querySelectorAll('input')[1];
    function paste(value: string) {
      const event = new Event('paste', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { getData: () => value } });
      field.dispatchEvent(event);
      return event;
    }
    expect(paste('1e3').defaultPrevented).toBe(true);
    expect(fixture.componentInstance.amount.value).toBe(10);
    paste('12,50');
    expect(field.value).toBe('12.50');
    expect(fixture.componentInstance.amount.value).toBe(12.5);
  });
});
