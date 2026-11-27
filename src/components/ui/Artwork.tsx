"use client";

import { useState } from "react";
import { detectCategory, resolveArtKind, type ArtKind } from "@/lib/categories";

/**
 * Carátula de respaldo cuando el negocio no tiene foto: un degradado oscuro
 * y una ilustración de línea según la categoría (cancha, raqueta, tijeras, piano,
 * huella, casa…), para que no todo parezca una cancha de fútbol.
 */
const PALETTES: Record<ArtKind, readonly [string, string][]> = {
  futbol: [["#2f9e55", "#0f3d22"], ["#227a46", "#0a2e18"]],
  padel: [["#1f7fb8", "#0b2d45"], ["#1b8f8a", "#073230"]],
  yate: [["#0a6e8a", "#022e3c"], ["#1d5f9e", "#071f38"]],
  deportes: [["#2d6a4f", "#0d2b1f"], ["#3a6f8f", "#10283a"]],
  barberia: [["#a5683a", "#2e1a0c"], ["#7a5a3c", "#231810"]],
  belleza: [["#b5677a", "#3a1520"], ["#a77b6a", "#2f1d17"]],
  bienestar: [["#6f9a7e", "#1b2e23"], ["#9a8466", "#2b2216"]],
  talents: [["#c08a2e", "#33220a"], ["#b0663a", "#2e170b"]],
  mandaos: [["#4f9e3a", "#14300f"], ["#2f8f6a", "#0b2b20"]],
  hogar: [["#4a6a8a", "#141f2b"], ["#6a6f7a", "#1a1c21"]],
  limpieza: [["#2a9db0", "#0a2e35"], ["#3a8fc0", "#0d2a3a"]],
  clases: [["#3d5fb0", "#101c38"], ["#2f7a9e", "#0c2430"]],
  mascotas: [["#c0703a", "#33190a"], ["#b08a3a", "#2e220b"]],
};

function hashSeed(seed: string): number {
  let hash = 7;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getGradientForSeed(
  seed: string,
  category: ArtKind = "deportes",
): [string, string] {
  const options = PALETTES[category];
  const [from, to] = options[hashSeed(seed) % options.length];
  return [from, to];
}

function isRenderableUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/")
  );
}

type ArtworkProps = {
  src?: string | null;
  alt: string;
  seed: string;
  /** Si no se pasa, se deduce del texto alternativo (el nombre del negocio) */
  category?: ArtKind;
  size?: "sm" | "card" | "hero" | "cover";
  className?: string;
  showHoverBadge?: boolean;
};

/** Ilustraciones de línea, todas en un lienzo 120×80 */
function CategoryIllustration({ category }: { category: ArtKind }) {
  switch (category) {
    case "futbol":
      return (
        <>
          <rect x="4" y="4" width="112" height="72" rx="2" />
          <line x1="60" y1="4" x2="60" y2="76" />
          <circle cx="60" cy="40" r="9" />
          <rect x="4" y="22" width="16" height="36" />
          <rect x="100" y="22" width="16" height="36" />
          <rect x="4" y="32" width="6" height="16" />
          <rect x="110" y="32" width="6" height="16" />
        </>
      );
    case "padel":
      return (
        <>
          <ellipse cx="50" cy="32" rx="20" ry="24" />
          <circle cx="44" cy="24" r="1.6" />
          <circle cx="52" cy="22" r="1.6" />
          <circle cx="58" cy="30" r="1.6" />
          <circle cx="46" cy="34" r="1.6" />
          <circle cx="54" cy="40" r="1.6" />
          <path d="M50 56 L50 74" />
          <rect x="46" y="62" width="8" height="14" rx="3" />
          <circle cx="86" cy="58" r="8" />
          <path d="M79 54 C84 58 88 58 93 54" />
        </>
      );
    case "yate":
      return (
        <>
          <path d="M58 8 L58 54" />
          <path d="M58 12 L84 50 L58 50 Z" />
          <path d="M54 18 L34 50 L54 50 Z" />
          <path d="M24 56 L96 56 L86 68 L34 68 Z" />
          <path d="M14 74 C22 70 30 78 38 74 C46 70 54 78 62 74 C70 70 78 78 86 74 C94 70 100 76 106 74" />
        </>
      );
    case "deportes":
      return (
        <>
          <circle cx="60" cy="40" r="30" />
          <path d="M30 40 L90 40" />
          <path d="M60 10 C46 22 46 58 60 70" />
          <path d="M60 10 C74 22 74 58 60 70" />
        </>
      );
    case "barberia":
      return (
        <>
          <circle cx="42" cy="58" r="9" />
          <circle cx="78" cy="58" r="9" />
          <path d="M48 51 L82 8" />
          <path d="M72 51 L38 8" />
          <circle cx="60" cy="36" r="1.6" />
        </>
      );
    case "belleza":
      // Espejo de mano con destello
      return (
        <>
          <ellipse cx="54" cy="30" rx="18" ry="22" />
          <ellipse cx="54" cy="30" rx="12" ry="16" />
          <path d="M54 52 L54 76" />
          <path d="M80 12 L80 22 M75 17 L85 17" />
          <path d="M88 32 L88 38 M85 35 L91 35" />
        </>
      );
    case "bienestar":
      return (
        <>
          <path d="M60 72 C40 60 32 40 40 18 C52 24 60 38 60 52" />
          <path d="M60 72 C80 60 88 40 80 18 C68 24 60 38 60 52" />
          <path d="M60 72 C54 54 54 32 60 10 C66 32 66 54 60 72 Z" />
          <path d="M28 76 L92 76" />
        </>
      );
    case "talents":
      // Teclado de piano y nota
      return (
        <>
          <rect x="18" y="34" width="72" height="40" rx="3" />
          <path d="M30 34 V74 M42 34 V74 M54 34 V74 M66 34 V74 M78 34 V74" />
          <path d="M26 34 V56 H34 V34 M50 34 V56 H58 V34 M74 34 V56 H82 V34" />
          <path d="M98 30 V8 L110 12" />
          <ellipse cx="94" cy="30" rx="4" ry="3" />
        </>
      );
    case "mandaos":
      // Bolsa con ruta
      return (
        <>
          <path d="M40 30 H80 L76 74 H44 Z" />
          <path d="M50 30 V24 A10 10 0 0 1 70 24 V30" />
          <path d="M50 52 L57 59 L70 46" />
          <path d="M8 66 C16 56 24 70 32 60" strokeDasharray="3 4" />
          <path d="M88 60 C96 50 104 64 112 54" strokeDasharray="3 4" />
        </>
      );
    case "hogar":
      return (
        <>
          <path d="M24 40 L60 10 L96 40" />
          <path d="M32 34 V74 H88 V34" />
          <path d="M52 74 V54 H68 V74" />
          <path d="M98 50 L110 62 M104 46 L114 56 L108 62 L98 52 Z" />
        </>
      );
    case "limpieza":
      return (
        <>
          <path d="M44 34 H64 L68 46 V76 H40 V46 Z" />
          <path d="M48 34 V24 H64 L76 16" />
          <path d="M84 26 H94 M82 36 L90 42 M82 16 L90 10" />
          <circle cx="98" cy="58" r="3" />
          <circle cx="86" cy="66" r="2" />
        </>
      );
    case "clases":
      return (
        <>
          <rect x="16" y="8" width="88" height="52" rx="3" />
          <path d="M30 24 H74 M30 36 H60" />
          <path d="M60 60 V74 M44 76 H76" />
        </>
      );
    case "mascotas":
      return (
        <>
          <circle cx="36" cy="38" r="7" />
          <circle cx="50" cy="22" r="7" />
          <circle cx="70" cy="22" r="7" />
          <circle cx="84" cy="38" r="7" />
          <path d="M60 46 C46 46 36 60 36 68 C36 75 42 78 48 77 C53 76 56 74 60 74 C64 74 67 76 72 77 C78 78 84 75 84 68 C84 60 74 46 60 46 Z" />
        </>
      );
  }
}

function Illustration({
  category,
  className,
  strokeWidth = 0.8,
  strokeOpacity = 0.45,
}: {
  category: ArtKind;
  className?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
}) {
  return (
    <svg
      viewBox="0 0 120 80"
      fill="none"
      stroke={`rgba(255,255,255,${strokeOpacity})`}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <CategoryIllustration category={category} />
    </svg>
  );
}

export function Artwork({
  src,
  alt,
  seed,
  category,
  size = "card",
  className = "",
}: ArtworkProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedCategory = category ?? resolveArtKind(detectCategory(alt), alt);
  const [from, to] = getGradientForSeed(seed, resolvedCategory);
  const showImage = isRenderableUrl(src) && !imgFailed;

  const sizeClass =
    size === "sm"
      ? "h-12 w-12 rounded-[12px] shrink-0"
      : size === "hero" || size === "cover"
        ? "h-full w-full rounded-[24px]"
        : "aspect-square w-full rounded-[18px]";

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative grid place-items-center overflow-hidden ${sizeClass} ${size === "card" ? "bk-cover-media" : ""} ${className}`}
      style={{
        background: `linear-gradient(160deg, ${from}, ${to})`,
      }}
    >
      {showImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onError={() => setImgFailed(true)}
            className={`h-full w-full object-cover ${
              size === "hero" || size === "cover" ? "bk-hero-art" : ""
            }`}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-black/25"
          />
        </>
      ) : (
        <>
          {(size === "cover" || size === "hero") && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-black/25"
            />
          )}

          {size === "hero" ? (
            <Illustration
              category={resolvedCategory}
              strokeWidth={0.75}
              strokeOpacity={0.35}
              className="bk-hero-art pointer-events-none absolute bottom-[8%] left-1/2 h-[38%] w-auto -translate-x-1/2"
            />
          ) : size === "cover" ? (
            <Illustration
              category={resolvedCategory}
              strokeWidth={0.6}
              strokeOpacity={0.4}
              className="bk-hero-art pointer-events-none relative z-10 h-[76%] w-auto max-w-[85%]"
            />
          ) : size === "sm" ? (
            <Illustration
              category={resolvedCategory}
              strokeWidth={1.6}
              strokeOpacity={0.6}
              className="h-auto w-[64%]"
            />
          ) : (
            <Illustration
              category={resolvedCategory}
              strokeWidth={1.15}
              strokeOpacity={0.5}
              className="h-auto w-[55%]"
            />
          )}
        </>
      )}
    </div>
  );
}
