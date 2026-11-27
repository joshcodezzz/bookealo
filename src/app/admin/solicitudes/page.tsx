import type { Metadata } from "next";
import Link from "next/link";
import { AdminApplications, type AdminApplication } from "@/components/admin/AdminApplications";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { parseApplicationPhotos } from "@/lib/applications";
import { requireRole } from "@/lib/auth";
import { CATEGORIES, isBusinessCategory } from "@/lib/categories";
import { formatPanamaDate } from "@/lib/dates";
import { MEDIA_BUCKET } from "@/lib/media";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Solicitudes",
};

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function AdminSolicitudesPage() {
  await requireRole(["super_admin"], "/admin/solicitudes");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_applications")
    .select(
      "id, applicant_id, status, business_name, category, zone, phone, maps_url, instagram, description, services_text, photos, review_note, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  // Solo se muestran fotos que estén en nuestro bucket y en la carpeta de quien solicitó.
  const publicPrefix = `${getSupabaseEnv().url.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;

  const applications: AdminApplication[] = (data ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    businessName: row.business_name,
    categoryLabel: isBusinessCategory(row.category) ? CATEGORIES[row.category].label : row.category,
    zone: row.zone,
    phone: row.phone,
    mapsUrl: safeHttpUrl(row.maps_url),
    instagram: row.instagram && /^[A-Za-z0-9._]{1,30}$/.test(row.instagram) ? row.instagram : null,
    description: row.description,
    servicesText: row.services_text,
    photos: parseApplicationPhotos(row.photos).filter(
      (photo) =>
        photo.path.startsWith(`solicitudes/${row.applicant_id}/`) && photo.url === `${publicPrefix}${photo.path}`,
    ),
    reviewNote: row.review_note,
    createdLabel: formatPanamaDate(row.created_at),
  }));

  return (
    <div className="space-y-6">
      <Link href="/admin" className="bk-tx inline-flex items-center gap-1.5 text-[14px] text-[#86868b] hover:text-[#f5f5f7]">
        <ChevronLeftIcon className="h-4 w-4" />
        Administración
      </Link>
      <PageHeader
        eyebrow="Super Admin"
        title="Solicitudes de negocios"
        subtitle="Revisa cada negocio antes de que aparezca en Bookealo."
      />
      {error && (
        <p role="alert" className="rounded-[14px] border border-[#ff6961]/40 px-4 py-3 text-[14px] text-[#ff6961]">
          No se pudieron cargar las solicitudes: {error.message}
        </p>
      )}
      <AdminApplications applications={applications} />
    </div>
  );
}
