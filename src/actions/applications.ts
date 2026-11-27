"use server";

import { revalidatePath } from "next/cache";
import { APPLICATION_LIMITS, applicationFolder, isApplicationPhotoUrl } from "@/lib/applications";
import { getAuthContext } from "@/lib/auth";
import { isBusinessCategory } from "@/lib/categories";
import { translateError } from "@/lib/errors";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationPhoto } from "@/types/database";

export type ApplicationActionResult = { ok: true } | { ok: false; error: string };

export type ApplicationInput = {
  businessName: string;
  category: string;
  zone: string;
  phone: string;
  mapsUrl: string;
  instagram: string;
  description: string;
  servicesText: string;
  photos: ApplicationPhoto[];
};

/** Envía la solicitud de quien tiene la sesión iniciada. Las fotos ya se subieron a su carpeta. */
export async function submitApplicationAction(input: ApplicationInput): Promise<ApplicationActionResult> {
  const { user, profile } = await getAuthContext();
  if (!user || !profile) return { ok: false, error: "Inicia sesión para enviar tu solicitud." };
  if (profile.role !== "customer") {
    return { ok: false, error: "Esta cuenta ya administra un negocio o es de administración." };
  }

  const L = APPLICATION_LIMITS;
  const name = input.businessName.trim();
  const description = input.description.trim();
  const servicesText = input.servicesText.trim();
  const instagram = input.instagram.trim().replace(/^@+/, "");
  const mapsUrl = input.mapsUrl.trim();

  if (name.length < 2 || name.length > 80) return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres." };
  if (!isBusinessCategory(input.category)) return { ok: false, error: "Elige una categoría." };
  if (input.zone.trim().length > 80) return { ok: false, error: "La zona es demasiado larga." };
  if (input.phone.trim().length < 7 || input.phone.trim().length > 30) {
    return { ok: false, error: "Escribe un teléfono de contacto." };
  }
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    return { ok: false, error: "El usuario de Instagram no parece válido." };
  }
  if (mapsUrl) {
    try {
      const url = new URL(mapsUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      return { ok: false, error: "El enlace de Google Maps no es válido." };
    }
  }
  if (description.length < L.descriptionMin || description.length > L.descriptionMax) {
    return { ok: false, error: `La descripción debe tener entre ${L.descriptionMin} y ${L.descriptionMax} caracteres.` };
  }
  if (servicesText.length < L.servicesMin || servicesText.length > L.servicesMax) {
    return { ok: false, error: `Describe tus servicios y precios (entre ${L.servicesMin} y ${L.servicesMax} caracteres).` };
  }
  if (input.photos.length < L.photosMin || input.photos.length > L.photosMax) {
    return { ok: false, error: `Sube entre ${L.photosMin} y ${L.photosMax} fotos.` };
  }

  const { url: supabaseUrl } = getSupabaseEnv();
  const folder = applicationFolder(user.id);
  const photos: ApplicationPhoto[] = [];
  for (const photo of input.photos) {
    if (!photo.path.startsWith(folder) || !isApplicationPhotoUrl(photo.url, photo.path, supabaseUrl)) {
      return { ok: false, error: "Una de las fotos no es válida. Vuelve a subirla." };
    }
    photos.push({ path: photo.path, url: photo.url });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("business_applications").insert({
    applicant_id: user.id,
    business_name: name,
    category: input.category,
    zone: input.zone.trim() || null,
    phone: input.phone.trim(),
    maps_url: mapsUrl || null,
    instagram: instagram || null,
    description,
    services_text: servicesText,
    photos,
  });

  if (error) {
    // 23505: ya hay una solicitud en revisión para esta cuenta.
    if (error.code === "23505") return { ok: false, error: "Ya tienes una solicitud en revisión." };
    return { ok: false, error: translateError(error.message) };
  }

  revalidatePath("/publicar");
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}

async function requireSuperAdmin(): Promise<boolean> {
  const { user, profile } = await getAuthContext();
  return Boolean(user && profile && profile.role === "super_admin");
}

/** Aprueba: crea el negocio (oculto), lo asigna a quien lo solicitó y pasa sus fotos a la galería. */
export async function approveApplicationAction(applicationId: string): Promise<ApplicationActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede aprobar solicitudes." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_approve_application", { p_application: applicationId });
  if (error) return { ok: false, error: error.message || "No se pudo aprobar la solicitud." };

  revalidatePath("/admin");
  revalidatePath("/admin/solicitudes");
  revalidatePath("/publicar");
  return { ok: true };
}

/** Rechaza con una nota que la persona verá, para que sepa qué corregir. */
export async function rejectApplicationAction(applicationId: string, note: string): Promise<ApplicationActionResult> {
  if (!(await requireSuperAdmin())) return { ok: false, error: "Solo el administrador puede revisar solicitudes." };

  const clean = note.trim();
  if (clean.length < 10) return { ok: false, error: "Explica en una frase qué debe corregir (mínimo 10 caracteres)." };
  if (clean.length > 500) return { ok: false, error: "La nota es demasiado larga (máximo 500 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_applications")
    .update({ status: "rejected", review_note: clean, reviewed_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, error: translateError(error.message) };
  if (!data || data.length === 0) return { ok: false, error: "Esa solicitud ya fue revisada." };

  revalidatePath("/admin/solicitudes");
  revalidatePath("/publicar");
  return { ok: true };
}
