import { Directive, ElementRef, inject } from '@angular/core';
import { InputMaskDirective } from './input-mask';

@Directive({
  selector: 'input[type="number"], input[type="tel"], input[appInputMask]',
  host: {
    '(keydown)': 'onKeydown($event)',
    '(beforeinput)': 'onBeforeInput($event)',
    '(paste)': 'onPaste($event)',
    '[attr.inputmode]': 'inputMode()',
  },
})
export class NumericInputDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);

  private readonly mask = inject(InputMaskDirective, { optional: true, self: true });

  private numeric(): boolean {
    const element = this.element.nativeElement;
    return (
      element.type === 'number' ||
      element.type === 'tel' ||
      ['phone', 'document'].includes(this.mask?.mask() ?? '')
    );
  }
  inputMode(): string | null {
    const element = this.element.nativeElement;
    if (element.type === 'number')
      return element.step === '1' || !element.step ? 'numeric' : 'decimal';
    return this.numeric() ? 'numeric' : element.type === 'email' ? 'email' : null;
  }
  private allowed(value: string): boolean {
    const element = this.element.nativeElement;
    return element.type === 'number' && element.step && element.step !== '1'
      ? /^[0-9.]+$/.test(value)
      : /^\d+$/.test(value);
  }
  onKeydown(event: KeyboardEvent): void {
    if (!this.numeric() || event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
      return;
    if (event.key.length === 1 && !this.allowed(event.key)) event.preventDefault();
  }
  onBeforeInput(event: InputEvent): void {
    if (
      this.numeric() &&
      event.inputType === 'insertText' &&
      event.data &&
      !this.allowed(event.data)
    ) {
      // Let the mask clean mixed text inserted by autofill or a paste operation.
      if (this.element.nativeElement.type !== 'number' && /\d/.test(event.data)) return;
      event.preventDefault();
    }
  }
  onPaste(event: ClipboardEvent): void {
    const element = this.element.nativeElement;
    if (element.type !== 'number' || !event.clipboardData) return;
    const value = event.clipboardData.getData('text').trim().replace(',', '.');
    const decimal = element.step && element.step !== '1';
    if (!(decimal ? /^\d+(?:\.\d+)?$/ : /^\d+$/).test(value)) {
      event.preventDefault();
      return;
    }
    if (event.clipboardData.getData('text') !== value) {
      event.preventDefault();
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}
