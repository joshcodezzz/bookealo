"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { translateError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export type ChatActionResult = { ok: true } | { ok: false; error: string };

const MAX_BODY = 2000;
// Freno simple contra envíos en ráfaga: máximo de mensajes propios por minuto en una conversación.
const MAX_PER_MINUTE = 12;

/** Abre (o reutiliza) la conversación del cliente con un negocio y lo lleva al chat. */
export async function startConversationAction(businessId: string): Promise<void> {
  const { user, profile } = await getAuthContext();
  if (!user || !profile) {
    redirect(`/login?next=${encodeURIComponent(`/negocios/${businessId}`)}`);
  }
  if (profile.role !== "customer") {
    redirect(`/negocios/${businessId}`);
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (existing) redirect(`/mensajes/${existing.id}`);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: user.id,
      // El nombre sale del perfil guardado, no de lo que mande el navegador.
      customer_name: profile.full_name?.trim().slice(0, 80) || null,
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect(`/negocios/${businessId}?chat=error`);
  }

  redirect(`/mensajes/${created.id}`);
}

export async function sendMessageAction(conversationId: string, rawBody: string): Promise<ChatActionResult> {
  const { user, profile } = await getAuthContext();
  if (!user || !profile) return { ok: false, error: "Inicia sesión para escribir." };

  const body = rawBody.replace(/\r\n/g, "\n").trim();
  if (!body) return { ok: false, error: "Escribe un mensaje." };
  if (body.length > MAX_BODY) return { ok: false, error: `El mensaje es demasiado largo (máximo ${MAX_BODY} caracteres).` };

  const supabase = await createClient();

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_MINUTE) {
    return { ok: false, error: "Estás enviando muchos mensajes seguidos. Espera un momento." };
  }

  // Las reglas de la base solo dejan escribir a quienes participan en la conversación.
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: user.id, body });
  if (error) return { ok: false, error: translateError(error.message) };

  revalidatePath("/mensajes");
  return { ok: true };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const { user } = await getAuthContext();
  if (!user) return;
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}
