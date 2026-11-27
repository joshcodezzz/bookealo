import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShieldIcon } from "@/components/ui/Icons";
import { AdminListings, type AdminBusiness } from "@/components/admin/AdminListings";
import { requireRole } from "@/lib/auth";
import { resolveCategory } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { parseAmenities, type BusinessMediaRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Administración",
};

export default async function AdminPage() {
  const { user, profile } = await requireRole(["super_admin"], "/admin");

  const supabase = await createClient();
  const [businessesRes, mediaRes, ownersRes] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, zone, phone, maps_url, category, plan, is_active, cover_image_url, amenities, owner_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("business_media")
      .select("id, business_id, kind, storage_path, url, title, position, created_at")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    // Si la función aún no existe en la base, simplemente no se muestran los correos.
    supabase.rpc("admin_business_owners"),
  ]);

  const ownerEmailByBusiness = new Map<string, string>(
    (ownersRes.data ?? []).map((o) => [o.business_id, o.owner_email]),
  );

  // Solicitudes de negocios pendientes de revisión (si la tabla aún no existe, cuenta 0).
  const { count: pendingCount } = await supabase
    .from("business_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  const pendingApplications = pendingCount ?? 0;

  const mediaByBusiness = new Map<string, BusinessMediaRow[]>();
  (mediaRes.data ?? []).forEach((m) => {
    const list = mediaByBusiness.get(m.business_id) ?? [];
    list.push(m);
    mediaByBusiness.set(m.business_id, list);
  });

  const adminBusinesses: AdminBusiness[] = (businessesRes.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    zone: b.zone,
    category: resolveCategory(b.category, b.name, ...parseAmenities(b.amenities)),
    plan: b.plan ?? "gratis",
    isActive: b.is_active,
    phone: b.phone,
    mapsUrl: b.maps_url,
    amenities: parseAmenities(b.amenities),
    hasOwner: Boolean(b.owner_id),
    ownerEmail: ownerEmailByBusiness.get(b.id) ?? null,
    coverImageUrl: b.cover_image_url,
    media: mediaByBusiness.get(b.id) ?? [],
  }));
  const loadError = businessesRes.error?.message ?? mediaRes.error?.message ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Administración de Bookealo"
        subtitle="Agrega, edita u oculta negocios y administra sus fotos, videos y modelos 3D."
      />

      {loadError && (
        <p role="alert" className="rounded-[14px] border border-[#ff6961]/40 px-4 py-3 text-[14px] text-[#ff6961]">
          No se pudo cargar todo: {loadError}
        </p>
      )}

      {pendingApplications > 0 && (
        <Link
          href="/admin/solicitudes"
          className="block rounded-[16px] border border-[#ff9f0a]/30 bg-[rgba(255,159,10,0.1)] px-5 py-3.5 text-[15px] text-[#ffb340] hover:bg-[rgba(255,159,10,0.16)]"
        >
          {pendingApplications === 1
            ? "Hay 1 solicitud de negocio por revisar."
            : `Hay ${pendingApplications} solicitudes de negocio por revisar.`}{" "}
          <span className="underline underline-offset-2">Revisar</span>
        </Link>
      )}

      <AdminListings businesses={adminBusinesses} />

      <Card className="max-w-2xl rounded-[24px] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[#1a1a1c] text-[#34c470]">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#f5f5f7]">
                Lo demás se administra en Supabase
              </h2>
              <Badge tone="confirmed">super_admin</Badge>
            </div>
            <p className="text-[14px] leading-relaxed text-[#86868b]">
              Cambiar el rol de un usuario (por ejemplo, nombrar otro
              administrador) se sigue haciendo desde el panel de Supabase.
            </p>
            <p className="text-[12px] text-[rgba(245,245,247,0.44)]">
              Sesión activa: {profile.full_name || user.email} ({user.email})
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/solicitudes"
            className="bk-tx inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1c] px-6 text-[14px] font-medium text-[#f5f5f7] hover:bg-[#222225]"
          >
            Solicitudes{pendingApplications > 0 ? ` (${pendingApplications})` : ""}
          </Link>
          <Link
            href="/admin/recordatorios"
            className="bk-tx inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1c] px-6 text-[14px] font-medium text-[#f5f5f7] hover:bg-[#222225]"
          >
            Recordatorios
          </Link>
          <Link
            href="/"
            className="bk-tx inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-[#1a1a1c] px-6 text-[14px] font-medium text-[#f5f5f7] hover:bg-[#222225]"
          >
            Ver negocios públicos
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="danger">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
