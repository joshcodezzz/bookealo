"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Artwork } from "@/components/ui/Artwork";
import { Button } from "@/components/ui/Button";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { SearchIcon } from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/States";
import { formatUSD } from "@/lib/currency";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  categoryCountLabel,
  type ArtKind,
  type BusinessCategory,
} from "@/lib/categories";
import {
  hasAnyFilter,
  interpretLocally,
  normalizeText,
  type SearchFilters,
  type SearchInterpretation,
} from "@/lib/smart-search";

export type CatalogBusiness = {
  id: string;
  name: string;
  zone: string | null;
  cover_image_url: string | null;
  amenities: string[];
  category: BusinessCategory;
  artKind: ArtKind;
  minPrice: number | null;
  serviceCount: number;
  /** Hora legible de la primera franja libre que queda hoy, o null si no hay (o no se pudo verificar) */
  todayFirstSlot: string | null;
  /** Reservas reales (pendientes o confirmadas) creadas en los últimos 30 días */
  recentBookings: number;
};

type BusinessCatalogProps = {
  businesses: CatalogBusiness[];
};

/** La prueba social solo aparece cuando el número es real y significativo */
const SOCIAL_PROOF_MIN = 10;

/** Contenedor centrado al ancho de lectura de apple.com */
function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1024px] px-6 min-[900px]:px-[22px] ${className}`}>
      {children}
    </div>
  );
}

function BusinessCard({ business }: { business: CatalogBusiness }) {
  return (
    <Link
      href={`/negocios/${business.id}`}
      className="group flex flex-col rounded-[18px] bg-[#1d1d1f] p-3 transition-transform duration-300 hover:scale-[1.015] min-[900px]:p-4"
    >
      <Artwork
        src={business.cover_image_url}
        alt={business.name}
        seed={business.id}
        category={business.artKind}
        size="card"
        className="!rounded-[12px]"
      />
      <p className="mt-3 text-[12px] font-semibold text-[#86868b] min-[900px]:mt-4">
        {CATEGORIES[business.category].label}
      </p>
      <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-[1.25] tracking-[-0.016em] text-[#f5f5f7] min-[900px]:text-[17px]">
        {business.name}
      </h3>
      <p className="mt-1 truncate text-[13px] text-[#86868b] min-[900px]:text-[14px]">
        {business.zone || "Panamá"}
      </p>
      {business.minPrice !== null && (
        <p className="mt-0.5 text-[13px] text-[#f5f5f7] tabular-nums min-[900px]:text-[14px]">
          Desde {formatUSD(business.minPrice)}
        </p>
      )}
      {business.todayFirstSlot && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#34c470] tabular-nums min-[900px]:text-[14px]">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#34c470]" />
          Hoy desde {business.todayFirstSlot}
        </p>
      )}
      {business.recentBookings >= SOCIAL_PROOF_MIN && (
        <p className="mt-1 text-[12px] text-[#86868b] tabular-nums min-[900px]:text-[13px]">
          {business.recentBookings} reservas en los últimos 30 días
        </p>
      )}
      <span className="bk-link mt-auto inline-block pt-2 text-[14px] min-[900px]:text-[15px]">
        Ver horarios
      </span>
    </Link>
  );
}

export function BusinessCatalog({ businesses }: BusinessCatalogProps) {
  const [query, setQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<BusinessCategory | null>(null);
  const [onlyToday, setOnlyToday] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  const anyAvailableToday = businesses.some((b) => b.todayFirstSlot);

  const countByCategory = useMemo(() => {
    const counts = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<
      BusinessCategory,
      number
    >;
    businesses.forEach((b) => {
      counts[b.category] += 1;
    });
    return counts;
  }, [businesses]);

  const zones = useMemo(() => {
    const unique = new Set<string>();
    businesses.forEach((b) => {
      const z = b.zone?.trim();
      if (z) unique.add(z);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "es"));
  }, [businesses]);

  // ── Búsqueda inteligente ────────────────────────────────────────────────
  // Coincidencia literal primero (instantánea). Si la frase no coincide con nada o parece
  // lenguaje natural, se interpreta: al momento con reglas locales y luego con IA en /api/ai-search.
  const trimmedQuery = query.trim();
  const [smart, setSmart] = useState<(SearchInterpretation & { forQuery: string }) | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const matchesBase = (b: CatalogBusiness) =>
    (!selectedZone || (b.zone?.trim() ?? "") === selectedZone) &&
    (!selectedCategory || b.category === selectedCategory) &&
    (!onlyToday || Boolean(b.todayFirstSlot));

  const literalMatches = useMemo(() => {
    const q = normalizeText(trimmedQuery);
    return businesses.filter((b) => {
      if (!matchesBase(b)) return false;
      if (!q) return true;
      const haystack = normalizeText(
        [b.name, b.zone ?? "", CATEGORIES[b.category].label, ...b.amenities].join(" "),
      );
      return haystack.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, trimmedQuery, selectedZone, selectedCategory, onlyToday]);

  // Solo se interpreta cuando la frase no coincide literalmente con ningún negocio.
  const needsInterpretation = trimmedQuery.length >= 3 && literalMatches.length === 0;

  useEffect(() => {
    if (!needsInterpretation) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSmartLoading(true);
      try {
        const response = await fetch("/api/ai-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmedQuery, zones }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as SearchInterpretation;
        if (data?.filters) setSmart({ ...data, forQuery: trimmedQuery });
      } catch {
        // Sin conexión o cancelado: se quedan las reglas locales.
      } finally {
        if (!controller.signal.aborted) setSmartLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [needsInterpretation, trimmedQuery, zones]);

  // Filtros entendidos para la frase actual: los de la IA si ya llegaron; si no, los locales.
  const understood: (SearchFilters & { source: "ai" | "local" }) | null = useMemo(() => {
    if (!needsInterpretation) return null;
    if (smart && smart.forQuery === trimmedQuery && hasAnyFilter(smart.filters)) {
      return { ...smart.filters, source: smart.source };
    }
    const local = interpretLocally(trimmedQuery, zones);
    return local ? { ...local, source: "local" } : null;
  }, [needsInterpretation, smart, trimmedQuery, zones]);

  const smartMatches = useMemo(() => {
    if (!understood) return null;
    return businesses.filter((b) => {
      if (!matchesBase(b)) return false;
      if (understood.category && b.category !== understood.category) return false;
      if (understood.zone && (b.zone?.trim() ?? "") !== understood.zone) return false;
      if (understood.today && !b.todayFirstSlot) return false;
      if (understood.maxPrice !== null && (b.minPrice === null || b.minPrice > understood.maxPrice)) {
        return false;
      }
      const name = normalizeText(b.name);
      return understood.terms.every((t) => name.includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses, understood, selectedZone, selectedCategory, onlyToday]);

  const usingSmart = Boolean(smartMatches && understood);

  const filteredBusinesses = useMemo(() => {
    const list = usingSmart && smartMatches ? smartMatches : literalMatches;
    // Lo que se puede reservar hoy va primero; el resto conserva su orden.
    return [...list].sort(
      (a, b) => Number(Boolean(b.todayFirstSlot)) - Number(Boolean(a.todayFirstSlot)),
    );
  }, [usingSmart, smartMatches, literalMatches]);

  const understoodChips = useMemo(() => {
    if (!usingSmart || !understood) return [];
    const chips: string[] = [];
    if (understood.category) chips.push(CATEGORIES[understood.category].label);
    if (understood.zone) chips.push(understood.zone);
    if (understood.today) chips.push("Disponible hoy");
    if (understood.maxPrice !== null) chips.push(`Hasta ${formatUSD(understood.maxPrice)}`);
    understood.terms.forEach((t) => chips.push(`«${t}»`));
    return chips;
  }, [usingSmart, understood]);

  const hasActiveFilter = Boolean(
    query.trim() || selectedZone || selectedCategory || onlyToday,
  );

  // Sin filtros se agrupa por categoría, para que los precios se comparen entre iguales.
  const groups = useMemo(() => {
    if (hasActiveFilter) return null;
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: filteredBusinesses.filter((b) => b.category === category),
    })).filter((g) => g.items.length > 0);
  }, [hasActiveFilter, filteredBusinesses]);

  const clearFilters = () => {
    setQuery("");
    setSelectedZone(null);
    setSelectedCategory(null);
    setOnlyToday(false);
  };

  const pickCategory = (category: BusinessCategory) => {
    const next = selectedCategory === category ? null : category;
    setSelectedCategory(next);
    if (next) {
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  // El brillo de la tarjeta sigue al cursor: se guarda su posición dentro de la tarjeta.
  const trackGlow = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--gy", `${event.clientY - rect.top}px`);
  };

  const selectedInfo = selectedCategory ? CATEGORIES[selectedCategory] : null;
  // Se muestran las 9 categorías; las que aún no tienen negocios llevan la etiqueta «Pronto».
  const visibleCategories = CATEGORY_ORDER;

  const selectedIsEmpty = selectedCategory ? countByCategory[selectedCategory] === 0 : false;

  return (
    <div>
      {/* Hero: la búsqueda vive en la primera pantalla */}
      <section className="bk-rise bg-black pb-10 pt-12 text-center min-[900px]:pb-14 min-[900px]:pt-20">
        <Container className="flex flex-col items-center">
          <h1 className="max-w-[820px] text-[36px] font-semibold leading-[1.1] tracking-[-0.009em] text-[#f5f5f7] min-[900px]:text-[64px] min-[900px]:leading-[1.0625]">
            Reserva lo que necesitas en Panamá
          </h1>
          <p className="mt-3 max-w-[620px] text-[17px] leading-[1.47] text-[#86868b] min-[900px]:text-[24px] min-[900px]:leading-[1.33]">
            Elige el horario que te queda y reserva sin llamar.
          </p>

          <div className="mt-8 w-full max-w-[680px] space-y-3 min-[900px]:mt-10">
            <div className="flex flex-col gap-3 min-[600px]:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Prueba: barbería hoy en Costa del Este"
                  aria-label="Buscar negocios"
                  autoComplete="off"
                  enterKeyHint="search"
                  className="h-[52px] w-full rounded-[12px] border border-white/[0.12] bg-[#1d1d1f] pl-11 pr-4 text-[17px] text-[#f5f5f7] placeholder-[#86868b] outline-none transition duration-300 focus:border-[#0071e3] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.25)]"
                />
              </div>

              {zones.length > 1 && (
                <div className="relative min-[600px]:w-[220px]">
                  <label htmlFor="bk-zona" className="sr-only">
                    Zona
                  </label>
                  <select
                    id="bk-zona"
                    value={selectedZone ?? ""}
                    onChange={(event) => setSelectedZone(event.target.value || null)}
                    className="h-[52px] w-full cursor-pointer appearance-none rounded-[12px] border border-white/[0.12] bg-[#1d1d1f] pl-4 pr-10 text-[17px] text-[#f5f5f7] outline-none transition duration-300 focus:border-[#0071e3] focus:shadow-[0_0_0_4px_rgba(0,113,227,0.25)]"
                  >
                    <option value="">Todas las zonas</option>
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 text-[#86868b]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </div>
              )}
            </div>

            {(understoodChips.length > 0 || (smartLoading && needsInterpretation)) && (
              <div
                aria-live="polite"
                className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[13px] text-[#86868b]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className={`h-3.5 w-3.5 text-[#2997ff] ${smartLoading ? "animate-pulse" : ""}`}
                    fill="currentColor"
                  >
                    <path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" />
                  </svg>
                  {understoodChips.length > 0
                    ? understood?.source === "ai"
                      ? "Búsqueda con IA:"
                      : "Entendí:"
                    : "Interpretando…"}
                </span>
                {understoodChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#2997ff]/40 px-2.5 py-0.5 text-[12px] font-medium text-[#2997ff]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            {anyAvailableToday && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  aria-pressed={onlyToday}
                  onClick={() => setOnlyToday((v) => !v)}
                  className={`bk-tx inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-5 text-[15px] font-medium ${
                    onlyToday
                      ? "border-[#34c470] bg-[#34c470] text-[#0a2e18]"
                      : "border-[#34c470]/40 bg-transparent text-[#34c470] hover:border-[#34c470]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${onlyToday ? "bg-[#0a2e18]" : "bg-[#34c470]"}`}
                  />
                  Disponible hoy
                </button>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Cuadrícula de categorías */}
      <section aria-labelledby="bk-categorias" className="pb-14 min-[900px]:pb-20">
        <Container>
          <h2
            id="bk-categorias"
            className="mb-5 text-[28px] font-semibold leading-[1.14] tracking-[-0.01em] text-[#f5f5f7] min-[900px]:mb-6 min-[900px]:text-[40px] min-[900px]:leading-[1.1]"
          >
            Categorías
          </h2>
          <div className="grid grid-cols-2 gap-3 min-[900px]:grid-cols-3 min-[900px]:gap-4">
            {visibleCategories.map((category) => {
              const info = CATEGORIES[category];
              const count = countByCategory[category];
              const active = selectedCategory === category;
              const badge = count === 0 ? "Pronto" : info.isNew ? "Nuevo" : null;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickCategory(category)}
                  onPointerMove={trackGlow}
                  className={`bk-glow group relative flex min-h-[116px] cursor-pointer flex-col justify-between rounded-[18px] border p-4 text-left transition-[transform,border-color,background-color] duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] min-[900px]:min-h-[150px] min-[900px]:p-6 ${
                    active
                      ? "border-[#0071e3] bg-[#16263d]"
                      : "border-white/[0.08] bg-[#111113] hover:border-white/20 hover:bg-[#161618]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <CategoryIcon
                      category={category}
                      className={`h-7 w-7 ${active ? "text-[#2997ff]" : "text-[#f5f5f7]/85"}`}
                    />
                    {badge && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          badge === "Nuevo"
                            ? "border-[#2997ff]/40 text-[#2997ff]"
                            : "border-white/15 text-[#86868b]"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 min-[900px]:mt-6">
                    <p className="text-[15px] font-semibold leading-[1.25] tracking-[-0.016em] text-[#f5f5f7] min-[900px]:text-[17px]">
                      {info.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-[1.35] text-[#86868b] tabular-nums min-[900px]:line-clamp-none min-[900px]:text-[14px]">
                      {count > 0 ? categoryCountLabel(category, count) : info.blurb}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Resultados */}
      <section
        ref={resultsRef}
        id="negocios"
        aria-label="Negocios disponibles"
        className="scroll-mt-14 bg-black pb-16 min-[900px]:pb-24"
      >
        <Container>
          <div className="mb-6 flex items-baseline justify-between gap-4 border-t border-white/[0.12] pt-6 min-[900px]:mb-8">
            <h2 className="text-[21px] font-semibold tracking-[-0.01em] text-[#f5f5f7] min-[900px]:text-[24px]">
              {selectedInfo ? selectedInfo.label : hasActiveFilter ? "Resultados" : "Todos los negocios"}
            </h2>
            <div className="flex items-baseline gap-4">
              <p aria-live="polite" className="text-[15px] text-[#86868b] tabular-nums">
                {filteredBusinesses.length}{" "}
                {filteredBusinesses.length === 1 ? "resultado" : "resultados"}
              </p>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="cursor-pointer text-[15px] text-[#2997ff] hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {businesses.length === 0 ? (
            <EmptyState
              icon={<SearchIcon className="h-5 w-5" />}
              title="Todavía no hay negocios disponibles"
              description="Pronto verás negocios y freelancers disponibles para reservar en Panamá."
            />
          ) : filteredBusinesses.length === 0 ? (
            selectedInfo && selectedIsEmpty ? (
              <EmptyState
                icon={<CategoryIcon category={selectedCategory!} className="h-5 w-5" />}
                title={`${selectedInfo.label} llega pronto`}
                description={`${selectedInfo.blurb}. Todavía no hay nadie publicado en esta categoría.`}
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Ver todos los negocios
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<SearchIcon className="h-5 w-5" />}
                title={
                  query.trim()
                    ? `Sin resultados para “${query.trim()}”`
                    : onlyToday
                      ? "No quedan horarios libres hoy con estos filtros"
                      : "No hay resultados con estos filtros"
                }
                description={
                  onlyToday
                    ? "Quita «Disponible hoy» para ver horarios de los próximos días."
                    : "Prueba con otro término, otra categoría u otra zona."
                }
                action={
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                }
              />
            )
          ) : groups ? (
            <div className="space-y-12 min-[900px]:space-y-16">
              {groups.map((group) => (
                <section key={group.category} aria-labelledby={`cat-${group.category}`}>
                  <div className="mb-4 flex items-baseline justify-between gap-4 min-[900px]:mb-5">
                    <h3
                      id={`cat-${group.category}`}
                      className="text-[19px] font-semibold tracking-[-0.01em] text-[#f5f5f7] min-[900px]:text-[21px]"
                    >
                      {CATEGORIES[group.category].label}
                    </h3>
                    {group.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => pickCategory(group.category)}
                        className="bk-link cursor-pointer text-[14px] min-[900px]:text-[15px]"
                      >
                        Ver {group.items.length}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[900px]:grid-cols-4 min-[900px]:gap-5">
                    {group.items.map((business) => (
                      <BusinessCard key={business.id} business={business} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[900px]:grid-cols-4 min-[900px]:gap-5">
              {filteredBusinesses.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}
