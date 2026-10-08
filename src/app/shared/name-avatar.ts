import { Component, computed, input } from '@angular/core';

type AvatarStyle = 'masculine' | 'feminine' | 'neutral';
// Local, conservative suggestions only. Never used as profile or identity data.
const masculineNames = new Set(
  `adriano alberto alexandre andre antonio arthur augusto benicio bernardo bruno caio carlos cesar cristiano daniel danilo davi david diego diogo douglas eduardo emanuel enzo fabio felipe fernando francisco gabriel geraldo gilberto gustavo heitor henrique hugo igor isaac joao joel joelson jonas jorge jose julio kaique leonardo leandro levi lucas luciano luis luiz marcelo marcio marcos mateus matheus miguel murilo nicolas otavio paulo pedro rafael raimundo renato ricardo roberto rodrigo samuel sergio thiago tiago victor vitor vinicius walter wesley william`.split(
    ' ',
  ),
);
const feminineNames = new Set(
  `adriana aline amanda ana andrea antonia beatriz bianca bruna camila carla carolina catarina cecilia clara claudia cristina daniela debora denise eduarda eliane elisa elisabete emilia ester fabiana fatima fernanda flavia francisca gabriela giovanna helena heloisa isabel isabela isabella joana julia juliana lais larissa laura leticia lilia lilian livia lorena luana lucia luciana luiza lurdes luzia madalena manuella manuela marcia maria mariana marina marta melissa monica natalia nicole patricia paula rafaela raquel regina renata rita rosa rosana rosangela sandra sara silvia simone sofia sonia sueli tatiana teresa valentina vanessa vera vitoria viviane`.split(
    ' ',
  ),
);

export function avatarStyleForName(name: string): AvatarStyle {
  const firstName = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[\s-]+/)[0];
  if (masculineNames.has(firstName)) return 'masculine';
  if (feminineNames.has(firstName)) return 'feminine';
  return 'neutral';
}

@Component({
  selector: 'app-name-avatar',
  template: `<svg
    viewBox="0 0 48 48"
    width="32"
    height="32"
    fill="none"
    aria-hidden="true"
    [attr.data-avatar-style]="style()"
  >
    @switch (style()) {
      @case ('masculine') {
        <path d="M14 20v-5a10 10 0 0 1 20 0v5l-5-8-15 4Z" fill="currentColor" />
        <path
          d="M16 17v6a8 8 0 0 0 16 0v-6l-5-5-11 5Z"
          fill="var(--surface, #fff)"
          stroke="currentColor"
          stroke-width="2"
        />
        <path d="M9 43v-4c0-6 6-10 15-10s15 4 15 10v4" fill="currentColor" />
        <path
          d="m19 30 5 6 5-6"
          stroke="var(--surface, #fff)"
          stroke-width="2"
          stroke-linejoin="round"
        />
      }
      @case ('feminine') {
        <path d="M12 32V17a12 12 0 0 1 24 0v15Z" fill="currentColor" />
        <path
          d="M16 17v6a8 8 0 0 0 16 0v-6c-4 0-6-3-8-6-2 3-4 6-8 6Z"
          fill="var(--surface, #fff)"
          stroke="currentColor"
          stroke-width="2"
        />
        <path d="M9 43v-4c0-6 6-10 15-10s15 4 15 10v4" fill="currentColor" />
        <path
          d="M19 31a5 5 0 0 0 10 0"
          stroke="var(--surface, #fff)"
          stroke-width="2"
          stroke-linecap="round"
        />
      }
      @default {
        <circle cx="24" cy="16" r="9" stroke="currentColor" stroke-width="3" />
        <path
          d="M9 42v-3c0-6 6-10 15-10s15 4 15 10v3"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      }
    }
  </svg>`,
})
export class NameAvatar {
  readonly name = input('');
  readonly style = computed(() => avatarStyleForName(this.name()));
}
