import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChartIcon, LockIcon } from "@/components/ui/Icons";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { requireRole } from "@/lib/auth";
import { formatUSD } from "@/lib/currency";
import { formatPanamaDate, formatPanamaTime } from "@/lib/dates";
import { translateError } from "@/lib/errors";
import {
  computeBasicMetrics,
  computeProMetrics,
  type MetricBooking,
  type ProMetrics,
} from "@/lib/metrics";
import { loadOwnerPanelData, type OwnerBookingWithDetails } from "@/lib/owner";
import { METRICS_FEATURES, PLAN_LABELS, resolvePlan } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Métricas",
};

type Delta = { text: string; tone: string };

function formatDelta(value: number | null): Delta | null {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  if (pct === 0) return { text: "0%", tone: "bg-white/10 text-[#c7c7cc]" };
  return {
    text: `${pct > 0 ? "+" : ""}${pct}%`,
    tone: pct > 0 ? "bg-[#34c470]/[0.18] text-[#5be08f]" : "bg-[#ff9f0a]/[0.18] text-[#ffb340]",
  };
}

const panelTitle = "text-[16px] font-semibold tracking-[-0.02em] text-[#f5f5f7]";
const muted = "text-[#a1a1a6]";

/** Dato secundario dentro de un panel. */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.06] px-3.5 py-3">
      <p className={`text-[12px] ${muted}`}>{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#f5f5f7] tabular-nums">{value}</p>
    </div>
  );
}

/** Barras horizontales: etiqueta, barra proporcional y número. */
function BarList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
      <h2 className={panelTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`mt-3 text-[14px] ${muted}`}>{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="grid grid-cols-[minmax(0,5.5rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-[14px] text-[#f5f5f7]/85">{row.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-[#2997ff]"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </span>
              <span className="min-w-6 text-right text-[14px] font-medium text-[#f5f5f7] tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Reservas confirmadas y canceladas por día, como líneas. Los valores van también en texto oculto. */
function DailyLines({ days }: { days: ProMetrics["perDay"] }) {
  const max = Math.max(1, ...days.map((d) => Math.max(d.count, d.cancelled)));
  const x = (i: number) => (i * 600) / (days.length - 1);
  const y = (v: number) => 180 - (v / max) * 160;
  const line = (key: "count" | "cancelled") => days.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const area = `M0 185 ${days.map((d, i) => `L${x(i).toFixed(1)} ${y(d.count).toFixed(1)}`).join(" ")} L600 185 Z`;
  const labelAt = [0, 7, 14, 22, 29];

  return (
    <>
      <svg
        viewBox="0 0 600 185"
        preserveAspectRatio="none"
        role="img"
        aria-label="Reservas confirmadas y canceladas por día en los últimos 30 días"
        className="block h-[150px] w-full overflow-visible"
      >
        <defs>
          <linearGradient id="bk-metric-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#2997ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#2997ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 20 H600 M0 100 H600 M0 180 H600" stroke="#fff" strokeOpacity=".12" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        <path d={area} fill="url(#bk-metric-area)" />
        <polyline points={line("cancelled")} fill="none" stroke="#c7c7cc" strokeOpacity=".6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polyline points={line("count")} fill="none" stroke="#2997ff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className={`mt-2 flex justify-between text-[12px] tabular-nums ${muted}`} aria-hidden="true">
        {labelAt.map((i) => (
          <span key={i}>{days[i].label}</span>
        ))}
      </div>
      <ul className="sr-only">
        {days.map((d) => (
          <li key={d.ymd}>
            {d.label}: {d.count} confirmadas, {d.cancelled} canceladas
          </li>
        ))}
      </ul>
    </>
  );
}

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "Confirmada", tone: "text-[#5be08f]" },
  pending: { label: "Pendiente", tone: "text-[#ffb340]" },
  cancelled: { label: "Cancelada", tone: "text-[#a1a1a6]" },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "–";
}

/** Las reservas más cercanas a hoy (sin bloqueos), de la más reciente a la más antigua. */
function pickRecent(bookings: OwnerBookingWithDetails[], limit: number): OwnerBookingWithDetails[] {
  const horizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return bookings
    .filter((b) => !b.isBlocked && Date.parse(b.start_time) <= horizon)
    .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))
    .slice(0, limit);
}

/** Fondo de color difuminado para que el cristal tenga algo que desenfocar. */
function GlassStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden rounded-[30px] bg-[#050507] p-3 min-[900px]:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-40 -z-10 h-[560px] w-[560px] rounded-full bg-[#0071e3] opacity-40 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-36 top-72 -z-10 h-[520px] w-[520px] rounded-full bg-[#34c470] opacity-20 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-64 left-1/3 -z-10 h-[480px] w-[600px] rounded-full bg-[#2997ff] opacity-20 blur-[140px]" />
      {children}
    </div>
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
  const recent = pro ? pickRecent(bookings, 4) : [];
  const serviceMax = pro ? Math.max(1, ...pro.perService.map((s) => s.count)) : 1;
  const hasDailyData = pro ? pro.perDay.some((d) => d.count > 0 || d.cancelled > 0) : false;

  return (
    <GlassStage>
      <div className="bk-mglass rounded-[24px] p-5 min-[900px]:rounded-[27px] min-[900px]:p-[30px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className={`mb-1.5 truncate text-[14px] ${muted}`}>{business.name}</p>
            <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] text-[#f5f5f7] min-[900px]:text-[34px]">
              Métricas
            </h1>
            <p className={`mt-2 text-[14px] ${muted}`}>Últimos 30 días, por fecha de la reserva.</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
              plan === "pro" ? "border-[#34c470]/50 text-[#5be08f]" : "border-white/20 text-[#c7c7cc]"
            }`}
          >
            {PLAN_LABELS[plan]}
          </span>
        </header>

        {pro ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[0.85fr_1.5fr]">
              <section className="bk-mpanel flex flex-col p-5 min-[900px]:p-[22px]">
                <h2 className={`text-[13px] font-normal ${muted}`}>Ingresos estimados (30 días)</h2>
                <p className="mt-3 text-[40px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#f5f5f7] tabular-nums min-[900px]:text-[46px]">
                  {formatUSD(pro.revenue30)}
                </p>
                <p className={`mt-2.5 text-[13px] ${muted}`}>
                  {revenueDelta ? (
                    <>
                      <span className={`mr-1.5 rounded-[6px] px-1.5 py-0.5 font-semibold ${revenueDelta.tone}`}>
                        {revenueDelta.text}
                      </span>
                      vs. los 30 días anteriores
                    </>
                  ) : (
                    "Suma de precios de reservas confirmadas"
                  )}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-3 pt-7">
                  <MiniStat
                    label="Ticket promedio"
                    value={pro.averageTicket === null ? "—" : formatUSD(pro.averageTicket)}
                  />
                  <MiniStat label="Próximos 7 días" value={String(pro.upcoming7)} />
                </div>
              </section>

              <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className={panelTitle}>Reservas por día</h2>
                  <div className="flex gap-4 text-[12px] text-[#c7c7cc]" aria-hidden="true">
                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-[#2997ff]" />
                      Confirmadas
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="h-2 w-2 rounded-full bg-[#c7c7cc]" />
                      Canceladas
                    </span>
                  </div>
                </div>
                <div className="mb-3.5 flex gap-8">
                  <div>
                    <p className={`text-[12px] ${muted}`}>Confirmadas</p>
                    <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-[#f5f5f7] tabular-nums">
                      {pro.bookings30}
                      {bookingsDelta && (
                        <span className={`ml-2 rounded-[6px] px-1.5 py-0.5 align-middle text-[12px] font-semibold ${bookingsDelta.tone}`}>
                          {bookingsDelta.text}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[12px] ${muted}`}>Canceladas</p>
                    <p className="mt-0.5 text-[24px] font-semibold tracking-[-0.03em] text-[#f5f5f7] tabular-nums">
                      {pro.cancelled30}
                      {pro.cancellationRate !== null && (
                        <span className={`ml-2 text-[13px] font-medium ${muted}`}>
                          {Math.round(pro.cancellationRate * 100)}%
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {hasDailyData ? (
                  <DailyLines days={pro.perDay} />
                ) : (
                  <p className={`py-10 text-center text-[14px] ${muted}`}>
                    Todavía no hay reservas en este periodo. La gráfica aparecerá con la primera reserva confirmada.
                  </p>
                )}
              </section>
            </div>

            <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-[1.3fr_1fr]">
              <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className={panelTitle}>Últimas reservas</h2>
                  <Link href="/panel" className="bk-link inline-flex min-h-11 items-center text-[13px]">
                    Ver todas
                  </Link>
                </div>
                {recent.length === 0 ? (
                  <p className={`text-[14px] ${muted}`}>Aún no tienes reservas.</p>
                ) : (
                  <ul>
                    {recent.map((b) => {
                      const status = STATUS_LABELS[b.status] ?? STATUS_LABELS.cancelled;
                      const name = b.contactName ?? "Cliente";
                      return (
                        <li key={b.id} className="flex items-center gap-3 border-t border-white/[0.09] py-3 first:border-t-0 first:pt-0 last:pb-0">
                          <span
                            aria-hidden="true"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.09] text-[13px] font-semibold text-[#f5f5f7]"
                          >
                            {initials(name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-[#f5f5f7]">{name}</p>
                            <p className={`mt-0.5 truncate text-[12px] ${muted}`}>
                              {b.serviceName} · {formatPanamaDate(b.start_time)}, {formatPanamaTime(b.start_time)}
                            </p>
                          </div>
                          <span className={`hidden text-[12px] sm:block ${status.tone}`}>{status.label}</span>
                          <strong className="min-w-[56px] text-right text-[14px] font-semibold text-[#f5f5f7] tabular-nums">
                            {formatUSD(b.total_price)}
                          </strong>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className={panelTitle}>Rendimiento por servicio</h2>
                  <span className={`text-[12px] ${muted}`}>
                    {pro.perService.length} {pro.perService.length === 1 ? "servicio" : "servicios"}
                  </span>
                </div>
                {pro.perService.length === 0 ? (
                  <p className={`text-[14px] ${muted}`}>Sin reservas confirmadas todavía.</p>
                ) : (
                  <ul className="space-y-5">
                    {pro.perService.map((s) => (
                      <li key={s.name}>
                        <div className="flex items-baseline gap-2.5">
                          <strong className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#f5f5f7]">{s.name}</strong>
                          <span className={`text-[12px] tabular-nums ${muted}`}>
                            {s.count} {s.count === 1 ? "reserva" : "reservas"}
                          </span>
                        </div>
                        <div aria-hidden="true" className="mb-1.5 mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <i
                            className="block h-full rounded-full bg-[#2997ff]"
                            style={{ width: `${Math.round((s.count / serviceMax) * 100)}%` }}
                          />
                        </div>
                        <p className={`text-[12px] tabular-nums ${muted}`}>
                          <strong className="font-semibold text-[#f5f5f7]">{formatUSD(s.revenue)}</strong>
                          {pro.revenue30 > 0 && <> · {Math.round((s.revenue / pro.revenue30) * 100)}% de los ingresos</>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniStat label="Clientes únicos" value={String(pro.uniqueCustomers)} />
                  <MiniStat label="Repiten" value={String(pro.returningCustomers)} />
                </div>
              </section>
            </div>

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

            <p className={`text-[12px] leading-[1.45] ${muted}`}>
              Los ingresos son estimados: suman el precio de las reservas confirmadas. El cobro ocurre en tu local, no
              en Bookealo. Los bloqueos de horario no cuentan como reservas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
                <h2 className={`text-[13px] font-normal ${muted}`}>Reservas (30 días)</h2>
                <p className="mt-3 text-[40px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#f5f5f7] tabular-nums">
                  {basic.bookings30}
                </p>
                <p className={`mt-2 text-[13px] ${muted}`}>Confirmadas</p>
              </section>
              <section className="bk-mpanel p-5 min-[900px]:p-[22px]">
                <h2 className={`text-[13px] font-normal ${muted}`}>Próximos 7 días</h2>
                <p className="mt-3 text-[40px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#f5f5f7] tabular-nums">
                  {basic.upcoming7}
                </p>
                <p className={`mt-2 text-[13px] ${muted}`}>Confirmadas y pendientes</p>
              </section>
            </div>

            <section className="bk-mpanel p-5 min-[900px]:p-7">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.09] text-[#f5f5f7]">
                  <LockIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
                    Más métricas con el Plan Pro
                  </h2>
                  <p className={`mt-1 text-[15px] leading-[1.47] ${muted}`}>
                    Tu negocio está en el Plan Gratis. Con Pro ves cuánto generas, cuándo se llena tu agenda y qué
                    servicios rinden más.
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {METRICS_FEATURES.map((feature) => (
                      <li key={feature.label} className="flex items-center gap-3 text-[15px]">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            feature.plan === "pro" ? "border-[#2997ff]/50 text-[#64b5ff]" : "border-white/20 text-[#a1a1a6]"
                          }`}
                        >
                          {feature.plan === "pro" ? "Pro" : "Incluido"}
                        </span>
                        <span className={feature.plan === "pro" ? "text-[#f5f5f7]" : muted}>{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={`mt-5 text-[14px] ${muted}`}>
                    Para activar Pro, escríbele al equipo de Bookealo. El cambio de plan lo hace el administrador.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </GlassStage>
  );
}
