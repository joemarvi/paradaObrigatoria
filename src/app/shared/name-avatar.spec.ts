import { TestBed } from '@angular/core/testing';
import { avatarStyleForName, NameAvatar } from './name-avatar';

describe('Avatar por nome', () => {
  it('normaliza acentos e espaços e considera somente o primeiro nome', () => {
    expect(avatarStyleForName('  JOÃO Maria  ')).toBe('masculine');
    expect(avatarStyleForName('María João')).toBe('feminine');
    expect(avatarStyleForName('Joelson Correia')).toBe('masculine');
    expect(avatarStyleForName('Alex Silva')).toBe('neutral');
    expect(avatarStyleForName('')).toBe('neutral');
  });
  it('atualiza a ilustração quando os dados do cliente são carregados', async () => {
    const fixture = TestBed.createComponent(NameAvatar);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('data-avatar-style')).toBe(
      'neutral',
    );
    fixture.componentRef.setInput('name', 'Maria Silva');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('data-avatar-style')).toBe(
      'feminine',
    );
    fixture.componentRef.setInput('name', 'Joelson Correia');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('svg').getAttribute('data-avatar-style')).toBe(
      'masculine',
    );
  });
});
