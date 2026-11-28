"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Artwork } from "@/components/ui/Artwork";
import type { ArtKind } from "@/lib/categories";
import { SUGGESTION_REASON_LABELS, type SuggestionsResponse } from "@/lib/suggestions";

export type SuggestableBusiness = {
  id: string;
  name: string;
  zone: string | null;
  cover_image_url: string | null;
  artKind: ArtKind;
  todayFirstSlot: string | null;
  recentBookings: number;
};

/**
 * «Para ti»: hasta tres negocios sugeridos según las reservas anteriores de la persona.
 * Se carga después de la portada para no retrasarla; si no hay nada que sugerir, no ocupa espacio.
 */
export function SuggestedForYou({ businesses }: { businesses: SuggestableBusiness[] }) {
  const [result, setResult] = useState<SuggestionsResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businesses: businesses.map((b) => ({
          id: b.id,
          availableToday: b.todayFirstSlot !== null,
          recentBookings: b.recentBookings,
        })),
      }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? (response.json() as Promise<SuggestionsResponse>) : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) setResult(data);
      })
      .catch(() => {
        // Sin sugerencias la portada funciona igual.
      });
    return () => controller.abort();
    // La lista llega del servidor una vez por carga de página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;
  const byId = new Map(businesses.map((b) => [b.id, b]));
  const items = result.items.flatMap((item) => {
    const business = byId.get(item.id);
    return business ? [{ business, reason: item.reason }] : [];
  });
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="bk-para-ti" className="bk-rise pb-12 min-[900px]:pb-16">
      <div className="mx-auto max-w-[1024px] px-6 min-[900px]:px-[22px]">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="bk-para-ti"
            className="text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#f5f5f7] min-[900px]:text-[40px] min-[900px]:leading-[1.1]"
          >
            {result.personalized ? "Para ti" : "Para empezar"}
          </h2>
          <p className="text-[13px] text-[#86868b]">
            {result.personalized
              ? result.source === "ai"
                ? "Sugerido con IA según tus reservas anteriores"
                : "Según tus reservas anteriores"
              : "Negocios con turnos y movimiento hoy"}
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map(({ business, reason }) => (
            <li key={business.id}>
              <Link
                href={`/negocios/${business.id}`}
                className="group flex h-full items-center gap-4 rounded-[18px] border border-white/[0.08] bg-[#111113] p-3 transition-colors duration-300 hover:border-[#2997ff]/60"
              >
                <Artwork
                  src={business.cover_image_url}
                  alt=""
                  seed={business.id}
                  category={business.artKind}
                  size="sm"
                  className="shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-[#5be08f]">{SUGGESTION_REASON_LABELS[reason]}</span>
                  <span className="mt-0.5 block truncate text-[17px] font-semibold tracking-[-0.016em] text-[#f5f5f7]">
                    {business.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-[#86868b]">
                    {[business.zone, business.todayFirstSlot ? `Hoy desde ${business.todayFirstSlot}` : null]
                      .filter(Boolean)
                      .join(" · ") || "Ver horarios"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
