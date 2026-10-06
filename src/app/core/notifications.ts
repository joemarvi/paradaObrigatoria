import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class Notifications {
  readonly message = signal('');
  readonly error = signal(false);
  show(message: string, error = false) {
    this.error.set(error);
    this.message.set(message);
  }
  clear() {
    this.message.set('');
  }
}
export function friendlyError(error: unknown): string {
  const e = error as { code?: string; message?: string };
  if (e.code === '23505')
    return 'Já existe um registro com esses dados. Verifique a placa, documento ou caixa aberto.';
  if (e.code === '42501') return 'Seu perfil não tem permissão para esta operação.';
  if (e.code === '23514')
    return 'Verifique os dados informados: um campo está fora do formato permitido.';
  if (e.code === '23503') return 'Um registro relacionado não está disponível. Atualize a página.';
  const known = [
    'Acesso não permitido',
    'Informe nome e telefone válidos',
    'Informe marca, modelo e cor válidos',
    'Escolha um horário futuro nos próximos 365 dias',
    'Observações devem ter até 1000 caracteres',
    'Agendamento não pode ser cancelado',
    'Veículo e cliente inválidos',
    'Funcionário inativo',
    'Selecione um serviço',
    'Serviço indisponível',
    'Desconto superior ao total',
    'Esta ordem não pode ser cancelada',
    'Transição de status inválida',
    'Abra o caixa antes de receber',
    'Ordem não disponível para pagamento',
    'Pagamento superior ao saldo',
    'Caixa fechado',
    'Saldo insuficiente em dinheiro',
    'Caixa já fechado',
    'Finalize o pagamento antes da saída',
    'Veículo não pertence ao cliente',
    'Cliente ou serviço inativo',
    'Horário sem disponibilidade',
  ];
  if (e.message && known.includes(e.message)) return e.message + '.';
  if (e.message && /fetch|network|Failed to fetch/i.test(e.message))
    return 'Não foi possível conectar. Verifique sua conexão e tente novamente.';
  if (e.message && /Invalid login credentials/i.test(e.message))
    return 'E-mail ou senha incorretos.';
  if (e.message && /Email not confirmed/i.test(e.message))
    return 'Confirme seu e-mail antes de entrar.';
  return 'Não foi possível concluir a operação. Verifique os dados e tente novamente.';
}
