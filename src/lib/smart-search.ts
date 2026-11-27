import { CATEGORY_ORDER, type BusinessCategory } from "@/lib/categories";

/** Lo que el buscador entendió de una frase como "barbería barata hoy en Costa del Este" */
export type SearchFilters = {
  category: BusinessCategory | null;
  zone: string | null;
  today: boolean;
  maxPrice: number | null;
  /** Palabras que deben aparecer en el nombre del negocio (p. ej. "frank") */
  terms: string[];
};

export type SearchInterpretation = {
  filters: SearchFilters;
  /** "ai" = lo interpretó el modelo; "local" = reglas por palabras clave */
  source: "ai" | "local";
};

export const EMPTY_FILTERS: SearchFilters = {
  category: null,
  zone: null,
  today: false,
  maxPrice: null,
  terms: [],
};

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function hasAnyFilter(f: SearchFilters): boolean {
  return Boolean(f.category || f.zone || f.today || f.maxPrice !== null || f.terms.length);
}

// Sinónimos por categoría, sobre texto ya normalizado (sin tildes).
const CATEGORY_WORDS: { category: BusinessCategory; pattern: RegExp }[] = [
  { category: "mandaos", pattern: /\b(mandado|mandados|manda'?os|recado|encargo|traeme|buscame|recoger|llevar algo)\b/ },
  { category: "talents", pattern: /\b(freelancer?s?|pianista|musico|dj|fotografo|detailing|chef|bartender|animador|talento)\b/ },
  { category: "clases", pattern: /\b(clases?|tutor(ia|ias)?|profesor(a|es)?|curso|aprender|ingles|matematicas)\b/ },
  { category: "mascotas", pattern: /\b(mascotas?|perros?|gatos?|veterinari[oa]|grooming|pasear)\b/ },
  { category: "limpieza", pattern: /\b(limpieza|limpiar|aseo|lavanderia)\b/ },
  { category: "hogar", pattern: /\b(plomer[oi]a?|electricista|reparar|reparacion|cerrajero|pintor|aire acondicionado|tecnico)\b/ },
  { category: "belleza", pattern: /\b(barber(o|ia|ias)?|corte|cortarme|pelo|cabello|barba|salon|unas|manicure|pedicure|peluquer(ia|o)|maquillaje)\b/ },
  { category: "bienestar", pattern: /\b(spa|masajes?|yoga|pilates|relajar|relajarme|bienestar)\b/ },
  { category: "deportes", pattern: /\b(canchas?|futbol|padel|tenis|jugar|partido|deportes?|gimnasio|gym|yate|bote|paseo en)\b/ },
];

/** Interpretación sin IA: palabras clave. Devuelve null si no reconoce nada. */
export function interpretLocally(query: string, zones: string[]): SearchFilters | null {
  const q = normalizeText(query);
  if (!q) return null;

  const filters: SearchFilters = { ...EMPTY_FILTERS, terms: [] };

  for (const rule of CATEGORY_WORDS) {
    if (rule.pattern.test(q)) {
      filters.category = rule.category;
      break;
    }
  }

  // La zona más larga que aparezca en la frase (o su primera parte, antes de la coma)
  const zoneMatch = [...zones]
    .sort((a, b) => b.length - a.length)
    .find((zone) => {
      const full = normalizeText(zone);
      const head = normalizeText(zone.split(",")[0]);
      return q.includes(full) || (head.length >= 4 && q.includes(head));
    });
  if (zoneMatch) filters.zone = zoneMatch;

  if (/\b(hoy|ahora|ahorita|esta (tarde|noche|manana))\b/.test(q)) filters.today = true;

  const price = q.match(/(?:menos de|hasta|maximo|max|por debajo de|bajo)\s*(?:usd|\$|b\/\.?)?\s*(\d{1,5})/);
  if (price) filters.maxPrice = Number(price[1]);

  return hasAnyFilter(filters) ? filters : null;
}

/** Valida lo que devuelve el modelo: solo pasan valores conocidos. */
export function sanitizeFilters(raw: unknown, zones: string[]): SearchFilters {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const category =
    typeof obj.category === "string" && (CATEGORY_ORDER as string[]).includes(obj.category)
      ? (obj.category as BusinessCategory)
      : null;

  const zone =
    typeof obj.zone === "string"
      ? (zones.find((z) => normalizeText(z) === normalizeText(obj.zone as string)) ?? null)
      : null;

  const maxPrice =
    typeof obj.maxPrice === "number" && Number.isFinite(obj.maxPrice) && obj.maxPrice > 0
      ? Math.round(obj.maxPrice)
      : null;

  const terms = Array.isArray(obj.terms)
    ? obj.terms
        .filter((t): t is string => typeof t === "string")
        .map((t) => normalizeText(t).slice(0, 30))
        .filter((t) => t.length >= 2)
        .slice(0, 4)
    : [];

  return { category, zone, today: obj.today === true, maxPrice, terms };
}
