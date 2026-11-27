import type { Metadata } from "next";
import { LiquidCheckout } from "@/components/ui/liquid-glass-checkout";

export const metadata: Metadata = {
  title: "Demostración de pago · Bookealo",
  robots: { index: false, follow: false },
};

/**
 * Vista previa del diseño de pago. No está conectada a ningún procesador:
 * no cobra, no guarda y no envía los datos que se escriban.
 */
export default function PagoDemoPage() {
  return (
    <div className="flex flex-col items-center gap-8 pb-10">
      <div className="max-w-[560px] text-center">
        <p className="mb-2 inline-block rounded-full border border-[#ff9f0a]/50 px-3 py-1 text-[12px] font-semibold text-[#ff9f0a]">
          Demostración
        </p>
        <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-[#f5f5f7] min-[900px]:text-[40px]">
          Así se verá el pago en Bookealo
        </h1>
        <p className="mt-3 text-[17px] leading-[1.47] text-[#86868b]">
          Esta página todavía no cobra ni guarda nada. No escribas una tarjeta
          real: para probarla usa el número 4242 4242 4242 4242, cualquier
          fecha futura y cualquier CVC.
        </p>
      </div>

      <LiquidCheckout
        amount={20}
        currency="USD"
        locale="es-PA"
        merchant="Bookealo"
        tone="dark"
      />
    </div>
  );
}
