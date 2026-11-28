import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { resolveCategory } from "@/lib/categories";
import { getPanamaDayOfWeek, getTodayPanamaDateString } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import {
  rankByRules,
  sanitizeModelPicks,
  SUGGESTION_REASONS,
  type SuggestionCandidate,
  type SuggestionsResponse,
} from "@/lib/suggestions";
import { parseAmenities } from "@/types/database";

/**
 * Sugerencias de la portada según el historial de quien tiene la sesión iniciada.
 *
 * La IA (misma configuración que la búsqueda: AI_API_KEY, AI_BASE_URL, AI_MODEL) solo ordena
 * los candidatos. No recibe nombre, correo, teléfono ni identificador de la persona, ni nombres
 * de negocios: solo categorías, zonas, conteos y la hora del día. Sin clave, sin historial o si
 * el modelo falla, el orden sale de reglas fijas.
 */

const TIMEOUT_MS = 6000;
const CACHE_MS = 10 * 60_000;
const MAX_CANDIDATES = 40;
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Caché por persona (por instancia del servidor) para no llamar al modelo en cada visita.
const cache = new Map<string, { at: number; body: SuggestionsResponse }>();

const EMPTY: SuggestionsResponse = { items: [], source: "rules", personalized: false };

type ClientSignal = { id: string; availableToday: boolean; recentBookings: number };

function readSignals(body: unknown): ClientSignal[] {
  const list = body && typeof body === "object" ? (body as { businesses?: unknown }).businesses : null;
  if (!Array.isArray(list)) return [];
  const signals: ClientSignal[] = [];
  for (const item of list.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const { id, availableToday, recentBookings } = item as Record<string, unknown>;
    if (typeof id !== "string" || id.length > 64) continue;
    signals.push({
      id,
      availableToday: availableToday === true,
      recentBookings: typeof recentBookings === "number" && Number.isFinite(recentBookings) ? Math.max(0, Math.min(recentBookings, 10_000)) : 0,
    });
  }
  return signals;
}

function buildPrompt(): string {
  return [
    "Eres el motor de sugerencias de Bookealo, una app de reservas en Panamá.",
    "Recibes la hora actual, un resumen del historial de una persona y una lista de negocios candidatos.",
    "Elige hasta 3 candidatos que esa persona probablemente quiera reservar ahora, del más al menos probable.",
    "Criterios: repetir donde ya reservó pesa más; luego la misma categoría o zona que suele reservar;",
    "prefiere negocios con turnos hoy; considera si la hora y el día encajan con el tipo de servicio.",
    "Incluye como máximo un negocio que no haya visitado, para que descubra algo nuevo.",
    'Responde SOLO con JSON: {"picks":[{"id": string, "reason": string}]}',
    `reason debe ser exactamente uno de: ${SUGGESTION_REASONS.join(", ")}.`,
    "Usa solo ids de la lista de candidatos. No inventes ids ni motivos que los datos no respalden.",
  ].join("\n");
}

export async function POST(request: Request) {
  const { user, profile } = await getAuthContext();
  // Solo clientes con sesión: el resto de visitantes ve la portada normal.
  if (!user || !profile || profile.role !== "customer") return NextResponse.json(EMPTY);

  const cached = cache.get(user.id);
  if (cached && Date.now() - cached.at < CACHE_MS) return NextResponse.json(cached.body);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const signals = new Map(readSignals(body).map((s) => [s.id, s]));

  const supabase = await createClient();
  const [businessesRes, bookingsRes] = await Promise.all([
    supabase.from("businesses").select("id, name, zone, amenities, category").eq("is_active", true).limit(500),
    // Las reglas de la base solo devuelven las reservas de quien consulta.
    supabase
      .from("bookings")
      .select("service_id, status, start_time")
      .eq("customer_id", user.id)
      .neq("status", "cancelled")
      .order("start_time", { ascending: false })
      .limit(200),
  ]);
  if (businessesRes.error || !businessesRes.data) return NextResponse.json(EMPTY);

  const bookings = bookingsRes.data ?? [];
  const serviceIds = [...new Set(bookings.map((b) => b.service_id))];
  const serviceToBusiness = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await supabase.from("services").select("id, business_id").in("id", serviceIds);
    (services ?? []).forEach((s) => serviceToBusiness.set(s.id, s.business_id));
  }

  const businessInfo = new Map(
    businessesRes.data.map((b) => [
      b.id,
      { category: resolveCategory(b.category, b.name, ...parseAmenities(b.amenities)), zone: b.zone?.trim() || null },
    ]),
  );

  const visits = new Map<string, number>();
  const categoryVisits = new Map<string, number>();
  const zoneVisits = new Map<string, number>();
  for (const booking of bookings) {
    const businessId = serviceToBusiness.get(booking.service_id);
    const info = businessId ? businessInfo.get(businessId) : undefined;
    if (!businessId || !info) continue;
    visits.set(businessId, (visits.get(businessId) ?? 0) + 1);
    categoryVisits.set(info.category, (categoryVisits.get(info.category) ?? 0) + 1);
    if (info.zone) zoneVisits.set(info.zone, (zoneVisits.get(info.zone) ?? 0) + 1);
  }

  const candidates: SuggestionCandidate[] = [...businessInfo.entries()].map(([id, info]) => ({
    id,
    category: info.category,
    zone: info.zone,
    availableToday: signals.get(id)?.availableToday ?? false,
    recentBookings: signals.get(id)?.recentBookings ?? 0,
    visits: visits.get(id) ?? 0,
    categoryVisits: categoryVisits.get(info.category) ?? 0,
    zoneVisits: info.zone ? (zoneVisits.get(info.zone) ?? 0) : 0,
  }));

  const personalized = visits.size > 0;
  const rules = (): SuggestionsResponse => ({ items: rankByRules(candidates), source: "rules", personalized });
  const finish = (result: SuggestionsResponse) => {
    if (cache.size > 5000) cache.clear();
    cache.set(user.id, { at: Date.now(), body: result });
    return NextResponse.json(result);
  };

  // Sin historial no hay nada que personalizar: se usan reglas y no se gasta cuota del modelo.
  const apiKey = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey || !personalized) return finish(rules());

  // Al modelo solo le llegan los candidatos más relevantes, ya ordenados por reglas.
  const shortlist = [...candidates]
    .sort((a, b) => b.visits * 5 + b.categoryVisits * 3 + b.zoneVisits * 2 - (a.visits * 5 + a.categoryVisits * 3 + a.zoneVisits * 2))
    .slice(0, MAX_CANDIDATES);

  const today = getTodayPanamaDateString();
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Panama", hour: "numeric", hour12: false }).format(new Date()),
  );
  const payload = {
    ahora: { dia: WEEKDAYS[getPanamaDayOfWeek(today)], hora: hour % 24 },
    historial: {
      reservas: bookings.length,
      por_categoria: Object.fromEntries(categoryVisits),
      por_zona: Object.fromEntries(zoneVisits),
    },
    candidatos: shortlist.map((c) => ({
      id: c.id,
      categoria: c.category,
      zona: c.zone,
      turnos_hoy: c.availableToday,
      reservas_recientes: c.recentBookings,
      veces_que_reservo_aqui: c.visits,
    })),
  };

  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? "deepseek-flash";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const ask = (jsonMode: boolean) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: buildPrompt() },
            { role: "user", content: JSON.stringify(payload) },
          ],
        }),
        signal: controller.signal,
      });

    let response = await ask(true);
    if (response.status === 400) response = await ask(false);
    if (!response.ok) return finish(rules());

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const items = sanitizeModelPicks(JSON.parse(jsonText), shortlist);
    if (items.length === 0) return finish(rules());

    return finish({ items, source: "ai", personalized });
  } catch {
    return finish(rules());
  } finally {
    clearTimeout(timer);
  }
}
