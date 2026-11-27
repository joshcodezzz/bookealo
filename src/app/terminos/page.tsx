import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Condiciones para usar Bookealo, la plataforma de reservas en Panamá.",
};

const sections: LegalSection[] = [
  {
    title: "Qué es Bookealo",
    body: (
      <>
        <p>
          Bookealo es una plataforma que conecta a personas con negocios y profesionales independientes de
          Panamá para reservar servicios por horario. Bookealo no presta esos servicios: los presta cada
          negocio o profesional.
        </p>
        <p>Al crear una cuenta o hacer una reserva aceptas estos términos.</p>
      </>
    ),
  },
  {
    title: "Tu cuenta",
    body: (
      <ul>
        <li>Debes dar datos reales: tu nombre y un teléfono donde el negocio pueda contactarte.</li>
        <li>Eres responsable de lo que se haga con tu cuenta y de mantener tu contraseña en privado.</li>
        <li>Podemos suspender cuentas que se usen para reservas falsas, acoso o cualquier uso indebido.</li>
      </ul>
    ),
  },
  {
    title: "Reservas",
    body: (
      <ul>
        <li>Una reserva es un compromiso entre tú y el negocio para el horario elegido.</li>
        <li>El negocio puede confirmar, reprogramar o cancelar una reserva; lo verás en «Mis reservas».</li>
        <li>Si no puedes asistir, cancela desde la plataforma con la mayor anticipación posible.</li>
        <li>Cada negocio define su propia política de cancelación, visible en su página.</li>
      </ul>
    ),
  },
  {
    title: "Precios y pagos",
    body: (
      <>
        <p>
          Los precios que ves son los que publica cada negocio y pueden variar según el horario o el servicio.
          Hoy Bookealo no cobra ni procesa pagos: el pago se hace directamente al negocio.
        </p>
        <p>Si en el futuro se habilitan pagos dentro de la plataforma, estos términos se actualizarán antes.</p>
      </>
    ),
  },
  {
    title: "Mensajes",
    body: (
      <p>
        El chat sirve para coordinar reservas con el negocio. No lo uses para enviar publicidad, contenido
        ofensivo ni datos sensibles como contraseñas o números de tarjeta.
      </p>
    ),
  },
  {
    title: "Negocios y profesionales",
    body: (
      <ul>
        <li>Cada negocio es responsable de la información que publica, de sus precios y de prestar el servicio reservado.</li>
        <li>Los datos de sus clientes solo pueden usarse para atender las reservas hechas en Bookealo.</li>
      </ul>
    ),
  },
  {
    title: "Responsabilidad",
    body: (
      <p>
        Bookealo facilita la reserva, pero no garantiza la calidad del servicio ni responde por lo que ocurra
        durante su prestación. Cualquier reclamo sobre el servicio debe dirigirse al negocio. Hacemos lo
        posible por mantener la plataforma disponible, aunque puede haber interrupciones.
      </p>
    ),
  },
  {
    title: "Cambios",
    body: (
      <p>
        Podemos actualizar estos términos. Cuando el cambio sea importante lo avisaremos en la plataforma. El
        tratamiento de tus datos se explica en la <Link href="/privacidad">Política de privacidad</Link>.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos de uso"
      subtitle="Las reglas para usar Bookealo, en lenguaje claro."
      updated="27 de noviembre de 2026"
      sections={sections}
    />
  );
}
