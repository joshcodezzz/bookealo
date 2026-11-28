import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAvailableSlots } from "@/lib/availability";
import { addDaysToDateString, buildPanamaISO, getPanamaDayOfWeek } from "@/lib/dates";
import type { Database, ScheduleRow } from "@/types/database";

export type NextSlot = {
  serviceId: string;
  /** Fecha en Panamá, AAAA-MM-DD */
  dateStr: string;
  /** Hora de inicio HH:MM, tal como la usa la hoja de reserva */
  startTime: string;
  startIso: string;
};

type ServiceForNextSlot = {
  id: string;
  slot_duration_minutes: number;
  schedules: ScheduleRow[];
};

/**
 * Busca el turno libre más cercano entre todos los servicios de un negocio, día por día.
 * Usa la misma lógica que la hoja de reserva (horario + `get_busy_slots`). Si una consulta
 * falla, ese servicio se omite: nunca se ofrece un turno que no se pudo verificar.
 */
export async function findNextAvailableSlot(
  supabase: SupabaseClient<Database>,
  services: ServiceForNextSlot[],
  dateStrs: string[],
  now: Date = new Date(),
): Promise<NextSlot | null> {
  for (const dateStr of dateStrs) {
    const dayOfWeek = getPanamaDayOfWeek(dateStr);
    const open = services
      .map((service) => ({
        service,
        schedule: service.schedules.find((s) => s.day_of_week === dayOfWeek && !s.is_closed) ?? null,
      }))
      .filter((entry) => entry.schedule !== null);
    if (open.length === 0) continue;

    const rangeFrom = buildPanamaISO(dateStr, "00:00:00");
    const rangeTo = buildPanamaISO(addDaysToDateString(dateStr, 1), "00:00:00");

    const firstPerService = await Promise.all(
      open.map(async ({ service, schedule }) => {
        const { data: busySlots, error } = await supabase.rpc("get_busy_slots", {
          p_service_id: service.id,
          p_from: rangeFrom,
          p_to: rangeTo,
        });
        if (error) return null;
        const first = computeAvailableSlots({
          dateStr,
          slotDurationMinutes: service.slot_duration_minutes,
          schedule,
          busySlots: busySlots ?? [],
          now,
        }).slots[0];
        return first ? { serviceId: service.id, dateStr, startTime: first.startTime, startIso: first.startIso } : null;
      }),
    );

    const earliest = firstPerService
      .filter((slot): slot is NextSlot => slot !== null)
      .sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))[0];
    if (earliest) return earliest;
  }
  return null;
}
