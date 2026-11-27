import { MEDIA_BUCKET } from "@/lib/media";
import type { ApplicationPhoto, Json } from "@/types/database";

/** Límites de una solicitud. Coinciden con las restricciones de la tabla. */
export const APPLICATION_LIMITS = {
  descriptionMin: 80,
  descriptionMax: 600,
  servicesMin: 10,
  servicesMax: 600,
  photosMin: 3,
  photosMax: 8,
  photoMaxBytes: 5 * 1024 * 1024,
} as const;

export const APPLICATION_PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp";

/** Lo que revisa el administrador antes de aprobar. Se muestra a quien solicita y a quien revisa. */
export const QUALITY_RULES: { title: string; detail: string }[] = [
  {
    title: "Fotos reales de tu negocio",
    detail: "Tomadas en tu local o de tu trabajo. No aceptamos logos, flyers con texto, imágenes de banco ni generadas con IA.",
  },
  {
    title: "Fotos nítidas y con buena luz",
    detail: "Al menos 3: el espacio, el servicio en acción y un resultado. Sin marcas de agua ni collages.",
  },
  {
    title: "Descripción escrita por ti",
    detail: "Qué haces, para quién y qué te distingue, en tus palabras. Sin frases genéricas ni texto copiado.",
  },
  {
    title: "Servicios y precios claros",
    detail: "Lo que ofreces y cuánto cuesta. Si el precio varía, pon desde cuánto.",
  },
];

/** Carpeta del bucket donde cada persona sube las fotos de su solicitud. */
export function applicationFolder(userId: string): string {
  return `solicitudes/${userId}/`;
}

export function isApplicationPhotoUrl(url: string, path: string, supabaseUrl: string): boolean {
  return url === `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}

/** Lee la columna `photos` (JSON) y descarta lo que no tenga la forma esperada. */
export function parseApplicationPhotos(value: Json | null | undefined): ApplicationPhoto[] {
  if (!Array.isArray(value)) return [];
  const photos: ApplicationPhoto[] = [];
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const { path, url } = item as { path?: unknown; url?: unknown };
      if (typeof path === "string" && typeof url === "string") photos.push({ path, url });
    }
  }
  return photos;
}

export const APPLICATION_STATUS_LABELS = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "No aprobada",
} as const;
