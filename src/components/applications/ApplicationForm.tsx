"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { submitApplicationAction } from "@/actions/applications";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { APPLICATION_LIMITS, APPLICATION_PHOTO_ACCEPT, applicationFolder } from "@/lib/applications";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { MEDIA_BUCKET, formatBytes, getMediaFormat } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { ApplicationPhoto } from "@/types/database";

const fieldClass =
  "w-full rounded-[14px] border border-white/[0.09] bg-[#1a1a1c] px-4 text-[15px] text-[#f5f5f7] placeholder-[#86868b] outline-none transition duration-300 focus:border-white/25 focus:bg-[#222225]";

const L = APPLICATION_LIMITS;

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  return (
    <span className={`tabular-nums ${ok ? "text-[#86868b]" : "text-[#ff9f0a]"}`}>
      {value}/{max}
      {value < min ? ` · faltan ${min - value}` : ""}
    </span>
  );
}

/** Formulario de solicitud: sube las fotos a la carpeta de la persona y envía los datos a revisión. */
export function ApplicationForm({ userId }: { userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<ApplicationPhoto[]>([]);
  const [description, setDescription] = useState("");
  const [servicesText, setServicesText] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const addPhotos = async (fileList: FileList) => {
    const files = Array.from(fileList);
    setPhotoError(null);
    const room = L.photosMax - photos.length;
    if (room <= 0) {
      setPhotoError(`Ya tienes ${L.photosMax} fotos, que es el máximo.`);
      return;
    }

    const problems: string[] = [];
    const accepted = files.slice(0, room).filter((file) => {
      const format = getMediaFormat(file.name);
      if (!format || format.kind !== "image") {
        problems.push(`${file.name}: solo JPG, PNG o WebP`);
        return false;
      }
      if (file.size > L.photoMaxBytes) {
        problems.push(`${file.name}: pesa ${formatBytes(file.size)} (máximo ${formatBytes(L.photoMaxBytes)})`);
        return false;
      }
      return true;
    });
    if (files.length > room) problems.push(`Solo caben ${room} foto(s) más.`);

    const supabase = createClient();
    const added: ApplicationPhoto[] = [];
    for (let i = 0; i < accepted.length; i += 1) {
      const file = accepted[i];
      const format = getMediaFormat(file.name)!;
      setUploading(`Subiendo ${i + 1} de ${accepted.length}…`);
      const path = `${applicationFolder(userId)}${crypto.randomUUID()}.${format.extension}`;
      const { error: uploadError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(path, file, { contentType: format.contentType, cacheControl: "31536000" });
      if (uploadError) {
        problems.push(`${file.name}: ${uploadError.message}`);
        continue;
      }
      added.push({ path, url: supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl });
    }

    setUploading(null);
    if (added.length > 0) setPhotos((current) => [...current, ...added]);
    setPhotoError(problems.length > 0 ? problems.join(" · ") : null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    setError(null);

    if (photos.length < L.photosMin) {
      setError(`Sube al menos ${L.photosMin} fotos reales de tu negocio.`);
      return;
    }

    setSubmitting(true);
    const result = await submitApplicationAction({
      businessName: text("businessName"),
      category: text("category"),
      zone: text("zone"),
      phone: text("phone"),
      mapsUrl: text("mapsUrl"),
      instagram: text("instagram"),
      description,
      servicesText,
      photos,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const busy = submitting || uploading !== null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input id="businessName" name="businessName" label="Nombre del negocio" required minLength={2} maxLength={80} autoComplete="organization" />
        <div className="space-y-2">
          <label htmlFor="category" className="block text-[13px] font-medium text-[#f5f5f7]/80">
            Categoría
          </label>
          <select id="category" name="category" required defaultValue="" className={`${fieldClass} h-12 cursor-pointer appearance-none`}>
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
        <Input id="zone" name="zone" label="Zona" placeholder="Costa del Este" maxLength={80} autoComplete="address-level2" />
        <Input id="phone" name="phone" label="Teléfono o WhatsApp" type="tel" inputMode="tel" placeholder="+507 6000-0000" required minLength={7} maxLength={30} autoComplete="tel" />
        <Input id="instagram" name="instagram" label="Instagram (opcional)" placeholder="tunegocio" maxLength={31} autoComplete="off" hint="Nos ayuda a verificar que el negocio es real." />
        <Input id="mapsUrl" name="mapsUrl" label="Enlace de Google Maps (opcional)" type="url" placeholder="https://maps.app.goo.gl/…" maxLength={500} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="block text-[13px] font-medium text-[#f5f5f7]/80">
          Descripción de tu negocio
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          minLength={L.descriptionMin}
          maxLength={L.descriptionMax}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Qué haces, para quién y qué te distingue. Escríbelo como se lo contarías a un cliente nuevo."
          className={`${fieldClass} resize-y py-3 leading-[1.5]`}
        />
        <p className="flex justify-between gap-3 text-xs text-[#86868b]">
          <span>En tus palabras. Las descripciones genéricas se devuelven.</span>
          <Counter value={description.trim().length} min={L.descriptionMin} max={L.descriptionMax} />
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="servicesText" className="block text-[13px] font-medium text-[#f5f5f7]/80">
          Servicios y precios
        </label>
        <textarea
          id="servicesText"
          name="servicesText"
          required
          rows={4}
          minLength={L.servicesMin}
          maxLength={L.servicesMax}
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
          placeholder={"Corte clásico · 12 USD · 30 min\nCorte y barba · 18 USD · 45 min"}
          className={`${fieldClass} resize-y py-3 leading-[1.5]`}
        />
        <p className="flex justify-between gap-3 text-xs text-[#86868b]">
          <span>Uno por línea: servicio, precio y duración.</span>
          <Counter value={servicesText.trim().length} min={L.servicesMin} max={L.servicesMax} />
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-[13px] font-medium text-[#f5f5f7]/80">
          Fotos ({photos.length} de {L.photosMin} a {L.photosMax})
        </p>
        <label
          htmlFor="photos"
          className={`block cursor-pointer rounded-[16px] border border-dashed border-white/20 px-5 py-6 text-center transition-colors hover:border-white/40 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <span className="block text-[15px] font-medium text-[#f5f5f7]">Toca para elegir fotos</span>
          <span className="mt-1 block text-[13px] text-[#86868b]">
            JPG, PNG o WebP, hasta {formatBytes(L.photoMaxBytes)} cada una.
          </span>
          <input
            ref={fileRef}
            id="photos"
            type="file"
            multiple
            accept={APPLICATION_PHOTO_ACCEPT}
            disabled={busy}
            onChange={(e) => e.target.files && void addPhotos(e.target.files)}
            className="sr-only"
          />
        </label>
        <div aria-live="polite" className="min-h-[18px] text-[13px]">
          {uploading && <p className="text-[#86868b]">{uploading}</p>}
          {photoError && <p className="text-[#ff6961]">{photoError}</p>}
        </div>
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <li key={photo.path} className="overflow-hidden rounded-[14px] border border-white/[0.09] bg-[#161618]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Foto ${index + 1}`} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPhotos((current) => current.filter((p) => p.path !== photo.path))}
                  className="min-h-11 w-full cursor-pointer text-[13px] text-[#ff6961] hover:underline disabled:opacity-50"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[14px] font-medium text-[#ff6961]">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy} loading={submitting}>
        {submitting ? "Enviando…" : "Enviar solicitud"}
      </Button>
      <p className="text-[13px] text-[#86868b]">
        Publicar es gratis. Revisamos cada solicitud a mano antes de que aparezca en Bookealo.
      </p>
    </form>
  );
}
