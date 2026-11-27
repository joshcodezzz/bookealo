import { NextResponse } from "next/server";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import {
  EMPTY_FILTERS,
  hasAnyFilter,
  interpretLocally,
  sanitizeFilters,
  type SearchInterpretation,
} from "@/lib/smart-search";

/**
 * Búsqueda inteligente: convierte una frase en filtros del catálogo.
 *
 * Usa cualquier API compatible con OpenAI. Variables de entorno (solo servidor):
 *   AI_API_KEY   clave del proveedor (sin ella se usan reglas por palabras clave)
 *   AI_BASE_URL  por defecto https://api.deepseek.com
 *   AI_MODEL     por defecto deepseek-flash
 * Ejemplo gratis con Groq: AI_BASE_URL=https://api.groq.com/openai/v1 y AI_MODEL=llama-3.3-70b-versatile
 *
 * El modelo nunca ve datos de clientes: solo la frase, las categorías y los nombres de zona.
 */

const MAX_QUERY = 200;
const TIMEOUT_MS = 6000;

// Límite simple por IP (por instancia del servidor) para que nadie gaste la cuota.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; start: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function buildPrompt(zones: string[]): string {
  const categories = CATEGORY_ORDER.map((c) => `- ${c}: ${CATEGORIES[c].label}. ${CATEGORIES[c].blurb}`).join("\n");
  return [
    "Eres el buscador de Bookealo, una app de reservas en Panamá.",
    "Convierte la frase del usuario en filtros. Responde SOLO con un objeto JSON con estas claves:",
    '{"category": string|null, "zone": string|null, "today": boolean, "maxPrice": number|null, "terms": string[]}',
    "",
    "category: uno de estos identificadores, o null si no aplica:",
    categories,
    "",
    `zone: exactamente una de estas zonas, o null: ${zones.length ? zones.join(" | ") : "(ninguna)"}`,
    "today: true solo si pide algo para hoy o ahora.",
    "maxPrice: precio máximo en dólares si lo menciona, si no null.",
    "terms: solo nombres propios de negocios que el usuario escribió (por ejemplo \"frank\"). Nunca palabras genéricas como barbería, cancha, barato o cerca.",
    "No inventes zonas ni categorías. Si la frase no se entiende, devuelve todo en null, false y [].",
  ].join("\n");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const query = typeof input.query === "string" ? input.query.trim().slice(0, MAX_QUERY) : "";
  const zones = Array.isArray(input.zones)
    ? input.zones
        .filter((z): z is string => typeof z === "string")
        .map((z) => z.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  if (query.length < 2) {
    return NextResponse.json({ error: "Escribe algo para buscar." }, { status: 400 });
  }

  const local = (): SearchInterpretation => ({
    filters: interpretLocally(query, zones) ?? EMPTY_FILTERS,
    source: "local",
  });

  const apiKey = process.env.AI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return NextResponse.json(local());

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json(local());

  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.deepseek.com").replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? "deepseek-flash";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildPrompt(zones) },
          { role: "user", content: query },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return NextResponse.json(local());

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonText = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const filters = sanitizeFilters(JSON.parse(jsonText), zones);

    // Si el modelo no entendió nada, se intenta con las reglas locales.
    if (!hasAnyFilter(filters)) return NextResponse.json(local());

    return NextResponse.json({ filters, source: "ai" } satisfies SearchInterpretation);
  } catch {
    return NextResponse.json(local());
  } finally {
    clearTimeout(timer);
  }
}
