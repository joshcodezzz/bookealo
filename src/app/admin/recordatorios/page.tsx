import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth";
import { formatPanamaDate, formatPanamaTime } from "@/lib/dates";
import { missingWhatsAppConfig } from "@/lib/reminders/whatsapp";
import { createClient } from "@/lib/supabase/server";
import type { ReminderKind, ReminderStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Recordatorios",
};

const KIND_LABELS: Record<ReminderKind, string> = {
  "24h": "24 horas antes",
  "2h": "2 horas antes",
  "30m": "30 minutos antes",
};

const STATUS: Record<ReminderStatus, { label: string; tone: string }> = {
  queued: { label: "En cola", tone: "text-[#ff9f0a] border-[#ff9f0a]/40" },
  sent: { label: "Enviado", tone: "text-[#34c470] border-[#34c470]/40" },
  failed: { label: "Falló", tone: "text-[#ff6961] border-[#ff6961]/40" },
  skipped: { label: "Omitido", tone: "text-[#86868b] border-white/15" },
};

/** Muestra solo los últimos 4 dígitos del teléfono. */
function maskPhone(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "Sin teléfono";
}

export default async function AdminRecordatoriosPage() {
  await requireRole(["super_admin"], "/admin/recordatorios");

  const supabase = await createClient();
  const { data: reminders, error } = await supabase
    .from("booking_reminders")
    .select("id, kind, due_at, to_name, to_phone, message, status, error, attempts, sent_at")
    .order("due_at", { ascending: false })
    .limit(100);

  const missing = [
    ...(process.env.CRON_SECRET ? [] : ["CRON_SECRET"]),
    ...(process.env.SUPABASE_SERVICE_ROLE_KEY ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
    ...missingWhatsAppConfig(),
  ];
  const rows = reminders ?? [];
  const count = (status: ReminderStatus) => rows.filter((r) => r.status === status).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Recordatorios"
        subtitle="Avisos de reserva a 24 horas, 2 horas y 30 minutos."
        action={
          <Link href="/admin" className="text-[14px] text-[#2997ff] hover:underline">
            Volver a administración
          </Link>
        }
      />

      <Card className="p-5">
        <h2 className="text-[17px] font-semibold text-[#f5f5f7]">
          {missing.length === 0 ? "WhatsApp conectado" : "WhatsApp todavía no está conectado"}
        </h2>
        <p className="mt-1 text-[14px] leading-[1.47] text-[#86868b]">
          {missing.length === 0
            ? "Los avisos en cola se envían cada vez que el programador llama a /api/reminders/send."
            : "La cola se arma sola, pero nada se envía hasta completar la configuración. Los avisos quedan «En cola»."}
        </p>
        {missing.length > 0 && (
          <p className="mt-3 text-[13px] text-[#86868b]">
            Falta en Vercel: <span className="text-[#f5f5f7]">{missing.join(", ")}</span>
          </p>
        )}
      </Card>

      {error ? (
        <p role="alert" className="rounded-[14px] border border-[#ff6961]/40 px-4 py-3 text-[14px] text-[#ff6961]">
          No se pudo leer la cola. Si la tabla aún no existe, aplica la migración de recordatorios en Supabase.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 min-[900px]:grid-cols-4">
            {(Object.keys(STATUS) as ReminderStatus[]).map((status) => (
              <Card key={status} className="p-5">
                <p className="text-[13px] font-medium text-[#86868b]">{STATUS[status].label}</p>
                <p className="mt-2 text-[32px] font-semibold leading-none text-[#f5f5f7] tabular-nums">{count(status)}</p>
              </Card>
            ))}
          </div>

          {rows.length === 0 ? (
            <Card className="p-6">
              <p className="text-[15px] text-[#86868b]">
                Todavía no hay avisos. Aparecen aquí cuando a una reserva confirmada le faltan 24 horas, 2 horas o 30
                minutos.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[15px] font-medium text-[#f5f5f7]">
                        {r.to_name ?? "Cliente"} · {maskPhone(r.to_phone)}
                      </p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${STATUS[r.status].tone}`}>
                        {STATUS[r.status].label}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-[#86868b] tabular-nums">
                      {KIND_LABELS[r.kind]} · programado {formatPanamaDate(r.due_at)} {formatPanamaTime(r.due_at)}
                      {r.attempts > 0 ? ` · ${r.attempts} intento(s)` : ""}
                    </p>
                    <p className="mt-2 text-[14px] leading-[1.45] text-[#f5f5f7]/85">{r.message}</p>
                    {r.error && <p className="mt-1.5 text-[13px] text-[#ff9f0a]">{r.error}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
