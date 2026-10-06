import { Database, EMPTY_DATABASE } from './models';
import { businessDate } from './domain';
export function demoDatabase(): Database {
  const d = structuredClone(EMPTY_DATABASE);
  const date = businessDate();
  const time = (s: string) => new Date(`${date}T${s}:00-03:00`).toISOString();
  const base = (id: string) => ({ id, created_at: time('08:00') });
  d.customers = [
    {
      ...base('c1'),
      name: 'Mariana Costa',
      phone: '11987654321',
      email: 'mariana@example.com',
      active: true,
    },
    { ...base('c2'), name: 'Rafael Almeida', phone: '11976543210', active: true },
    { ...base('c3'), name: 'Lucas Ferreira', phone: '11965432109', active: true },
    { ...base('c4'), name: 'Ana Oliveira', phone: '11954321098', active: true },
  ];
  d.vehicles = [
    {
      ...base('v1'),
      customer_id: 'c1',
      plate: 'ABC1D23',
      brand: 'Jeep',
      model: 'Compass',
      color: 'Branco',
      type: 'SUV',
      active: true,
    },
    {
      ...base('v2'),
      customer_id: 'c2',
      plate: 'DEF4G56',
      brand: 'Volkswagen',
      model: 'Polo',
      color: 'Prata',
      type: 'carro',
      active: true,
    },
    {
      ...base('v3'),
      customer_id: 'c3',
      plate: 'GHI7J89',
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Preto',
      type: 'carro',
      active: true,
    },
    {
      ...base('v4'),
      customer_id: 'c4',
      plate: 'JKL2M34',
      brand: 'Honda',
      model: 'HR-V',
      color: 'Cinza',
      type: 'SUV',
      active: true,
    },
  ];
  d.service_categories = [
    { ...base('cat1'), name: 'Lavagens' },
    { ...base('cat2'), name: 'Estética automotiva' },
  ];
  d.services = [
    {
      ...base('s1'),
      name: 'Lavagem completa',
      description: 'Exterior, aspiração e acabamento interno',
      price: 85,
      duration_minutes: 60,
      category_id: 'cat1',
      active: true,
    },
    {
      ...base('s2'),
      name: 'Lavagem premium',
      description: 'Lavagem detalhada com proteção da pintura',
      price: 150,
      duration_minutes: 90,
      category_id: 'cat1',
      active: true,
    },
    {
      ...base('s3'),
      name: 'Higienização interna',
      description: 'Limpeza profunda dos bancos e interior',
      price: 250,
      duration_minutes: 180,
      category_id: 'cat2',
      active: true,
    },
    {
      ...base('s4'),
      name: 'Lavagem simples',
      description: 'Limpeza externa e secagem',
      price: 50,
      duration_minutes: 30,
      category_id: 'cat1',
      active: true,
    },
  ];
  d.employees = [
    { ...base('e1'), name: 'Carlos Santos', position: 'Operador', active: true },
    { ...base('e2'), name: 'Bruno Lima', position: 'Operador', active: true },
  ];
  d.work_orders = [
    {
      ...base('o1'),
      number: 1041,
      customer_id: 'c1',
      vehicle_id: 'v1',
      employee_id: 'e1',
      status: 'EM_SERVICO',
      total: 150,
      discount: 0,
      surcharge: 0,
      entered_at: time('09:10'),
      expected_at: time('10:40'),
    },
    {
      ...base('o2'),
      number: 1042,
      customer_id: 'c2',
      vehicle_id: 'v2',
      status: 'AGUARDANDO',
      total: 85,
      discount: 0,
      surcharge: 0,
      entered_at: time('09:35'),
      expected_at: time('11:00'),
    },
    {
      ...base('o3'),
      number: 1040,
      customer_id: 'c3',
      vehicle_id: 'v3',
      employee_id: 'e2',
      status: 'AGUARDANDO_PAGAMENTO',
      total: 85,
      discount: 0,
      surcharge: 0,
      entered_at: time('08:15'),
      completed_at: time('09:15'),
    },
    {
      ...base('o4'),
      number: 1039,
      customer_id: 'c4',
      vehicle_id: 'v4',
      employee_id: 'e1',
      status: 'FINALIZADO',
      total: 50,
      discount: 0,
      surcharge: 0,
      entered_at: time('08:00'),
      completed_at: time('08:30'),
      exited_at: time('08:45'),
    },
  ];
  d.work_order_items = d.work_orders.map((o, i) => ({
    ...base(`i${i}`),
    work_order_id: o.id,
    service_id: i === 0 ? 's2' : i === 3 ? 's4' : 's1',
    name: i === 0 ? 'Lavagem premium' : i === 3 ? 'Lavagem simples' : 'Lavagem completa',
    kind: 'SERVICO',
    quantity: 1,
    unit_price: o.total,
  }));
  d.appointments = [
    {
      ...base('a1'),
      customer_id: 'c1',
      vehicle_id: 'v1',
      service_id: 's3',
      starts_at: time('14:00'),
      duration_minutes: 180,
      status: 'CONFIRMADO',
    },
    {
      ...base('a2'),
      customer_id: 'c2',
      vehicle_id: 'v2',
      service_id: 's1',
      starts_at: time('16:00'),
      duration_minutes: 60,
      status: 'AGENDADO',
    },
  ];
  d.cash_registers = [{ ...base('r1'), opened_at: time('08:00'), opening_amount: 100 }];
  d.payments = [
    { ...base('p1'), work_order_id: 'o4', cash_register_id: 'r1', amount: 50, method: 'PIX' },
  ];
  d.cash_movements = [
    {
      ...base('m1'),
      cash_register_id: 'r1',
      type: 'ABERTURA',
      amount: 100,
      description: 'Abertura do caixa',
    },
    {
      ...base('m2'),
      cash_register_id: 'r1',
      payment_id: 'p1',
      type: 'VENDA',
      amount: 50,
      description: 'Pagamento OS 1039',
    },
  ];
  d.business_settings = [
    {
      ...base('settings'),
      name: 'Parada Obrigatória',
      opening_hours: 'Seg–Sáb, 08h às 18h',
      appointment_capacity: 2,
    },
  ];
  return d;
}
