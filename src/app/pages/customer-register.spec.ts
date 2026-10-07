import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '../core/auth';
import { CustomerRegister } from './customer-register';

describe('Formulário de criação de conta', () => {
  it('exibe placeholders, aplica a máscara e bloqueia letras no telefone', async () => {
    TestBed.configureTestingModule({
      imports: [CustomerRegister],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { initialized: signal(true), client: {} } },
      ],
    });
    const fixture = TestBed.createComponent(CustomerRegister);
    await fixture.whenStable();
    const phone: HTMLInputElement = fixture.nativeElement.querySelector(
      '[formControlName="phone"]',
    );
    const email: HTMLInputElement = fixture.nativeElement.querySelector(
      '[formControlName="email"]',
    );
    expect(phone.placeholder).toBe('(00) 00000-0000');
    expect(email.placeholder).toBe('@teste.com');
    const letter = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
    phone.dispatchEvent(letter);
    expect(letter.defaultPrevented).toBe(true);
    phone.value = '11987654321';
    phone.dispatchEvent(new Event('input'));
    expect(phone.value).toBe('(11) 98765-4321');
    expect(fixture.componentInstance.form.controls.phone.value).toBe('(11) 98765-4321');
    fixture.componentInstance.form.controls.phone.setValue('21999998888');
    expect(phone.value).toBe('(21) 99999-8888');
  });
});
