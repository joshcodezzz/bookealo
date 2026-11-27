"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveApplicationAction, rejectApplicationAction } from "@/actions/applications";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { APPLICATION_STATUS_LABELS, QUALITY_RULES } from "@/lib/applications";
import type { ApplicationPhoto, ApplicationStatus } from "@/types/database";

export type AdminApplication = {
  id: string;
  status: ApplicationStatus;
  businessName: string;
  categoryLabel: string;
  zone: string | null;
  phone: string | null;
  mapsUrl: string | null;
  instagram: string | null;
  description: string;
  servicesText: string;
  photos: ApplicationPhoto[];
  reviewNote: string | null;
  createdLabel: string;
};

function ApplicationCard({ application }: { application: AdminApplication }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = application.status === "pending";
  const noteId = `note-${application.id}`;

  const approve = async () => {
    setBusy("approve");
    setError(null);
    const result = await approveApplicationAction(application.id);
    setBusy(null);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const reject = async () => {
    setBusy("reject");
    setError(null);
    const result = await rejectApplicationAction(application.id, note);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Card className="rounded-[24px] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">{application.businessName}</h3>
          <p className="mt-0.5 text-[13px] text-[#86868b]">
            {[application.categoryLabel, application.zone, `enviada el ${application.createdLabel}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${
            application.status === "approved"
              ? "border-[#34c470]/45 text-[#34c470]"
              : application.status === "rejected"
                ? "border-white/20 text-[#86868b]"
                : "border-[#ff9f0a]/45 text-[#ff9f0a]"
          }`}
        >
          {APPLICATION_STATUS_LABELS[application.status]}
        </span>
      </div>

      {application.photos.length > 0 ? (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {application.photos.map((photo, index) => (
            <li key={photo.path} className="overflow-hidden rounded-[14px] border border-white/[0.09] bg-black/40">
              <a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${index + 1} en tamaño completo`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${index + 1} de ${application.businessName}`} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-[14px] text-[#ff9f0a]">Esta solicitud no tiene fotos válidas.</p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
        <div>
          <h4 className="text-[13px] font-medium text-[#86868b]">Descripción</h4>
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.5] text-[#f5f5f7]/90">{application.description}</p>
        </div>
        <div>
          <h4 className="text-[13px] font-medium text-[#86868b]">Servicios y precios</h4>
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.5] text-[#f5f5f7]/90">{application.servicesText}</p>
        </div>
      </div>

      <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#86868b]">
        {application.phone && <span>Tel. {application.phone}</span>}
        {application.instagram && (
          <a href={`https://www.instagram.com/${application.instagram}/`} target="_blank" rel="noopener noreferrer" className="text-[#2997ff] hover:underline">
            Instagram: @{application.instagram}
          </a>
        )}
        {application.mapsUrl && (
          <a href={application.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#2997ff] hover:underline">
            Ver en Google Maps
          </a>
        )}
      </p>

      {application.status === "rejected" && application.reviewNote && (
        <p className="mt-4 text-[14px] text-[#86868b]">Nota enviada: {application.reviewNote}</p>
      )}

      {pending && (
        <div className="mt-6 border-t border-white/[0.09] pt-5">
          {rejecting ? (
            <div className="space-y-3">
              <label htmlFor={noteId} className="block text-[13px] font-medium text-[#f5f5f7]/80">
                Qué debe corregir (la persona verá esta nota)
              </label>
              <textarea
                id={noteId}
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej.: Las fotos 2 y 3 son flyers con texto. Súbelas de tu local o de tu trabajo."
                className="w-full resize-y rounded-[14px] border border-white/[0.09] bg-[#1a1a1c] px-4 py-3 text-[15px] leading-[1.5] text-[#f5f5f7] placeholder-[#86868b] outline-none focus:border-white/25"
              />
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="danger" size="sm" disabled={busy !== null} onClick={() => void reject()}>
                  {busy === "reject" ? "Enviando…" : "No aprobar y enviar nota"}
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy !== null} onClick={() => setRejecting(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" disabled={busy !== null} onClick={() => void approve()}>
                {busy === "approve" ? "Aprobando…" : "Aprobar"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setRejecting(true)}>
                No aprobar
              </Button>
              <p className="basis-full text-[13px] text-[#86868b]">
                Al aprobar se crea el negocio oculto y se asigna a quien lo solicitó. Publícalo desde Administración
                cuando tenga sus servicios y horarios.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-[14px] font-medium text-[#ff6961]">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminApplications({ applications }: { applications: AdminApplication[] }) {
  const pending = applications.filter((a) => a.status === "pending");
  const reviewed = applications.filter((a) => a.status !== "pending");

  return (
    <div className="space-y-8">
      <Card className="rounded-[24px] p-5 sm:p-7">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Criterios para aprobar</h2>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 min-[900px]:grid-cols-2">
          {QUALITY_RULES.map((rule) => (
            <li key={rule.title} className="text-[14px] leading-[1.45] text-[#86868b]">
              <span className="font-medium text-[#f5f5f7]">{rule.title}.</span> {rule.detail}
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="solicitudes-pendientes">
        <h2 id="solicitudes-pendientes" className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
          Por revisar ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-[15px] text-[#86868b]">No hay solicitudes pendientes.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map((a) => (
              <li key={a.id}>
                <ApplicationCard application={a} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section aria-labelledby="solicitudes-revisadas">
          <h2 id="solicitudes-revisadas" className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
            Revisadas ({reviewed.length})
          </h2>
          <ul className="mt-4 space-y-4">
            {reviewed.map((a) => (
              <li key={a.id}>
                <ApplicationCard application={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
