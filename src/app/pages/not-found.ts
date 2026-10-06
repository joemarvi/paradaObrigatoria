import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<main class="not-found">
    <span class="eyebrow">404</span>
    <h1>Essa parada não existe.</h1>
    <p>A página pode ter mudado de endereço.</p>
    <a class="button primary" routerLink="/">Voltar ao início</a>
  </main>`,
})
export class NotFound {}
