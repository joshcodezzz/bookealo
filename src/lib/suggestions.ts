/**
 * Sugerencias personalizadas de la portada.
 * El modelo de IA solo ordena candidatos y elige un motivo de una lista cerrada;
 * el texto que ve la persona siempre sale de aquí, nunca del modelo.
 */

export const SUGGESTION_REASONS = ["repetir", "misma_categoria", "misma_zona", "disponible_hoy", "popular"] as const;
export type SuggestionReason = (typeof SUGGESTION_REASONS)[number];

export const SUGGESTION_REASON_LABELS: Record<SuggestionReason, string> = {
  repetir: "Ya reservaste aquí",
  misma_categoria: "Parecido a lo que reservas",
  misma_zona: "En tu zona habitual",
  disponible_hoy: "Con turnos hoy",
  popular: "Muy reservado",
};

export type SuggestionItem = { id: string; reason: SuggestionReason };
export type SuggestionsResponse = { items: SuggestionItem[]; source: "ai" | "rules"; personalized: boolean };

export const MAX_SUGGESTIONS = 3;

/** Lo que se sabe de cada negocio candidato para esta persona. Sin nombres ni datos personales. */
export type SuggestionCandidate = {
  id: string;
  category: string;
  zone: string | null;
  availableToday: boolean;
  recentBookings: number;
  /** Veces que esta persona reservó aquí */
  visits: number;
  /** Veces que reservó en la misma categoría (en cualquier negocio) */
  categoryVisits: number;
  /** Veces que reservó en la misma zona */
  zoneVisits: number;
};

/** Un motivo solo es válido si los datos lo respaldan. */
export function isReasonTrue(candidate: SuggestionCandidate, reason: SuggestionReason): boolean {
  switch (reason) {
    case "repetir":
      return candidate.visits > 0;
    case "misma_categoria":
      return candidate.categoryVisits > 0;
    case "misma_zona":
      return candidate.zoneVisits > 0;
    case "disponible_hoy":
      return candidate.availableToday;
    case "popular":
      return candidate.recentBookings >= 5;
  }
}

/** El motivo más fuerte que sea cierto para ese negocio, o null si no hay ninguno que mostrar. */
export function bestReason(candidate: SuggestionCandidate): SuggestionReason | null {
  return SUGGESTION_REASONS.find((reason) => isReasonTrue(candidate, reason)) ?? null;
}

function score(c: SuggestionCandidate): number {
  return (
    Math.min(c.visits, 3) * 5 +
    Math.min(c.categoryVisits, 3) * 3 +
    Math.min(c.zoneVisits, 3) * 2 +
    (c.availableToday ? 2 : 0) +
    Math.min(c.recentBookings, 10) / 5
  );
}

/** Orden por reglas: se usa cuando no hay IA disponible o la persona aún no tiene historial. */
export function rankByRules(candidates: SuggestionCandidate[]): SuggestionItem[] {
  return [...candidates]
    .map((c) => ({ c, s: score(c), reason: bestReason(c) }))
    .filter((x): x is { c: SuggestionCandidate; s: number; reason: SuggestionReason } => x.reason !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ c, reason }) => ({ id: c.id, reason }));
}

/**
 * Valida la respuesta del modelo: solo ids de la lista, sin repetir, y con un motivo que sea cierto.
 * Si el motivo no se sostiene con los datos, se reemplaza por el mejor motivo verdadero.
 */
export function sanitizeModelPicks(raw: unknown, candidates: SuggestionCandidate[]): SuggestionItem[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const picks = raw && typeof raw === "object" ? (raw as { picks?: unknown }).picks : null;
  if (!Array.isArray(picks)) return [];

  const items: SuggestionItem[] = [];
  for (const pick of picks) {
    if (!pick || typeof pick !== "object") continue;
    const { id, reason } = pick as { id?: unknown; reason?: unknown };
    if (typeof id !== "string") continue;
    const candidate = byId.get(id);
    if (!candidate || items.some((item) => item.id === id)) continue;

    const claimed = SUGGESTION_REASONS.find((r) => r === reason);
    const finalReason = claimed && isReasonTrue(candidate, claimed) ? claimed : bestReason(candidate);
    if (!finalReason) continue;

    items.push({ id, reason: finalReason });
    if (items.length === MAX_SUGGESTIONS) break;
  }
  return items;
}
