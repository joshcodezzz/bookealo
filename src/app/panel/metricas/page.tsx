import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChartIcon, LockIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/currency";
import { translateError } from "@/lib/errors";
import {
  computeBasicMetrics,
  computeProMetrics,
  type MetricBooking,
  type ProMetrics,
} from "@/lib/metrics";
import { loadOwnerPanelData } from "@/lib/owner";
import { METRICS_FEATURES, PLAN_LABELS, resolvePlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Métricas",
};

function formatDelta(value: number | null): { text: string; tone: string } | null {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  if (pct === 0) return { text: "Igual que los 30 días anteriores", tone: "text-[#86868b]" };
  return {
    text: `${pct > 0 ? "+" : ""}${pct}% vs. los 30 días anteriores`,
    tone: pct > 0 ? "text-[#34c470]" : "text-[#ff9f0a]",
  };
}

function Stat({
  label,
  value,
  hint,
  hintTone = "text-[#86868b]",
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-[#86868b]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-[-0.02em] text-[#f5f5f7] tabular-nums">
        {value}
      </p>
      {hint && <p className={`mt-2 text-[13px] ${hintTone}`}>{hint}</p>}
    </Card>
  );
}

/** Barras horizontales: etiqueta, barra proporcional y número. */
function BarList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; count: number; extra?: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="p-5">
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-[14px] text-[#86868b]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-[14px] text-[#f5f5f7]/85">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-[#0071e3]"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-[14px] font-medium text-[#f5f5f7] tabular-nums">
                {row.count}
                {row.extra ? <span className="ml-2 text-[#86868b]">{row.extra}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Reservas por día (30 columnas). Cada columna lleva su valor en el título y en texto oculto. */
function DailyChart({ days }: { days: ProMetrics["perDay"] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Reservas por día</h3>
        <p className="text-[13px] text-[#86868b]">Últimos 30 días</p>
      </div>
      {total === 0 ? (
        <p className="mt-3 text-[14px] text-[#86868b]">Todavía no hay reservas confirmadas en este periodo.</p>
      ) : (
        <>
          <ol
            className="mt-5 flex h-[140px] items-end gap-[3px]"
            aria-label="Reservas confirmadas por día en los últimos 30 días"
          >
            {days.map((day) => (
              <li
                key={day.ymd}
                title={`${day.label}: ${day.count} ${day.count === 1 ? "reserva" : "reservas"}`}
                className="flex h-full flex-1 items-end"
              >
                <span
                  className={`block w-full rounded-t-[3px] ${day.count > 0 ? "bg-[#0071e3]" : "bg-white/[0.06]"}`}
                  style={{ height: day.count > 0 ? `${Math.max(6, Math.round((day.count / max) * 100))}%` : "2px" }}
                />
                <span className="sr-only">
                  {day.label}: {day.count}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex justify-between text-[12px] text-[#86868b] tabular-nums" aria-hidden="true">
            <span>{days[0].label}</span>
            <span>{days[14].label}</span>
            <span>{days[29].label}</span>
          </div>
          <p className="mt-3 text-[13px] text-[#86868b]">Día más fuerte: {max} en un día.</p>
        </>
      )}
    </Card>
  );
}

export default async function PanelMetricasPage() {
  const { user } = await requireRole(["business_owner"], "/panel/metricas");
  const { business, bookings, error } = await loadOwnerPanelData(user.id);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Panel del dueño" title="Métricas" subtitle="El rendimiento de tu negocio en Bookealo." />
        <ErrorState title="No pudimos cargar tus métricas" message={translateError(error)} />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Panel del dueño" title="Métricas" subtitle="El rendimiento de tu negocio en Bookealo." />
        <EmptyState
          icon={<ChartIcon className="h-5 w-5" />}
          title="Aún no tienes un negocio asignado"
          description="Cuando el administrador asigne un negocio a tu cuenta, verás aquí sus métricas."
        />
      </div>
    );
  }

  // El plan se lee aparte: si la columna aún no existe, el negocio se trata como Gratis.
  const supabase = await createClient();
  const planQuery = await supabase.from("businesses").select("plan").eq("id", business.id).maybeSingle();
  const plan = resolvePlan(planQuery.data?.plan);

  const metricBookings: MetricBooking[] = bookings.map((b) => ({
    service_id: b.service_id,
    serviceName: b.serviceName,
    start_time: b.start_time,
    status: b.status,
    total_price: b.total_price,
    customerKey: b.customer_id ?? (b.contactPhone ? `tel:${b.contactPhone}` : null),
  }));

  // Las métricas Pro solo se calculan (y se envían al navegador) si el plan las incluye.
  const pro = plan === "pro" ? computeProMetrics(metricBookings) : null;
  const basic = pro ?? computeBasicMetrics(metricBookings);

  const bookingsDelta = pro ? formatDelta(pro.bookingsDelta) : null;
  const revenueDelta = pro ? formatDelta(pro.revenueDelta) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={business.name}
        title="Métricas"
        subtitle="Reservas confirmadas de los últimos 30 días, por fecha de la reserva."
        action={<Badge tone={plan === "pro" ? "confirmed" : "pending"}>{PLAN_LABELS[plan]}</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-4">
        <Stat
          label="Reservas (30 días)"
          value={String(basic.bookings30)}
          hint={bookingsDelta?.text}
          hintTone={bookingsDelta?.tone}
        />
        <Stat label="Próximos 7 días" value={String(basic.upcoming7)} hint="Confirmadas y pendientes" />
        {pro && (
          <>
            <Stat
              label="Ingresos estimados"
              value={formatUSD(pro.revenue30)}
              hint={revenueDelta?.text ?? "Suma de precios de reservas confirmadas"}
              hintTone={revenueDelta?.tone}
            />
            <Stat
              label="Cancelación"
              value={pro.cancellationRate === null ? "—" : `${Math.round(pro.cancellationRate * 100)}%`}
              hint={`${pro.cancelled30} ${pro.cancelled30 === 1 ? "cancelada" : "canceladas"}`}
            />
          </>
        )}
      </div>

      {pro ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Ticket promedio"
              value={pro.averageTicket === null ? "—" : formatUSD(pro.averageTicket)}
              hint="Por reserva confirmada"
            />
            <Stat label="Clientes únicos" value={String(pro.uniqueCustomers)} hint="Con cuenta o teléfono registrado" />
            <Stat
              label="Clientes que repiten"
              value={String(pro.returningCustomers)}
              hint="Más de una reserva en el periodo"
            />
          </div>

          <DailyChart days={pro.perDay} />

          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            <BarList
              title="Horas pico"
              rows={pro.perHour.map((h) => ({ label: h.label, count: h.count }))}
              empty="Sin reservas confirmadas todavía."
            />
            <BarList
              title="Días de la semana"
              rows={pro.perWeekday.some((d) => d.count > 0) ? pro.perWeekday : []}
              empty="Sin reservas confirmadas todavía."
            />
          </div>

          <BarList
            title="Rendimiento por servicio"
            rows={pro.perService.map((s) => ({ label: s.name, count: s.count, extra: formatUSD(s.revenue) }))}
            empty="Sin reservas confirmadas todavía."
          />

          <p className="text-[13px] leading-[1.4] text-[#86868b]">
            Los ingresos son estimados: suman el precio de las reservas confirmadas. El cobro ocurre en tu local, no en
            Bookealo. Los bloqueos de horario no cuentan como reservas.
          </p>
        </>
      ) : (
        <Card className="p-6 min-[900px]:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[#f5f5f7]">
              <LockIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
                Más métricas con el Plan Pro
              </h2>
              <p className="mt-1 text-[15px] leading-[1.47] text-[#86868b]">
                Tu negocio está en el Plan Gratis. Con Pro ves cuánto generas, cuándo se llena tu agenda y qué servicios
                rinden más.
              </p>
              <ul className="mt-5 space-y-2.5">
                {METRICS_FEATURES.map((feature) => (
                  <li key={feature.label} className="flex items-center gap-3 text-[15px]">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        feature.plan === "pro"
                          ? "border-[#2997ff]/40 text-[#2997ff]"
                          : "border-white/15 text-[#86868b]"
                      }`}
                    >
                      {feature.plan === "pro" ? "Pro" : "Incluido"}
                    </span>
                    <span className={feature.plan === "pro" ? "text-[#f5f5f7]" : "text-[#86868b]"}>
                      {feature.label}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[14px] text-[#86868b]">
                Para activar Pro, escríbele al equipo de Bookealo. El cambio de plan lo hace el administrador.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
