import { Component } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '../shared/ui';
@Component({
  selector: 'app-home',
  imports: [RouterLink, CurrencyPipe, Icon],
  template: `<main class="public-home">
    <header class="home-nav home-container">
      <a routerLink="/" class="home-brand" aria-label="Parada Obrigatória — início"
        ><img src="brand-logo.png" width="64" height="64" alt="Lava Jato Parada Obrigatória" /><span
          >LAVA JATO<strong>PARADA OBRIGATÓRIA</strong></span
        ></a
      >
      <nav aria-label="Navegação do site">
        <a href="#servicos">Serviços e preços</a><a href="#contato">Onde estamos</a>
        <a routerLink="/cliente/cadastro">Criar conta</a>
        <div class="home-nav-access">
          <a routerLink="/cliente/entrar" class="home-login-button"
            >Entrar <app-icon name="arrow" /></a
          ><a routerLink="/cliente" class="home-button">Agendar</a>
        </div>
      </nav>
    </header>
    <section class="home-hero home-container">
      <div class="home-hero-copy">
        <span class="home-eyebrow">SEU CARRO MERECE ESSA PARADA</span>
        <h1>Limpo.<br /><em>Brilhando.</em><br />Bem Cuidado.</h1>
        <p>
          Da lavagem completa ao cuidado com rodas e pneus, dê ao seu veículo a atenção que ele
          merece.
        </p>
        <div class="home-actions">
          <a routerLink="/cliente" class="home-button"
            >Agendar meu atendimento <app-icon name="arrow" /></a
          ><a
            href="https://wa.me/5561991379913"
            target="_blank"
            rel="noopener noreferrer"
            class="home-button home-button-outline"
            >Falar no WhatsApp</a
          >
        </div>
        <p class="home-caption">Crie sua conta ou entre para realizar um agendamento.</p>
      </div>
      <div class="home-hero-art">
        <div class="home-logo-ring">
          <img
            src="brand-logo.png"
            width="480"
            height="480"
            alt="Parada Obrigatória — cuidado em cada detalhe"
            fetchpriority="high"
          />
        </div>
        <div class="home-art-caption">
          <app-icon name="shield" /><span>QUALIDADE EM CADA DETALHE</span>
        </div>
      </div>
    </section>
    <section class="home-care-gallery home-container" aria-labelledby="home-care-title">
      <div class="home-section-heading">
        <div>
          <span class="home-eyebrow">CUIDADO EM CADA DETALHE</span>
          <h2 id="home-care-title">Mais Cuidado.<br />Mais Brilho.</h2>
        </div>
        <p>
          Conheça os cuidados que fazem parte da nossa parada. Do interior à pintura, atenção aos
          detalhes do seu veículo.
        </p>
      </div>
      <div class="home-care-grid">
        @for (care of careServices; track care.image) {
          <article class="home-care-card">
            <div class="home-care-photo">
              <img
                [src]="care.image"
                [alt]="care.alt"
                width="1536"
                height="1024"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div class="home-care-copy">
              <h3>{{ care.name }}</h3>
              <p>{{ care.description }}</p>
              <a href="https://wa.me/5561991379913" target="_blank" rel="noopener noreferrer"
                >Consultar Serviço <app-icon name="arrow"
              /></a>
            </div>
          </article>
        }
      </div>
    </section>
    <section id="servicos" class="home-services home-container">
      <div class="home-section-heading">
        <div>
          <span class="home-eyebrow">ESCOLHA O CUIDADO IDEAL</span>
          <h2>Uma Parada para<br />Cada Veículo.</h2>
        </div>
        <p>
          Confira os serviços e os valores iniciais da nossa tabela. Escolha seu próximo cuidado e
          agende com a gente.
        </p>
      </div>
      <div class="home-service-grid">
        @for (service of services; track service.name) {
          <article class="home-service-card">
            <span class="home-service-icon"><app-icon name="car" /></span
            ><span class="home-service-kind">{{ service.kind }}</span>
            <h3>{{ service.name }}</h3>
            <p>{{ service.description }}</p>
            <div class="home-price">
              <small>A PARTIR DE</small><strong>{{ service.price | currency: 'BRL' }}</strong>
            </div>
            <a routerLink="/cliente">Agendar serviço <app-icon name="arrow" /></a>
          </article>
        }
      </div>
      <p class="home-price-note">
        Valores a partir dos preços indicados. Consulte a equipe sobre as condições para seu veículo
        e os serviços de polimento e cera.
      </p>
    </section>
    <section class="home-how home-container">
      <div>
        <span class="home-eyebrow">FÁCIL DE AGENDAR</span>
        <h2>Seu Próximo Cuidado<br />Começa Aqui.</h2>
      </div>
      <ol>
        <li>
          <span>01</span>
          <div>
            <h3>Crie sua Conta</h3>
            <p>Cadastre seus dados e entre na área do cliente.</p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <h3>Escolha o Atendimento</h3>
            <p>Adicione seu veículo e selecione serviço, data e horário.</p>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <h3>Acompanhe sua Reserva</h3>
            <p>Consulte seus agendamentos na sua área exclusiva.</p>
          </div>
        </li>
      </ol>
    </section>
    <section id="contato" class="home-contact home-container">
      <div>
        <span class="home-eyebrow">VENHA FAZER SUA PARADA</span>
        <h2>Estamos no<br /><em>Mestre D’Armas.</em></h2>
        <p>Condomínio Mestre D’Armas<br />Em frente ao Posto Tiquira.</p>
        <a
          href="https://www.google.com/maps/search/?api=1&query=Posto+Tiquira+Mestre+D%27Armas"
          target="_blank"
          rel="noopener noreferrer"
          class="home-button home-button-outline"
          >Ver região no mapa <app-icon name="arrow"
        /></a>
      </div>
      <div class="home-contact-card">
        <h3>Fale com a Nossa Equipe</h3>
        <p>Tire suas dúvidas e consulte os cuidados para seu veículo.</p>
        <a href="https://wa.me/5561991379913" target="_blank" rel="noopener noreferrer"
          >(61) 99137-9913 <app-icon name="arrow" /></a
        ><a href="https://wa.me/5561991705891" target="_blank" rel="noopener noreferrer"
          >(61) 99170-5891 <app-icon name="arrow" /></a
        ><a routerLink="/cliente/cadastro" class="home-button">Criar minha conta</a>
      </div>
    </section>
    <footer class="home-footer home-container">
      <span>Parada Obrigatória · Lava Jato</span>
      <div>
        <a routerLink="/cliente">Área do cliente</a>
      </div>
    </footer>
  </main>`,
})
export class Home {
  readonly careServices = [
    {
      name: 'Lavagem Completa',
      image: 'services/lavagem-completa.png',
      alt: 'Lavagem de carro com espuma e jato de água',
      description: 'Cuidado com a limpeza do seu veículo, do primeiro enxágue ao acabamento.',
    },
    {
      name: 'Aspiração Interna',
      image: 'services/aspiracao-interna.png',
      alt: 'Aspiração dos bancos e tapetes no interior de um carro',
      description: 'Atenção ao interior, com limpeza de bancos, tapetes e cantos.',
    },
    {
      name: 'Polimento e Cera',
      image: 'services/polimento-cera.png',
      alt: 'Polimento da pintura de um carro com máquina orbital',
      description: 'Um cuidado especial para valorizar o brilho e o acabamento da pintura.',
    },
    {
      name: 'Limpeza de Rodas e Pneus',
      image: 'services/rodas-pneus.png',
      alt: 'Limpeza de roda e pneu com espuma e escova',
      description: 'Limpeza dos detalhes que completam a apresentação do seu veículo.',
    },
  ];
  readonly services = [
    {
      name: 'Lavagem Americana Simples',
      kind: 'HATCH / SEDAN',
      description: 'Lavagem para carros hatch e sedan.',
      price: 60,
    },
    { name: 'Lavagem SUV', kind: 'SUV', description: 'Com cera líquida Vonixx.', price: 70 },
    {
      name: 'Caminhonete',
      kind: 'CAMINHONETE',
      description: 'Com cera líquida Vonixx.',
      price: 80,
    },
    { name: 'Moto', kind: 'MOTO', description: 'Com cera líquida Vonixx.', price: 35 },
  ];
}
