export type Role = 'administrador' | 'gerente' | 'atendente' | 'operador' | 'cliente';
export type OrderStatus =
  'AGUARDANDO' | 'EM_SERVICO' | 'AGUARDANDO_PAGAMENTO' | 'FINALIZADO' | 'CANCELADO';
export type AppointmentStatus =
  'AGENDADO' | 'CONFIRMADO' | 'EM_ATENDIMENTO' | 'CONCLUIDO' | 'CANCELADO' | 'NAO_COMPARECEU';
export type PaymentMethod = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'OUTROS';
export interface Base {
  id: string;
  created_at: string;
  updated_at?: string;
}
export interface Profile extends Base {
  name: string;
  role: Role;
  active: boolean;
}
export interface Customer extends Base {
  name: string;
  phone: string;
  document?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
}
export interface Vehicle extends Base {
  customer_id: string;
  plate: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  type: string;
  notes?: string;
  active: boolean;
}
export interface Service extends Base {
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category_id?: string;
  active: boolean;
}
export interface Category extends Base {
  name: string;
}
export interface Employee extends Base {
  name: string;
  phone?: string;
  email?: string;
  position: string;
  profile_id?: string;
  active: boolean;
}
export interface WorkOrder extends Base {
  number: number;
  customer_id: string;
  vehicle_id: string;
  employee_id?: string;
  status: OrderStatus;
  total: number;
  discount: number;
  surcharge: number;
  entered_at: string;
  expected_at?: string;
  completed_at?: string;
  exited_at?: string;
  notes?: string;
  fuel_level?: string;
  vehicle_condition?: string;
  belongings?: string;
}
export interface OrderItem extends Base {
  work_order_id: string;
  service_id?: string;
  name: string;
  kind: 'SERVICO' | 'PRODUTO';
  quantity: number;
  unit_price: number;
}
export interface Appointment extends Base {
  customer_id: string;
  vehicle_id: string;
  service_id: string;
  starts_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes?: string;
}
export interface Payment extends Base {
  work_order_id: string;
  cash_register_id: string;
  amount: number;
  method: PaymentMethod;
}
export interface CashRegister extends Base {
  opened_at: string;
  opening_amount: number;
  closed_at?: string;
  closing_amount?: number;
  expected_amount?: number;
  notes?: string;
}
export interface CashMovement extends Base {
  cash_register_id: string;
  payment_id?: string;
  type: string;
  amount: number;
  description: string;
}
export interface Settings extends Base {
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  opening_hours: string;
  appointment_capacity: number;
}
export interface AuditLog extends Base {
  actor_id?: string;
  action: string;
  entity: string;
  record_id: string;
}
export interface Database {
  customers: Customer[];
  vehicles: Vehicle[];
  services: Service[];
  service_categories: Category[];
  employees: Employee[];
  work_orders: WorkOrder[];
  work_order_items: OrderItem[];
  appointments: Appointment[];
  payments: Payment[];
  cash_registers: CashRegister[];
  cash_movements: CashMovement[];
  business_settings: Settings[];
  profiles: Profile[];
  parada_audit_logs: AuditLog[];
}
export type Table = keyof Database;
export const EMPTY_DATABASE: Database = {
  customers: [],
  vehicles: [],
  services: [],
  service_categories: [],
  employees: [],
  work_orders: [],
  work_order_items: [],
  appointments: [],
  payments: [],
  cash_registers: [],
  cash_movements: [],
  business_settings: [],
  profiles: [],
  parada_audit_logs: [],
};
export const STATUS_LABELS: Partial<Record<string, string>> = {
  AGUARDANDO: 'Aguardando',
  EM_SERVICO: 'Em serviço',
  AGUARDANDO_PAGAMENTO: 'Pronto para receber',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  EM_ATENDIMENTO: 'Em atendimento',
  CONCLUIDO: 'Concluído',
  NAO_COMPARECEU: 'Não compareceu',
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  DEBITO: 'Cartão de débito',
  CREDITO: 'Cartão de crédito',
  TRANSFERENCIA: 'Transferência',
  OUTROS: 'Outros',
};
export const PAYMENT_METHODS: PaymentMethod[] = [
  'DINHEIRO',
  'PIX',
  'DEBITO',
  'CREDITO',
  'TRANSFERENCIA',
  'OUTROS',
];
