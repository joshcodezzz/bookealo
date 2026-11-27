"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Escenario del inicio de sesión: un haz de luz cae sobre el emblema de Bookealo
 * y todo se inclina levemente siguiendo al cursor. El fondo es decorativo:
 * no recibe clics ni foco. El formulario va como `children`.
 */
export function AuthPortal({ children }: { children: ReactNode }) {
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
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      el.style.setProperty("--lx", x.toFixed(3));
      el.style.setProperty("--ly", y.toFixed(3));
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
    <div ref={ref} className="bk-stage">
      <div aria-hidden="true" className="bk-stage-bg">
        <div className="bk-stage-floor" />
        <div className="bk-stage-beam">
          <i />
        </div>
        <div className="bk-stage-rings">
          <i />
          <i />
          <i />
        </div>
        <div className="bk-stage-vignette" />
      </div>

      <div className="relative z-[1]">
        <div aria-hidden="true" className="bk-key">
          <span className="bk-key-letter">B</span>
          <span className="bk-key-live" />
          <span className="bk-key-sheen" />
        </div>
        {children}
      </div>
    </div>
  );
}
