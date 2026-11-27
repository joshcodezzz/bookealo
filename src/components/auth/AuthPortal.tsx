"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const RING_RADII = [300, 372, 452, 542, 644, 758, 884, 1000];

/**
 * Fondo decorativo del inicio de sesión: anillos concéntricos con arcos que orbitan
 * y un leve desplazamiento que sigue al cursor. No recibe clics ni foco.
 */
export function AuthPortal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // En pantallas táctiles no hay cursor que seguir.
    if (!window.matchMedia("(hover: hover)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;
    let targetX = 0;
    let targetY = 0;

    const onMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    const tick = () => {
      x += (targetX - x) * 0.05;
      y += (targetY - y) * 0.05;
      el.style.setProperty("--tx", `${(x * -14).toFixed(2)}px`);
      el.style.setProperty("--ty", `${(y * -10).toFixed(2)}px`);
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden="true" className="bk-portal">
      <div className="bk-portal-glow" />
      <svg className="bk-portal-rings" viewBox="0 0 2000 2000" focusable="false">
        <defs>
          <linearGradient id="bk-portal-arc" gradientUnits="userSpaceOnUse" x1="300" y1="300" x2="1700" y2="1700">
            <stop stopColor="#64d2ff" />
            <stop offset=".55" stopColor="#2997ff" />
            <stop offset="1" stopColor="#0071e3" />
          </linearGradient>
        </defs>
        <circle className="bk-portal-wave" cx="1000" cy="1000" r="300" />
        <circle className="bk-portal-wave bk-portal-wave-b" cx="1000" cy="1000" r="300" />
        {RING_RADII.map((radius, index) => {
          const length = 9 + (index % 3) * 5;
          return (
            <g key={radius}>
              <circle className="bk-portal-base" cx="1000" cy="1000" r={radius} />
              <circle
                className={`bk-portal-arc ${index % 2 ? "bk-portal-arc-reverse" : ""}`}
                cx="1000"
                cy="1000"
                r={radius}
                pathLength={100}
                strokeDasharray={`${length} ${100 - length}`}
                style={
                  {
                    "--bk-orbit-duration": `${38 + index * 12}s`,
                    animationDelay: `${-index * 7.3}s`,
                  } as CSSProperties
                }
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
