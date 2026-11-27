"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { isBusinessCategory } from "@/lib/categories";
import { translateError } from "@/lib/errors";
import { MEDIA_BUCKET, getMediaFormat, isOwnMediaUrl } from "@/lib/media";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { MediaKind } from "@/types/database";

export type AdminActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type NewListingInput = {
  name: string;
  category: string;
  zone: string;
  phone: string;
  mapsUrl: string;
  amenities: string[];
  plan: "gratis" | "pro";
  /** Servicio inicial opcional, con el mismo horario todos los días */
  service: {
    name: string;
    price: number;
    slotDurationMinutes: number;
    openTime: string; // HH:MM
    closeTime: string; // HH:MM
  } | null;
};

async function requireSuperAdmin() {
  const { user, profile } = await getAuthContext();
  if (!user || !profile || profile.role !== "super_admin") return null;
  return user;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ListingDetailsInput = Omit<NewListingInput, "service">;

function validateListing(input: ListingDetailsInput & { service?: NewListingInput["service"] }): string | null {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return "El nombre debe tener entre 2 y 80 caracteres.";
  if (!isBusinessCategory(input.category)) return "Elige una categoría.";
  if (input.zone.trim().length > 80) return "La zona es demasiado larga.";
  if (input.mapsUrl.trim()) {
    try {
      const url = new URL(input.mapsUrl.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      return "El enlace de Google Maps no es válido.";
    }
  }
  if (input.plan !== "gratis" && input.plan !== "pro") return "Plan inválido.";
  if (input.service) {
    const s = input.service;
    if (s.name.trim().length < 2 || s.name.trim().length > 80) return "El nombre del servicio debe tener entre 2 y 80 caracteres.";
    if (!Number.isFinite(s.price) || s.price < 0) return "Ingresa un precio válido (0 o mayor).";
    if (!Number.isInteger(s.slotDurationMinutes) || s.slotDurationMinutes < 15 || s.slotDurationMinutes > 480) {
      return "La duración del turno debe estar entre 15 y 480 minutos.";
    }
    if (!TIME_RE.test(s.openTime) || !TIME_RE.test(s.closeTime) || s.openTime >= s.closeTime) {
      return "Revisa el horario: la apertura debe ser antes del cierre.";
    }
  }
  return null;
}

/** Crea el negocio y, si se indicó, su primer servicio con horario los 7 días. */
export async function createListingAction(
  input: NewListingInput,
): Promise<AdminActionResult<{ businessId: string }>> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede crear negocios." };

  const validation = validateListing(input);
  if (validation) return { ok: false, error: validation };

  const supabase = await createClient();
  const amenities = input.amenities.map((a) => a.trim().slice(0, 40)).filter(Boolean).slice(0, 12);

  const { data: business, error } = await supabase
    .from("businesses")
    .insert({
      name: input.name.trim(),
      category: input.category,
      zone: input.zone.trim() || null,
      phone: input.phone.trim() || null,
      maps_url: input.mapsUrl.trim() || null,
      amenities,
      plan: input.plan,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !business) return { ok: false, error: translateError(error?.message ?? "No se pudo crear el negocio.") };

  if (input.service) {
    const s = input.service;
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .insert({
        business_id: business.id,
        name: s.name.trim(),
        price: s.price,
        slot_duration_minutes: s.slotDurationMinutes,
        is_active: true,
      })
      .select("id")
      .single();

    if (serviceError || !service) {
      return { ok: false, error: `El negocio se creó, pero el servicio no: ${translateError(serviceError?.message ?? "")}` };
    }

    const { error: scheduleError } = await supabase.from("schedules").insert(
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        service_id: service.id,
        day_of_week: day,
        open_time: `${s.openTime}:00`,
        close_time: `${s.closeTime}:00`,
        is_closed: false,
      })),
    );
    if (scheduleError) {
      return { ok: false, error: `El negocio y el servicio se crearon, pero el horario no: ${translateError(scheduleError.message)}` };
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true, data: { businessId: business.id } };
}

export type UploadedMedia = { storagePath: string; url: string; title: string };

/** Registra archivos que el navegador ya subió al bucket. La primera foto pasa a ser la portada si no hay una. */
export async function addBusinessMediaAction(
  businessId: string,
  items: UploadedMedia[],
): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede subir archivos." };
  if (items.length === 0 || items.length > 20) return { ok: false, error: "Sube entre 1 y 20 archivos a la vez." };

  const { url: supabaseUrl } = getSupabaseEnv();
  const rows: { business_id: string; kind: MediaKind; storage_path: string; url: string; title: string | null }[] = [];

  for (const item of items) {
    const format = getMediaFormat(item.storagePath);
    if (!format || !item.storagePath.startsWith(`${businessId}/`) || !isOwnMediaUrl(item.url, supabaseUrl)) {
      return { ok: false, error: "Uno de los archivos no es válido." };
    }
    rows.push({
      business_id: businessId,
      kind: format.kind,
      storage_path: item.storagePath,
      url: item.url,
      title: item.title.trim().slice(0, 120) || null,
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("business_media").insert(rows);
  if (error) return { ok: false, error: translateError(error.message) };

  const firstImage = rows.find((r) => r.kind === "image");
  if (firstImage) {
    const { data: current } = await supabase.from("businesses").select("cover_image_url").eq("id", businessId).maybeSingle();
    if (current && !current.cover_image_url) {
      await supabase.from("businesses").update({ cover_image_url: firstImage.url }).eq("id", businessId);
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/negocios/${businessId}`);
  return { ok: true };
}

export async function deleteBusinessMediaAction(mediaId: string): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede borrar archivos." };

  const supabase = await createClient();
  const { data: media, error: findError } = await supabase
    .from("business_media")
    .select("id, business_id, storage_path, url")
    .eq("id", mediaId)
    .maybeSingle();
  if (findError || !media) return { ok: false, error: "No encontramos ese archivo." };

  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([media.storage_path]);
  if (storageError) return { ok: false, error: translateError(storageError.message) };

  const { error } = await supabase.from("business_media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: translateError(error.message) };

  // Si era la portada, se quita para que no quede un enlace roto.
  await supabase.from("businesses").update({ cover_image_url: null }).eq("id", media.business_id).eq("cover_image_url", media.url);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/negocios/${media.business_id}`);
  return { ok: true };
}

export async function setCoverImageAction(businessId: string, url: string): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede cambiar la portada." };
  const { url: supabaseUrl } = getSupabaseEnv();
  if (!isOwnMediaUrl(url, supabaseUrl)) return { ok: false, error: "Imagen inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("businesses").update({ cover_image_url: url }).eq("id", businessId);
  if (error) return { ok: false, error: translateError(error.message) };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/negocios/${businessId}`);
  return { ok: true };
}

/** Edita los datos de un negocio existente. No toca servicios, horarios ni reservas. */
export async function updateListingAction(
  businessId: string,
  input: ListingDetailsInput,
): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede editar negocios." };

  const validation = validateListing(input);
  if (validation) return { ok: false, error: validation };

  const supabase = await createClient();
  const amenities = input.amenities.map((a) => a.trim().slice(0, 40)).filter(Boolean).slice(0, 12);

  const { data, error } = await supabase
    .from("businesses")
    .update({
      name: input.name.trim(),
      category: input.category,
      zone: input.zone.trim() || null,
      phone: input.phone.trim() || null,
      maps_url: input.mapsUrl.trim() || null,
      amenities,
      plan: input.plan,
    })
    .eq("id", businessId)
    .select("id");

  if (error) return { ok: false, error: translateError(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese negocio." };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/negocios/${businessId}`);
  return { ok: true };
}

/** Oculta o vuelve a publicar un negocio. Al ocultarlo no se borra nada: reservas y archivos se conservan. */
export async function setListingActiveAction(businessId: string, isActive: boolean): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede cambiar esto." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({ is_active: isActive })
    .eq("id", businessId)
    .select("id");

  if (error) return { ok: false, error: translateError(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "No encontramos ese negocio." };

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/negocios/${businessId}`);
  return { ok: true };
}

/** Asigna como dueño a la cuenta con ese correo; con el correo vacío, deja el negocio sin dueño. */
export async function assignOwnerAction(businessId: string, email: string): Promise<AdminActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede asignar dueños." };

  const clean = email.trim().toLowerCase();
  if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, error: "Ese correo no parece válido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_assign_owner", { p_business: businessId, p_email: clean });
  if (error) {
    // PGRST202: la función todavía no existe en la base de datos.
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      return { ok: false, error: "Falta aplicar un cambio en la base de datos para asignar dueños desde aquí." };
    }
    return { ok: false, error: error.message || "No se pudo asignar el dueño." };
  }

  revalidatePath("/admin");
  revalidatePath(`/negocios/${businessId}`);
  return { ok: true };
}
