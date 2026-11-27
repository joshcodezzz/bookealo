import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChevronLeftIcon } from "@/components/ui/Icons";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Conversación",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await requireRole(["customer", "business_owner"], `/mensajes/${id}`);
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  // Si el usuario no participa, las reglas de la base no devuelven la fila.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, business_id, customer_id, customer_name")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  const [{ data: business }, { data: messages }] = await Promise.all([
    supabase.from("businesses").select("id, name").eq("id", conversation.business_id).maybeSingle(),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  const isOwner = profile.role === "business_owner";
  const businessName = business?.name ?? "Negocio";
  const otherName = isOwner ? conversation.customer_name || "Cliente" : businessName;

  return (
    <div className="mx-auto max-w-[760px]">
      <Link href="/mensajes" className="bk-tx inline-flex items-center gap-1.5 text-[14px] text-[#86868b] hover:text-[#f5f5f7]">
        <ChevronLeftIcon className="h-4 w-4" />
        Mensajes
      </Link>

      <header className="mb-5 mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#86868b]">{isOwner ? `Cliente de ${businessName}` : "Negocio"}</p>
          <h1 className="truncate text-[28px] font-semibold tracking-[-0.02em] text-[#f5f5f7] min-[900px]:text-[32px]">
            {otherName}
          </h1>
        </div>
        {!isOwner && (
          <Link href={`/negocios/${conversation.business_id}`} className="bk-link text-[15px]">
            Ver horarios
          </Link>
        )}
      </header>

      <ChatThread
        conversationId={conversation.id}
        currentUserId={user.id}
        initialMessages={messages ?? []}
        otherName={otherName}
      />
    </div>
  );
}
