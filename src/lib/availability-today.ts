import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAvailableSlots } from "@/lib/availability";
import {
  addDaysToDateString,
  buildPanamaISO,
  getPanamaDayOfWeek,
  getTodayPanamaDateString,
} from "@/lib/dates";
import type { Database, ScheduleRow } from "@/types/database";

export type TodayAvailability = {
  /** ISO de la primera franja libre que queda hoy (America/Panama) */
  firstSlotIso: string;
  /** Total de franjas libres que quedan hoy, sumando todos los servicios */
  slotCount: number;
};

type ServiceForAvailability = {
  id: string;
  business_id: string;
  slot_duration_minutes: number;
};

/**
 * Calcula qué negocios tienen franjas libres hoy, con la misma lógica que la hoja de reserva
 * (horario del día + `get_busy_slots`). Si una consulta falla, ese servicio se omite: nunca se
 * marca como disponible algo que no se pudo verificar.
 */
export async function fetchTodayAvailabilityByBusiness(
  supabase: SupabaseClient<Database>,
  services: ServiceForAvailability[],
  now: Date = new Date(),
): Promise<Map<string, TodayAvailability>> {
  const result = new Map<string, TodayAvailability>();
  if (services.length === 0) return result;

  const today = getTodayPanamaDateString(now);
  const dayOfWeek = getPanamaDayOfWeek(today);

  const { data: schedules, error } = await supabase
    .from("schedules")
    .select("id, service_id, day_of_week, open_time, close_time, is_closed")
    .in(
      "service_id",
      services.map((s) => s.id),
    )
    .eq("day_of_week", dayOfWeek);

  if (error || !schedules) return result;

  const scheduleByService = new Map<string, ScheduleRow>();
  schedules.forEach((s) => scheduleByService.set(s.service_id, s));

  const rangeFrom = buildPanamaISO(today, "00:00:00");
  const rangeTo = buildPanamaISO(addDaysToDateString(today, 1), "00:00:00");

  const openServices = services.filter((s) => {
    const schedule = scheduleByService.get(s.id);
    return schedule && !schedule.is_closed;
  });

  const perService = await Promise.all(
    openServices.map(async (service) => {
      const { data: busySlots, error: busyError } = await supabase.rpc(
        "get_busy_slots",
        { p_service_id: service.id, p_from: rangeFrom, p_to: rangeTo },
      );
      if (busyError) return null;

      const availability = computeAvailableSlots({
        dateStr: today,
        slotDurationMinutes: service.slot_duration_minutes,
        schedule: scheduleByService.get(service.id) ?? null,
        busySlots: busySlots ?? [],
        now,
      });

      return { businessId: service.business_id, slots: availability.slots };
    }),
  );

  perService.forEach((entry) => {
    if (!entry || entry.slots.length === 0) return;
    const first = entry.slots[0].startIso;
    const existing = result.get(entry.businessId);
    if (!existing) {
      result.set(entry.businessId, {
        firstSlotIso: first,
        slotCount: entry.slots.length,
      });
    } else {
      result.set(entry.businessId, {
        firstSlotIso:
          Date.parse(first) < Date.parse(existing.firstSlotIso)
            ? first
            : existing.firstSlotIso,
        slotCount: existing.slotCount + entry.slots.length,
      });
    }
  });

  return result;
}

/** Inicio de la ventana de N días hacia atrás, para contar reservas recientes */
export function recentWindowStartIso(days = 30, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
