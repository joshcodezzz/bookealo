import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { missingWhatsAppConfig, normalizePhone, sendWhatsAppReminder, type ReminderParams } from "@/lib/reminders/whatsapp";
import type { Database } from "@/types/database";

/**
 * Envía los recordatorios en cola. Lo llama un programador (cada 5 minutos) con:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Variables de entorno (solo servidor):
 *   CRON_SECRET                 contraseña larga que solo conoce el programador
 *   SUPABASE_SERVICE_ROLE_KEY   clave de servicio de Supabase (lee la cola, que tiene teléfonos)
 *   + las de WhatsApp (ver src/lib/reminders/whatsapp.ts)
 *
 * Mientras falte algo responde 503 y no toca la cola: los avisos siguen en 'queued'.
 */

const BATCH = 40;
const MAX_ATTEMPTS = 3;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const missing = [
    ...(secret ? [] : ["CRON_SECRET"]),
    ...(serviceKey ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
    ...missingWhatsAppConfig(),
  ];

  // Sin secreto configurado no se puede autenticar a nadie.
  if (!secret) return NextResponse.json({ error: "No configurado", missing }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (missing.length > 0 || !serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: "No configurado", missing }, { status: 503 });
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const nowIso = new Date().toISOString();

  const { data: queued, error } = await supabase
    .from("booking_reminders")
    .select("id, booking_id, kind, due_at, to_phone, params, attempts")
    .eq("status", "queued")
    .lte("due_at", nowIso)
    .order("due_at", { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: "No se pudo leer la cola" }, { status: 500 });
  if (!queued || queued.length === 0) return NextResponse.json({ sent: 0, failed: 0, skipped: 0 });

  // Se vuelve a comprobar cada reserva justo antes de enviar.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, status, start_time")
    .in("id", queued.map((r) => r.booking_id));
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of queued) {
    const booking = bookingById.get(reminder.booking_id);
    const skip = async (reason: string) => {
      skipped += 1;
      await supabase.from("booking_reminders").update({ status: "skipped", error: reason }).eq("id", reminder.id);
    };

    if (!booking || booking.status !== "confirmed") {
      await skip("Reserva cancelada");
      continue;
    }
    if (Date.parse(booking.start_time) <= Date.now()) {
      await skip("La reserva ya empezó");
      continue;
    }
    const phone = normalizePhone(reminder.to_phone);
    if (!phone) {
      await skip("Teléfono inválido");
      continue;
    }

    const result = await sendWhatsAppReminder(phone, (reminder.params ?? {}) as ReminderParams);
    const attempts = reminder.attempts + 1;

    if (result.ok) {
      sent += 1;
      await supabase
        .from("booking_reminders")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts, error: null })
        .eq("id", reminder.id);
    } else {
      failed += 1;
      // Se reintenta en la próxima pasada hasta agotar los intentos.
      await supabase
        .from("booking_reminders")
        .update({ status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", attempts, error: result.error })
        .eq("id", reminder.id);
    }
  }

  return NextResponse.json({ sent, failed, skipped });
}
