import type { BookingStatus } from "@/types/database";

/** Lo mínimo que se necesita de una reserva para calcular métricas. */
export type MetricBooking = {
  service_id: string;
  serviceName: string;
  start_time: string;
  status: BookingStatus;
  total_price: number | null;
  /** Identificador estable del cliente (id de cuenta o teléfono de invitado); null si no hay */
  customerKey: string | null;
};

export type BasicMetrics = {
  /** Reservas confirmadas con fecha en los últimos 30 días */
  bookings30: number;
  /** Confirmadas o pendientes en los próximos 7 días */
  upcoming7: number;
};

export type ProMetrics = BasicMetrics & {
  revenue30: number;
  bookingsPrev30: number;
  revenuePrev30: number;
  /** Variación porcentual contra los 30 días anteriores; null si no hay base para comparar */
  bookingsDelta: number | null;
  revenueDelta: number | null;
  cancelled30: number;
  /** 0..1; null si no hubo reservas en el periodo */
  cancellationRate: number | null;
  uniqueCustomers: number;
  returningCustomers: number;
  averageTicket: number | null;
  perDay: { ymd: string; label: string; count: number }[];
  perHour: { hour: number; label: string; count: number }[];
  perWeekday: { label: string; count: number }[];
  perService: { name: string; count: number; revenue: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Panamá es UTC-5 todo el año (sin horario de verano).
const PANAMA_OFFSET_MS = 5 * 60 * 60 * 1000;
const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function panamaParts(ms: number) {
  const d = new Date(ms - PANAMA_OFFSET_MS);
  return {
    ymd: d.toISOString().slice(0, 10),
    hour: d.getUTCHours(),
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
  };
}

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "a. m." : "p. m."}`;
}

function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** Inicio (medianoche de Panamá) del día que contiene `ms`. */
function startOfPanamaDay(ms: number): number {
  return Math.floor((ms - PANAMA_OFFSET_MS) / DAY_MS) * DAY_MS + PANAMA_OFFSET_MS;
}

export function computeBasicMetrics(bookings: MetricBooking[], now: Date = new Date()): BasicMetrics {
  const nowMs = now.getTime();
  const windowStart = startOfPanamaDay(nowMs) - 29 * DAY_MS;
  let bookings30 = 0;
  let upcoming7 = 0;
  for (const b of bookings) {
    const t = Date.parse(b.start_time);
    if (Number.isNaN(t)) continue;
    if (b.status === "confirmed" && t >= windowStart && t <= nowMs) bookings30 += 1;
    if ((b.status === "confirmed" || b.status === "pending") && t > nowMs && t <= nowMs + 7 * DAY_MS) {
      upcoming7 += 1;
    }
  }
  return { bookings30, upcoming7 };
}

/**
 * Métricas completas (plan Pro) de los últimos 30 días, por fecha de la reserva.
 * Los bloqueos del dueño no cuentan. Los ingresos son estimados: suman el precio de las
 * reservas confirmadas, porque el cobro ocurre en el local y no en Bookealo.
 */
export function computeProMetrics(bookings: MetricBooking[], now: Date = new Date()): ProMetrics {
  const nowMs = now.getTime();
  const today = startOfPanamaDay(nowMs);
  const windowStart = today - 29 * DAY_MS;
  const prevStart = windowStart - 30 * DAY_MS;

  const basic = computeBasicMetrics(bookings, now);

  let revenue30 = 0;
  let bookingsPrev30 = 0;
  let revenuePrev30 = 0;
  let cancelled30 = 0;
  let pending30 = 0;

  const dayCounts = new Map<string, number>();
  const hourCounts = new Map<number, number>();
  const weekdayCounts = new Array<number>(7).fill(0);
  const services = new Map<string, { name: string; count: number; revenue: number }>();
  const customerVisits = new Map<string, number>();

  for (const b of bookings) {
    if (b.status === "blocked") continue;
    const t = Date.parse(b.start_time);
    if (Number.isNaN(t)) continue;
    const price = b.total_price ?? 0;

    if (t >= prevStart && t < windowStart) {
      if (b.status === "confirmed") {
        bookingsPrev30 += 1;
        revenuePrev30 += price;
      }
      continue;
    }
    if (t < windowStart || t > nowMs) continue;

    if (b.status === "cancelled") {
      cancelled30 += 1;
      continue;
    }
    if (b.status === "pending") {
      pending30 += 1;
      continue;
    }

    // Confirmadas dentro del periodo
    revenue30 += price;
    const p = panamaParts(t);
    dayCounts.set(p.ymd, (dayCounts.get(p.ymd) ?? 0) + 1);
    hourCounts.set(p.hour, (hourCounts.get(p.hour) ?? 0) + 1);
    weekdayCounts[p.weekday] += 1;

    const service = services.get(b.service_id) ?? { name: b.serviceName, count: 0, revenue: 0 };
    service.count += 1;
    service.revenue += price;
    services.set(b.service_id, service);

    if (b.customerKey) customerVisits.set(b.customerKey, (customerVisits.get(b.customerKey) ?? 0) + 1);
  }

  const perDay = Array.from({ length: 30 }, (_, i) => {
    const p = panamaParts(windowStart + i * DAY_MS);
    return { ymd: p.ymd, label: `${p.day}/${p.month}`, count: dayCounts.get(p.ymd) ?? 0 };
  });

  const perHour = [...hourCounts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, label: hourLabel(hour), count }));

  // Semana empezando en lunes
  const perWeekday = [1, 2, 3, 4, 5, 6, 0].map((i) => ({ label: WEEKDAYS[i], count: weekdayCounts[i] }));

  const perService = [...services.values()].sort((a, b) => b.count - a.count);

  const total = basic.bookings30 + cancelled30 + pending30;

  return {
    ...basic,
    revenue30,
    bookingsPrev30,
    revenuePrev30,
    bookingsDelta: delta(basic.bookings30, bookingsPrev30),
    revenueDelta: delta(revenue30, revenuePrev30),
    cancelled30,
    cancellationRate: total > 0 ? cancelled30 / total : null,
    uniqueCustomers: customerVisits.size,
    returningCustomers: [...customerVisits.values()].filter((n) => n > 1).length,
    averageTicket: basic.bookings30 > 0 ? revenue30 / basic.bookings30 : null,
    perDay,
    perHour,
    perWeekday,
    perService,
  };
}
