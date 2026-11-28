/**
 * Categorías de Bookealo.
 *
 * Fuente de verdad: la columna `businesses.category` (ver supabase/migrations). Mientras un
 * negocio no la tenga, se deduce por palabras clave de su nombre y amenidades.
 */
export type BusinessCategory =
  | "talents"
  | "mandaos"
  | "belleza"
  | "bienestar"
  | "hogar"
  | "limpieza"
  | "deportes"
  | "clases"
  | "mascotas";

/** Orden en el que se muestran (el mismo de la cuadrícula de categorías) */
export const CATEGORY_ORDER: BusinessCategory[] = [
  "talents",
  "mandaos",
  "belleza",
  "bienestar",
  "hogar",
  "limpieza",
  "deportes",
  "clases",
  "mascotas",
];

type CategoryInfo = {
  label: string;
  /** Sustantivo para el conteo real: "1 espacio", "4 espacios" */
  unit: [singular: string, plural: string];
  /** Qué es, en una línea; se usa cuando todavía no hay nadie publicado */
  blurb: string;
  /** Líneas nuevas de Bookealo, marcadas con una etiqueta */
  isNew?: boolean;
};

export const CATEGORIES: Record<BusinessCategory, CategoryInfo> = {
  talents: {
    label: "Bookealo Talents",
    unit: ["talento", "talentos"],
    blurb: "Freelancers: pianistas, detailing, limpieza de casas y más",
    isNew: true,
  },
  mandaos: {
    label: "Manda'os",
    unit: ["servicio", "servicios"],
    blurb: "Alguien que te busca y te trae lo que necesitas",
    isNew: true,
  },
  belleza: { label: "Belleza y Estilo", unit: ["negocio", "negocios"], blurb: "Barberías, salones y uñas" },
  bienestar: { label: "Bienestar y Spa", unit: ["espacio", "espacios"], blurb: "Spas, masajes, yoga y pilates" },
  hogar: { label: "Hogar y Reparaciones", unit: ["técnico", "técnicos"], blurb: "Plomería, electricidad, aire acondicionado" },
  limpieza: { label: "Limpieza", unit: ["proveedor", "proveedores"], blurb: "Casas, oficinas, alfombras y más" },
  deportes: { label: "Deportes y Espacios", unit: ["espacio", "espacios"], blurb: "Canchas, pádel, clubes y alquiler de espacios" },
  clases: { label: "Clases y Tutorías", unit: ["profesor", "profesores"], blurb: "Idiomas, música, refuerzo escolar" },
  mascotas: { label: "Mascotas", unit: ["servicio", "servicios"], blurb: "Grooming, paseos, veterinaria" },
};

/** Compatibilidad: nombre corto de cada categoría */
export const CATEGORY_LABELS: Record<BusinessCategory, string> = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, CATEGORIES[c].label]),
) as Record<BusinessCategory, string>;

export function categoryCountLabel(category: BusinessCategory, count: number): string {
  const [one, many] = CATEGORIES[category].unit;
  return `${count} ${count === 1 ? one : many}`;
}

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === "string" && (CATEGORY_ORDER as string[]).includes(value);
}

// El orden importa: lo más específico primero.
const RULES: { category: BusinessCategory; pattern: RegExp }[] = [
  { category: "mandaos", pattern: /\b(mandad|manda'?os|recado|encargo|mensajer|delivery)/i },
  { category: "talents", pattern: /\b(freelanc|pianist|piano|m[uú]sic|dj|fot[oó]graf|detailing|chef|bartender|animador|talent)/i },
  { category: "clases", pattern: /\b(clases?|tutor|profesor|academ|escuela|curso|idioma|ingl[eé]s)/i },
  { category: "mascotas", pattern: /\b(mascota|pets?|perr|gat[oa]s?|veterinar|grooming|canin)/i },
  { category: "limpieza", pattern: /\b(limpieza|cleaning|lavander|aseo)/i },
  { category: "hogar", pattern: /\b(plomer|electric|carpinter|reparaci|handyman|pintor|cerrajer|hogar|aire acondicionado)/i },
  { category: "belleza", pattern: /\b(barber|hair|sal[oó]n|nails|u[ñn]as|beauty|belleza|est[eé]tica|peluquer|maquillaje|makeup)/i },
  { category: "bienestar", pattern: /\b(spa|masaje|massage|yoga|pilates|wellness|bienestar|meditaci|fisio)/i },
  { category: "deportes", pattern: /\b(soccer|f[uú]tbol|futsal|cancha|p[aá]del|tenis|tennis|sport|deport|gym|gimnasio|fitness|crossfit|club|yacht|yachty|yate|boat|bote|charter)/i },
];

/**
 * Categoría de un negocio: la guardada en la base si existe; si no, por palabras clave.
 * Sin coincidencias cae en "deportes", el origen de Bookealo (canchas por horario).
 */
export function resolveCategory(
  stored: string | null | undefined,
  ...texts: (string | null | undefined)[]
): BusinessCategory {
  if (isBusinessCategory(stored)) return stored;
  const haystack = texts.filter(Boolean).join(" ");
  for (const rule of RULES) {
    if (rule.pattern.test(haystack)) return rule.category;
  }
  return "deportes";
}

/** Alias usado por componentes que solo tienen texto */
export function detectCategory(...texts: (string | null | undefined)[]): BusinessCategory {
  return resolveCategory(null, ...texts);
}

/**
 * Ilustración de respaldo: dentro de algunas categorías hay un dibujo más específico
 * (cancha de fútbol, raqueta, tijeras, velero).
 */
export type ArtKind = BusinessCategory | "futbol" | "padel" | "barberia" | "yate";

export function resolveArtKind(category: BusinessCategory, ...texts: (string | null | undefined)[]): ArtKind {
  const t = texts.filter(Boolean).join(" ");
  if (category === "deportes") {
    if (/\b(yacht|yachty|yate|boat|bote|charter|velero)/i.test(t)) return "yate";
    if (/\b(p[aá]del|tenis|tennis|squash|pickleball)/i.test(t)) return "padel";
    if (/\b(soccer|f[uú]tbol|futsal|cancha)/i.test(t)) return "futbol";
  }
  if (category === "belleza" && /\b(barber)/i.test(t)) return "barberia";
  return category;
}

/** Grupos para mostrar las 9 categorías en bloques de tres, que se leen más rápido que nueve iguales. */
export const CATEGORY_GROUPS: { title: string; categories: BusinessCategory[] }[] = [
  { title: "Para ti", categories: ["belleza", "bienestar", "deportes"] },
  { title: "Para tu casa", categories: ["hogar", "limpieza", "mascotas"] },
  { title: "A tu medida", categories: ["clases", "talents", "mandaos"] },
];

/** Cuántas categorías se muestran en la portada antes de «Ver todas». */
export const FEATURED_CATEGORY_COUNT = 4;
