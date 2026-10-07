import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EmailInputDirective, InputMaskDirective, maskInput } from './input-mask';

@Component({
  imports: [ReactiveFormsModule, InputMaskDirective, EmailInputDirective],
  template: `<input type="tel" [formControl]="phone" />
    <input appInputMask="document" [formControl]="document" />
    <input type="email" [formControl]="email" />`,
})
class TestForm {
  phone = new FormControl('11987654321');
  document = new FormControl('52998224725');
  email = new FormControl('');
}

describe('Máscaras de formulário', () => {
  it('formata celular, telefone fixo, documentos e placas colados', () => {
    expect(maskInput('11 98765-4321', 'phone')).toBe('(11) 98765-4321');
    expect(maskInput('1134567890', 'phone')).toBe('(11) 3456-7890');
    expect(maskInput('52998224725', 'document')).toBe('529.982.247-25');
    expect(maskInput('11222333000181', 'document')).toBe('11.222.333/0001-81');
    expect(maskInput('abc-1234', 'plate')).toBe('ABC1234');
    expect(maskInput('abc1d23', 'plate')).toBe('ABC1D23');
    expect(maskInput('', 'phone')).toBe('');
  });

  it('exibe placeholders e preserva o endereço de e-mail ao remover espaços externos', async () => {
    TestBed.configureTestingModule({ imports: [TestForm] });
    const fixture = TestBed.createComponent(TestForm);
    await fixture.whenStable();
    const fields: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input');
    expect(fields[0].placeholder).toBe('(00) 00000-0000');
    expect(fields[1].placeholder).toBe('000.000.000-00');
    expect(fields[1].value).toBe('529.982.247-25');
    expect(fields[2].placeholder).toBe('@teste.com');
    fields[2].value = '  Nome+tag@exemplo.com  ';
    fields[2].dispatchEvent(new Event('input'));
    fields[2].dispatchEvent(new Event('blur'));
    expect(fixture.componentInstance.email.value).toBe('Nome+tag@exemplo.com');
  });

  it('formata dados carregados e sincroniza digitação, exclusão e reset com o formulário', async () => {
    TestBed.configureTestingModule({ imports: [TestForm] });
    const fixture = TestBed.createComponent(TestForm);
    await fixture.whenStable();
    const element: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(element.value).toBe('(11) 98765-4321');
    element.value = '21999998888';
    element.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.phone.value).toBe('(21) 99999-8888');
    element.value = '(21) 99999-888';
    element.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.phone.value).toBe('(21) 9999-9888');
    fixture.componentInstance.phone.reset();
    expect(element.value).toBe('');
    fixture.componentInstance.phone.disable();
    expect(element.disabled).toBe(true);
  });
});
