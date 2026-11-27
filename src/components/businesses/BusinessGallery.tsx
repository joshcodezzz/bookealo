"use client";

import Script from "next/script";
import { createElement } from "react";
import type { BusinessMediaRow } from "@/types/database";

/** Galería pública: fotos, videos y modelos 3D interactivos (visor <model-viewer> de Google). */
export function BusinessGallery({ media, businessName }: { media: BusinessMediaRow[]; businessName: string }) {
  if (media.length === 0) return null;

  const models = media.filter((m) => m.kind === "model3d");
  const videos = media.filter((m) => m.kind === "video");
  const images = media.filter((m) => m.kind === "image");

  return (
    <section aria-labelledby="galeria" className="space-y-5">
      <h2 id="galeria" className="text-[28px] font-semibold tracking-[-0.02em] text-[#f5f5f7] min-[900px]:text-[40px]">
        Galería
      </h2>

      {models.length > 0 && (
        <>
          <Script
            type="module"
            src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js"
            strategy="lazyOnload"
          />
          <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
            {models.map((model) => (
              <figure key={model.id} className="overflow-hidden rounded-[20px] bg-[#161618]">
                {createElement("model-viewer", {
                  src: model.url,
                  alt: model.title ?? `Modelo 3D de ${businessName}`,
                  "camera-controls": "",
                  "touch-action": "pan-y",
                  "shadow-intensity": "1",
                  loading: "lazy",
                  style: { width: "100%", height: "380px", backgroundColor: "#161618" },
                })}
                <figcaption className="px-4 py-3 text-[13px] text-[#86868b]">
                  {model.title ?? "Modelo 3D"} · Arrastra para girar
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      {videos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          {videos.map((video) => (
            <video
              key={video.id}
              src={video.url}
              controls
              playsInline
              preload="metadata"
              aria-label={video.title ?? `Video de ${businessName}`}
              className="aspect-video w-full rounded-[20px] bg-black"
            />
          ))}
        </div>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[900px]:gap-4">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-[16px] bg-[#161618]">
              <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto: ${image.title ?? businessName}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.title ?? `Foto de ${businessName}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
