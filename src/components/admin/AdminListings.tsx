"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  addBusinessMediaAction,
  createListingAction,
  deleteBusinessMediaAction,
  setCoverImageAction,
  type UploadedMedia,
} from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CATEGORIES, CATEGORY_ORDER, type BusinessCategory } from "@/lib/categories";
import {
  MAX_MEDIA_BYTES,
  MEDIA_ACCEPT,
  MEDIA_BUCKET,
  MEDIA_KIND_LABELS,
  formatBytes,
  getMediaFormat,
} from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { BusinessMediaRow } from "@/types/database";

export type AdminBusiness = {
  id: string;
  name: string;
  zone: string | null;
  category: BusinessCategory;
  plan: string;
  isActive: boolean;
  coverImageUrl: string | null;
  media: BusinessMediaRow[];
};

const selectClass =
  "h-12 w-full cursor-pointer appearance-none rounded-[14px] border border-white/[0.09] bg-[#1a1a1c] px-4 text-[15px] text-[#f5f5f7] outline-none transition duration-300 focus:border-white/25 focus:bg-[#222225]";

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-[#f5f5f7]/80">
      {children}
    </label>
  );
}

/** Sube archivos al bucket desde el navegador (con la sesión del admin) y los registra. */
function MediaManager({ business }: { business: AdminBusiness }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const upload = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setError(null);

    const rejected: string[] = [];
    const accepted = files.filter((file) => {
      if (!getMediaFormat(file.name)) {
        rejected.push(`${file.name}: formato no admitido`);
        return false;
      }
      if (file.size > MAX_MEDIA_BYTES) {
        rejected.push(`${file.name}: pesa ${formatBytes(file.size)} (máximo ${formatBytes(MAX_MEDIA_BYTES)})`);
        return false;
      }
      return true;
    });

    if (accepted.length === 0) {
      setError(rejected.join(" · "));
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const uploaded: UploadedMedia[] = [];
    const failed: string[] = [...rejected];

    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i];
      const format = getMediaFormat(file.name)!;
      setStatus(`Subiendo ${i + 1} de ${accepted.length}: ${file.name}`);
      const path = `${business.id}/${crypto.randomUUID()}.${format.extension}`;
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: format.contentType, cacheControl: "31536000" });
      if (uploadError) {
        failed.push(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      uploaded.push({ storagePath: path, url: data.publicUrl, title: file.name.replace(/\.[^.]+$/, "") });
    }

    if (uploaded.length > 0) {
      setStatus("Guardando…");
      const result = await addBusinessMediaAction(business.id, uploaded);
      if (!result.ok) failed.push(result.error);
    }

    setBusy(false);
    setStatus(uploaded.length > 0 && failed.length === 0 ? `${uploaded.length} archivo(s) agregado(s).` : null);
    setError(failed.length > 0 ? failed.join(" · ") : null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  const remove = async (media: BusinessMediaRow) => {
    setBusy(true);
    setError(null);
    const result = await deleteBusinessMediaAction(media.id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else setStatus("Archivo borrado.");
    router.refresh();
  };

  const makeCover = async (media: BusinessMediaRow) => {
    setBusy(true);
    setError(null);
    const result = await setCoverImageAction(business.id, media.url);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else setStatus("Portada actualizada.");
    router.refresh();
  };

  const inputId = `media-${business.id}`;

  return (
    <div className="mt-4 space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void upload(e.dataTransfer.files);
        }}
        className={`block cursor-pointer rounded-[16px] border border-dashed px-5 py-7 text-center transition-colors ${
          dragging ? "border-[#2997ff] bg-[#2997ff]/10" : "border-white/20 hover:border-white/40"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="block text-[15px] font-medium text-[#f5f5f7]">
          Arrastra archivos aquí o toca para elegirlos
        </span>
        <span className="mt-1 block text-[13px] text-[#86868b]">
          Fotos (JPG, PNG, WebP), videos (MP4, WebM) y modelos 3D (GLB). Hasta {formatBytes(MAX_MEDIA_BYTES)} cada uno.
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          disabled={busy}
          onChange={(e) => e.target.files && void upload(e.target.files)}
          className="sr-only"
        />
      </label>

      <div aria-live="polite" className="min-h-[18px] text-[13px]">
        {status && <p className="text-[#86868b]">{status}</p>}
        {error && <p className="text-[#ff6961]">{error}</p>}
      </div>

      {business.media.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[900px]:grid-cols-4">
          {business.media.map((media) => {
            const isCover = media.kind === "image" && media.url === business.coverImageUrl;
            return (
              <li key={media.id} className="overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#161618]">
                <div className="relative grid aspect-square place-items-center bg-black/40">
                  {media.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media.url} alt={media.title ?? "Foto"} loading="lazy" className="h-full w-full object-cover" />
                  ) : media.kind === "video" ? (
                    <video src={media.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-3 text-center text-[13px] text-[#86868b]">Modelo 3D</span>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-[#f5f5f7]">
                    {isCover ? "Portada" : MEDIA_KIND_LABELS[media.kind]}
                  </span>
                </div>
                <div className="space-y-2 p-2.5">
                  <p className="truncate text-[13px] text-[#f5f5f7]/85">{media.title ?? "Sin título"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                    {media.kind === "image" && !isCover && (
                      <button type="button" disabled={busy} onClick={() => void makeCover(media)} className="cursor-pointer text-[#2997ff] hover:underline disabled:opacity-50">
                        Usar de portada
                      </button>
                    )}
                    <button type="button" disabled={busy} onClick={() => void remove(media)} className="cursor-pointer text-[#ff6961] hover:underline disabled:opacity-50">
                      Borrar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AdminListings({ businesses }: { businesses: AdminBusiness[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [withService, setWithService] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    setError(null);

    startTransition(async () => {
      const result = await createListingAction({
        name: text("name"),
        category: text("category"),
        zone: text("zone"),
        phone: text("phone"),
        mapsUrl: text("mapsUrl"),
        amenities: text("amenities").split(","),
        plan: text("plan") === "pro" ? "pro" : "gratis",
        service: withService
          ? {
              name: text("serviceName"),
              price: Number(text("price")),
              slotDurationMinutes: Number(text("duration")),
              openTime: text("openTime"),
              closeTime: text("closeTime"),
            }
          : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      // Se abre la galería del negocio recién creado para subir sus archivos de una vez.
      setOpenId(result.data.businessId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <Card className="rounded-[24px] p-6 sm:p-8">
        <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">Agregar un negocio</h2>
        <p className="mt-1 text-[14px] text-[#86868b]">
          Se publica al guardar. Después podrás subir sus fotos, videos y modelos 3D.
        </p>

        <form ref={formRef} onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="name" name="name" label="Nombre del negocio" required maxLength={80} autoComplete="off" />
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <select id="category" name="category" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  Elige una categoría
                </option>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].label}
                  </option>
                ))}
              </select>
            </div>
            <Input id="zone" name="zone" label="Zona" placeholder="Costa del Este" maxLength={80} autoComplete="off" />
            <Input id="phone" name="phone" label="Teléfono" type="tel" inputMode="tel" placeholder="+507 6000-0000" autoComplete="off" />
            <Input id="mapsUrl" name="mapsUrl" label="Enlace de Google Maps" type="url" placeholder="https://maps.app.goo.gl/…" autoComplete="off" />
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <select id="plan" name="plan" defaultValue="gratis" className={selectClass}>
                <option value="gratis">Gratis</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
          <Input id="amenities" name="amenities" label="Amenidades" hint="Sepáralas con comas: Estacionamiento, Baños, Wi-Fi" autoComplete="off" />

          <div className="rounded-[16px] border border-white/[0.09] p-4">
            <label className="flex cursor-pointer items-center gap-3 text-[15px] text-[#f5f5f7]">
              <input type="checkbox" checked={withService} onChange={(e) => setWithService(e.target.checked)} className="h-5 w-5 accent-[#0071e3]" />
              Crear también su primer servicio, con horario todos los días
            </label>
            {withService && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[900px]:grid-cols-5">
                <div className="sm:col-span-2 min-[900px]:col-span-2">
                  <Input id="serviceName" name="serviceName" label="Servicio" placeholder="Cancha 1, Corte clásico…" required maxLength={80} autoComplete="off" />
                </div>
                <Input id="price" name="price" label="Precio (USD)" type="number" inputMode="decimal" min={0} step="0.01" required defaultValue={20} />
                <Input id="duration" name="duration" label="Turno (min)" type="number" inputMode="numeric" min={15} max={480} step={5} required defaultValue={60} />
                <div className="grid grid-cols-2 gap-3 sm:col-span-2 min-[900px]:col-span-1">
                  <Input id="openTime" name="openTime" label="Abre" type="time" required defaultValue="08:00" />
                  <Input id="closeTime" name="closeTime" label="Cierra" type="time" required defaultValue="22:00" />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-[14px] font-medium text-[#ff6961]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Publicar negocio"}
          </Button>
        </form>
      </Card>

      <section aria-labelledby="admin-negocios">
        <h2 id="admin-negocios" className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7]">
          Negocios ({businesses.length})
        </h2>
        <ul className="mt-4 space-y-3">
          {businesses.map((business) => {
            const open = openId === business.id;
            return (
              <li key={business.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold text-[#f5f5f7]">{business.name}</p>
                      <p className="mt-0.5 text-[13px] text-[#86868b]">
                        {[CATEGORIES[business.category].label, business.zone, business.plan === "pro" ? "Plan Pro" : "Plan Gratis", `${business.media.length} archivo(s)`, business.isActive ? null : "Inactivo"]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-[14px]">
                      <Link href={`/negocios/${business.id}`} className="text-[#2997ff] hover:underline">
                        Ver página
                      </Link>
                      <Button type="button" variant="secondary" size="sm" aria-expanded={open} onClick={() => setOpenId(open ? null : business.id)}>
                        {open ? "Cerrar galería" : "Galería"}
                      </Button>
                    </div>
                  </div>
                  {open && <MediaManager business={business} />}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
