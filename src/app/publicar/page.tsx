import type { Metadata } from "next";
import Link from "next/link";
import { ApplicationForm } from "@/components/applications/ApplicationForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { APPLICATION_STATUS_LABELS, QUALITY_RULES } from "@/lib/applications";
import { getAuthContext } from "@/lib/auth";
import { formatPanamaDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Publica tu negocio",
  description: "Aparece gratis en Bookealo. Revisamos cada negocio a mano para mantener la calidad.",
};

function QualityRules() {
  return (
    <Card className="rounded-[24px] p-6 sm:p-8">
      <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Lo que revisamos</h2>
      <p className="mt-1 text-[14px] text-[#86868b]">
        Una persona revisa cada solicitud. Si algo no cumple, te decimos qué corregir.
      </p>
      <ol className="mt-5 space-y-4">
        {QUALITY_RULES.map((rule, index) => (
          <li key={rule.title} className="flex gap-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-[#f5f5f7] tabular-nums">
              {index + 1}
            </span>
            <div>
              <p className="text-[15px] font-medium text-[#f5f5f7]">{rule.title}</p>
              <p className="mt-0.5 text-[14px] leading-[1.45] text-[#86868b]">{rule.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function PublicarPage() {
  const { user, profile } = await getAuthContext();

  const header = (
    <PageHeader
      eyebrow="Para negocios"
      title="Publica tu negocio"
      subtitle="Aparecer en Bookealo es gratis. Revisamos cada negocio a mano para que todo lo que se vea aquí sea real y esté bien presentado."
    />
  );

  // Sin sesión: se explica el proceso y se pide crear una cuenta, que será la del dueño.
  if (!user || !profile) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-2">
          <QualityRules />
          <Card className="rounded-[24px] p-6 sm:p-8">
            <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Empieza con tu cuenta</h2>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#86868b]">
              La solicitud se envía desde una cuenta de Bookealo. Si la aprobamos, esa misma cuenta pasa a ser la del
              dueño y desde ella administrarás servicios, horarios y reservas.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/registro?next=%2Fpublicar" className="bk-pill">
                Crear cuenta
              </Link>
              <Link href="/login?next=%2Fpublicar" className="bk-pill bk-pill-outline">
                Ya tengo cuenta
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (profile.role !== "customer") {
    return (
      <div className="space-y-6">
        {header}
        <Card className="max-w-2xl rounded-[24px] p-6 sm:p-8">
          <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
            {profile.role === "business_owner" ? "Tu cuenta ya administra un negocio" : "Esta es una cuenta de administración"}
          </h2>
          <p className="mt-2 text-[15px] leading-[1.5] text-[#86868b]">
            {profile.role === "business_owner"
              ? "Por ahora cada cuenta administra un solo negocio. Para publicar otro, usa una cuenta distinta."
              : "Las solicitudes se revisan desde el panel de administración."}
          </p>
          <Link href={profile.role === "business_owner" ? "/panel" : "/admin/solicitudes"} className="bk-pill mt-6 inline-flex">
            {profile.role === "business_owner" ? "Ir a mi panel" : "Ver solicitudes"}
          </Link>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: latest, error } = await supabase
    .from("business_applications")
    .select("id, status, business_name, review_note, created_at")
    .eq("applicant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const pending = latest?.status === "pending";

  return (
    <div className="space-y-6">
      {header}

      {error && (
        <p role="alert" className="rounded-[14px] border border-[#ff6961]/40 px-4 py-3 text-[14px] text-[#ff6961]">
          No pudimos cargar el estado de tu solicitud. Recarga la página.
        </p>
      )}

      {latest && (
        <Card className="rounded-[24px] p-6 sm:p-8">
          <p className="text-[13px] font-medium text-[#86868b]">
            Solicitud de {latest.business_name} · enviada el {formatPanamaDate(latest.created_at)}
          </p>
          <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#f5f5f7]">
            {APPLICATION_STATUS_LABELS[latest.status]}
          </h2>
          <p className="mt-2 text-[15px] leading-[1.5] text-[#86868b]">
            {pending
              ? "La estamos revisando. Cuando haya una respuesta la verás aquí."
              : latest.status === "rejected"
                ? "Corrige lo que se indica abajo y envíala de nuevo."
                : "Tu negocio fue aprobado."}
          </p>
          {latest.status === "rejected" && latest.review_note && (
            <p className="mt-4 rounded-[14px] border border-[#ff9f0a]/30 bg-[rgba(255,159,10,0.1)] px-4 py-3 text-[15px] leading-[1.5] text-[#ffb340]">
              {latest.review_note}
            </p>
          )}
        </Card>
      )}

      {!pending && (
        <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[1fr_1.4fr]">
          <QualityRules />
          <Card className="rounded-[24px] p-6 sm:p-8">
            <h2 className="mb-5 text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Tu solicitud</h2>
            <ApplicationForm userId={user.id} />
          </Card>
        </div>
      )}
    </div>
  );
}
