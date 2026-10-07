import { Directive, ElementRef, forwardRef, inject, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type InputMask = 'phone' | 'document' | 'plate' | '';

function applyPattern(value: string, pattern: string): string {
  let result = '';
  let index = 0;
  for (const character of pattern) {
    if (index >= value.length) break;
    result += character === '#' ? value[index++] : character;
  }
  return result;
}

export function maskInput(value: string, mask: InputMask): string {
  if (mask === 'plate')
    return value
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 7);
  if (!mask) return value;
  const digits = value.replace(/\D/g, '').slice(0, mask === 'phone' ? 11 : 14);
  if (mask === 'phone')
    return applyPattern(digits, digits.length > 10 ? '(##) #####-####' : '(##) ####-####');
  return applyPattern(digits, digits.length > 11 ? '##.###.###/####-##' : '###.###.###-##');
}

@Directive({
  selector: 'input[type="tel"], input[appInputMask]',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => InputMaskDirective), multi: true },
  ],
  host: {
    '(input)': 'onInput()',
    '(blur)': 'onBlur()',
    '[attr.inputmode]': 'mask() === "phone" || mask() === "document" ? "numeric" : null',
    '[attr.placeholder]': 'placeholder()',
  },
})
export class InputMaskDirective implements ControlValueAccessor {
  readonly appInputMask = input<InputMask>('');
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private onChange: (value: string | number | null) => void = () => {};
  onTouched: () => void = () => {};

  mask(): InputMask {
    return this.appInputMask() || (this.element.nativeElement.type === 'tel' ? 'phone' : '');
  }
  placeholder(): string | null {
    switch (this.mask()) {
      case 'phone':
        return '(00) 00000-0000';
      case 'document':
        return this.element.nativeElement.value.replace(/\D/g, '').length > 11
          ? '00.000.000/0000-00'
          : '000.000.000-00';
      case 'plate':
        return 'ABC1D23';
      default:
        return this.element.nativeElement.type === 'email' ? '@teste.com' : null;
    }
  }
  writeValue(value: unknown): void {
    this.element.nativeElement.value = maskInput(String(value ?? ''), this.mask());
  }
  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.element.nativeElement.disabled = disabled;
  }

  onBlur(): void {
    const element = this.element.nativeElement;
    if (element.type === 'email' && element.value !== element.value.trim()) {
      element.value = element.value.trim();
      this.onChange(element.value);
    }
    this.onTouched();
  }

  onInput(): void {
    const element = this.element.nativeElement;
    const original = element.value;
    const cursor = element.selectionStart;
    const mask = this.mask();
    const significant = (text: string) =>
      mask === 'plate' ? text.replace(/[^a-z0-9]/gi, '').length : text.replace(/\D/g, '').length;
    const count = cursor === null ? null : significant(original.slice(0, cursor));
    element.value = maskInput(original, mask);
    if (mask && count !== null) {
      let position = 0;
      while (
        position < element.value.length &&
        significant(element.value.slice(0, position)) < count
      )
        position++;
      element.setSelectionRange(position, position);
    }
    this.onChange(
      element.type === 'number'
        ? element.value === ''
          ? null
          : parseFloat(element.value)
        : element.value,
    );
  }
}

@Directive({
  selector: 'input[type="email"]',
  host: {
    '(blur)': 'onBlur()',
    placeholder: '@teste.com',
    inputmode: 'email',
    autocapitalize: 'none',
    autocorrect: 'off',
    spellcheck: 'false',
  },
})
export class EmailInputDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  onBlur(): void {
    const element = this.element.nativeElement;
    if (element.value !== element.value.trim()) {
      element.value = element.value.trim();
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}
