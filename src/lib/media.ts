import type { MediaKind } from "@/types/database";

/** Bucket de Supabase Storage donde vive la galería de los negocios. */
export const MEDIA_BUCKET = "business-media";

/** Límite por archivo (igual al del bucket). */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

type MediaFormat = { kind: MediaKind; contentType: string };

// La extensión manda: los navegadores no envían un tipo fiable para .glb.
const FORMATS: Record<string, MediaFormat> = {
  jpg: { kind: "image", contentType: "image/jpeg" },
  jpeg: { kind: "image", contentType: "image/jpeg" },
  png: { kind: "image", contentType: "image/png" },
  webp: { kind: "image", contentType: "image/webp" },
  mp4: { kind: "video", contentType: "video/mp4" },
  webm: { kind: "video", contentType: "video/webm" },
  glb: { kind: "model3d", contentType: "model/gltf-binary" },
};

export const MEDIA_ACCEPT = ".jpg,.jpeg,.png,.webp,.mp4,.webm,.glb";

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Foto",
  video: "Video",
  model3d: "Modelo 3D",
};

export function getMediaFormat(fileName: string): (MediaFormat & { extension: string }) | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMATS[extension];
  return format ? { ...format, extension } : null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Solo se aceptan URL públicas de nuestro bucket. */
export function isOwnMediaUrl(url: string, supabaseUrl: string): boolean {
  return url.startsWith(`${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`);
}
