/** Planes de suscripción de un negocio (columna `businesses.plan`). */
export type BusinessPlan = "gratis" | "pro";

export const PLAN_LABELS: Record<BusinessPlan, string> = {
  gratis: "Plan Gratis",
  pro: "Plan Pro",
};

export function resolvePlan(value: unknown): BusinessPlan {
  return value === "pro" ? "pro" : "gratis";
}

/** Qué incluye cada plan en el panel de métricas. */
export const METRICS_FEATURES: { label: string; plan: BusinessPlan }[] = [
  { label: "Reservas de los últimos 30 días", plan: "gratis" },
  { label: "Reservas de los próximos 7 días", plan: "gratis" },
  { label: "Ingresos estimados y comparación con el mes anterior", plan: "pro" },
  { label: "Tasa de cancelación", plan: "pro" },
  { label: "Clientes únicos y recurrentes", plan: "pro" },
  { label: "Reservas por día, horas pico y días más fuertes", plan: "pro" },
  { label: "Rendimiento por servicio", plan: "pro" },
];
