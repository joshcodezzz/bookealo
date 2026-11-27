import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireRole } from "@/lib/auth";
import { formatPanamaDate, formatPanamaTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mensajes",
};

export default async function MensajesPage() {
  const { user, profile } = await requireRole(["customer", "business_owner"], "/mensajes");
  const isOwner = profile.role === "business_owner";

  const supabase = await createClient();
  // Las reglas de la base devuelven solo las conversaciones en las que participa este usuario.
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, customer_id, customer_name, last_message_at, last_message_preview, last_sender_id, customer_read_at, owner_read_at, created_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const list = conversations ?? [];
  const businessIds = [...new Set(list.map((c) => c.business_id))];
  const { data: businesses } = businessIds.length
    ? await supabase.from("businesses").select("id, name").in("id", businessIds)
    : { data: [] };
  const businessName = new Map((businesses ?? []).map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isOwner ? "Panel del dueño" : "Tu cuenta"}
        title="Mensajes"
        subtitle={isOwner ? "Conversaciones con tus clientes." : "Tus conversaciones con los negocios."}
      />

      {error ? (
        <p role="alert" className="rounded-[14px] border border-[#ff6961]/40 px-4 py-3 text-[14px] text-[#ff6961]">
          No pudimos cargar tus mensajes. Intenta de nuevo en un momento.
        </p>
      ) : list.length === 0 ? (
        <Card className="p-6">
          <p className="text-[15px] leading-[1.47] text-[#86868b]">
            {isOwner
              ? "Todavía no tienes conversaciones. Aparecerán aquí cuando un cliente te escriba desde la página de tu negocio."
              : "Todavía no tienes conversaciones. Abre un negocio y toca «Escribir al negocio» para empezar una."}
          </p>
          {!isOwner && (
            <Link href="/" className="bk-link mt-3 inline-block text-[15px]">
              Explorar negocios
            </Link>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => {
            const readAt = isOwner ? c.owner_read_at : c.customer_read_at;
            const unread =
              Boolean(c.last_message_at) &&
              c.last_sender_id !== user.id &&
              (!readAt || Date.parse(readAt) < Date.parse(c.last_message_at!));
            const title = isOwner ? c.customer_name || "Cliente" : businessName.get(c.business_id) || "Negocio";
            return (
              <li key={c.id}>
                <Link href={`/mensajes/${c.id}`} className="block rounded-[20px] transition-transform duration-300 hover:scale-[1.005]">
                  <Card className="flex items-center gap-4 p-4 sm:p-5">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${unread ? "bg-[#0071e3]" : "bg-transparent"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[17px] text-[#f5f5f7] ${unread ? "font-semibold" : "font-medium"}`}>
                        {title}
                        {unread && <span className="sr-only"> (mensaje sin leer)</span>}
                      </p>
                      <p className={`mt-0.5 truncate text-[14px] ${unread ? "text-[#f5f5f7]/85" : "text-[#86868b]"}`}>
                        {c.last_message_preview
                          ? `${c.last_sender_id === user.id ? "Tú: " : ""}${c.last_message_preview}`
                          : "Sin mensajes todavía"}
                      </p>
                    </div>
                    {c.last_message_at && (
                      <p className="shrink-0 text-right text-[12px] text-[#86868b] tabular-nums">
                        {formatPanamaDate(c.last_message_at)}
                        <br />
                        {formatPanamaTime(c.last_message_at)}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
