import type { SVGProps } from "react";
import type { BusinessCategory } from "@/lib/categories";

/** Íconos de línea 24×24 para la cuadrícula de categorías (mismo trazo que Icons.tsx) */
const PATHS: Record<BusinessCategory, React.ReactNode> = {
  // Persona con destello: freelancers destacados
  talents: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M18.5 3.5v3M17 5h3M20.5 9.5l-1 .5" />
    </>
  ),
  // Bolsa con check: "búscame esto y tráemelo"
  mandaos: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <path d="m9.5 14 2 2 3.5-3.5" />
    </>
  ),
  // Tijeras
  belleza: (
    <>
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17" cy="18" r="2.5" />
      <path d="M8.5 16 16 4M15.5 16 8 4" />
    </>
  ),
  // Gota
  bienestar: (
    <>
      <path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  // Casa
  hogar: (
    <>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  // Botella atomizadora con destellos
  limpieza: (
    <>
      <path d="M9 9h5l1 3v8H8v-8z" />
      <path d="M10 9V6h4l3-2" />
      <path d="M19 8.5h2M18.5 11l1.5 1M18.5 6l1.5-1" />
    </>
  ),
  // Cancha
  deportes: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M12 5v14" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3 9.5h2.5v5H3M21 9.5h-2.5v5H21" />
    </>
  ),
  // Pizarra
  clases: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M7 8.5h10M7 12h6" />
      <path d="M12 16v4M8.5 20h7" />
    </>
  ),
  // Huella
  mascotas: (
    <>
      <circle cx="7" cy="10" r="1.6" />
      <circle cx="10.5" cy="6.5" r="1.6" />
      <circle cx="14.5" cy="6.5" r="1.6" />
      <circle cx="18" cy="10" r="1.6" />
      <path d="M12 12c-2.8 0-5 3-5 5.2 0 1.6 1.3 2.3 2.6 2 1-.2 1.6-.6 2.4-.6s1.4.4 2.4.6c1.3.3 2.6-.4 2.6-2C17 15 14.8 12 12 12z" />
    </>
  ),
};

export function CategoryIcon({
  category,
  ...props
}: { category: BusinessCategory } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {PATHS[category]}
    </svg>
  );
}
