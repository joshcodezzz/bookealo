import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos guarda Bookealo, para qué los usa y quién puede verlos.",
};

const sections: LegalSection[] = [
  {
    title: "Datos que guardamos",
    body: (
      <ul>
        <li>De tu cuenta: nombre, teléfono, correo electrónico y contraseña (guardada cifrada; nadie puede leerla).</li>
        <li>De tus reservas: negocio, servicio, fecha, hora, precio y estado.</li>
        <li>De tus mensajes: el texto que envías a un negocio por el chat.</li>
      </ul>
    ),
  },
  {
    title: "Para qué los usamos",
    body: (
      <ul>
        <li>Para crear y mostrar tus reservas, y para que el negocio pueda atenderte.</li>
        <li>Para enviarte avisos relacionados con tus reservas.</li>
        <li>Para mostrar a cada negocio estadísticas sobre sus propias reservas.</li>
        <li>Para sugerirte negocios según lo que has reservado antes.</li>
      </ul>
    ),
  },
  {
    title: "Quién puede verlos",
    body: (
      <ul>
        <li>El negocio donde reservas ve tu nombre, tu teléfono y los datos de esa reserva.</li>
        <li>El negocio al que escribes ve tus mensajes y tu nombre.</li>
        <li>El equipo de Bookealo puede acceder a los datos para dar soporte y mantener la plataforma.</li>
        <li>No vendemos tus datos ni los compartimos con anunciantes.</li>
      </ul>
    ),
  },
  {
    title: "Proveedores que usamos",
    body: (
      <ul>
        <li>Los datos se guardan en Supabase, nuestro proveedor de base de datos, y el sitio se sirve desde Vercel.</li>
        <li>
          Cuando una búsqueda no encuentra coincidencias exactas, el texto que escribiste puede enviarse a un
          proveedor de inteligencia artificial para interpretarlo. No se envía tu nombre, tu correo ni tu teléfono.
        </li>
        <li>
          Para sugerirte negocios en la portada usamos tus reservas anteriores. A ese mismo proveedor puede enviarse
          un resumen sin identificarte: en qué categorías y zonas has reservado y cuántas veces. No se envía tu
          nombre, tu correo, tu teléfono ni el detalle de cada reserva.
        </li>
      </ul>
    ),
  },
  {
    title: "Cookies",
    body: (
      <p>
        Usamos solo las cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad.
      </p>
    ),
  },
  {
    title: "Tus derechos",
    body: (
      <>
        <p>
          Conforme a la Ley 81 de 2019 de protección de datos personales de Panamá, puedes pedir acceso a tus
          datos, corregirlos, eliminarlos, oponerte a su uso o solicitar una copia.
        </p>
        <p>
          Tu nombre y teléfono puedes corregirlos tú mismo desde <Link href="/perfil">Mi perfil</Link>. Para
          eliminar tu cuenta o ejercer otro derecho, escribe al equipo de Bookealo.
        </p>
      </>
    ),
  },
  {
    title: "Cambios",
    body: (
      <p>
        Si cambia la forma en que tratamos tus datos, actualizaremos esta página y avisaremos en la plataforma.
        Las condiciones de uso están en los <Link href="/terminos">Términos de uso</Link>.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Privacidad"
      subtitle="Qué datos guardamos, para qué y quién puede verlos."
      updated="27 de noviembre de 2026"
      sections={sections}
    />
  );
}
