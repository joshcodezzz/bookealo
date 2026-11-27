"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markConversationReadAction, sendMessageAction } from "@/actions/chat";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/types/database";

type ChatThreadProps = {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
  otherName: string;
};

const POLL_MS = 4000;

const timeFormat = new Intl.DateTimeFormat("es-PA", {
  timeZone: "America/Panama",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dayFormat = new Intl.DateTimeFormat("es-PA", {
  timeZone: "America/Panama",
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function ChatThread({ conversationId, currentUserId, initialMessages, otherName }: ChatThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(initialMessages.length);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (data) setMessages(data);
  }, [conversationId]);

  // Consulta periódica mientras la pestaña está visible.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Al llegar mensajes nuevos: bajar al final y marcar como leído.
  useEffect(() => {
    if (messages.length !== lastCount.current) {
      lastCount.current = messages.length;
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      void markConversationReadAction(conversationId);
    }
  }, [messages.length, conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const result = await sendMessageAction(conversationId, body);
    setSending(false);
    if (!result.ok) {
      // El texto se conserva para que no haya que escribirlo de nuevo.
      setError(result.error);
      return;
    }
    setDraft("");
    await refresh();
  };

  let lastDay = "";

  return (
    <div className="flex flex-col">
      <div
        role="log"
        aria-live="polite"
        aria-label={`Conversación con ${otherName}`}
        className="flex min-h-[320px] flex-col gap-2 rounded-[20px] border border-white/[0.09] bg-[#111113] p-4 sm:p-5"
      >
        {messages.length === 0 ? (
          <p className="m-auto max-w-[320px] text-center text-[15px] leading-[1.47] text-[#86868b]">
            Todavía no hay mensajes. Escribe el primero para {otherName}.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            const date = new Date(message.created_at);
            const day = dayFormat.format(date);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={message.id} className="flex flex-col gap-2">
                {showDay && (
                  <p className="my-2 text-center text-[12px] font-medium text-[#86868b] first-letter:uppercase">{day}</p>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-[18px] px-4 py-2.5 sm:max-w-[70%] ${
                      mine ? "rounded-br-[6px] bg-[#0071e3] text-white" : "rounded-bl-[6px] bg-[#26262a] text-[#f5f5f7]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.4]">{message.body}</p>
                    <p className={`mt-1 text-right text-[11px] tabular-nums ${mine ? "text-white/75" : "text-[#86868b]"}`}>
                      {timeFormat.format(date)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-[calc(84px+var(--sab))] mt-3 flex items-end gap-2 rounded-[20px] border border-white/[0.09] bg-[#161618] p-2 min-[900px]:bottom-4"
      >
        <label htmlFor="chat-draft" className="sr-only">
          Mensaje para {otherName}
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace salto de línea. No se envía mientras se compone texto (IME).
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Escribe un mensaje"
          className="max-h-[140px] min-h-[44px] flex-1 resize-none rounded-[14px] bg-transparent px-3 py-2.5 text-[16px] text-[#f5f5f7] placeholder-[#86868b] outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bk-tx h-11 shrink-0 cursor-pointer rounded-full bg-[#0071e3] px-5 text-[15px] font-medium text-white hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-[#ff6961]">
          {error}
        </p>
      )}
    </div>
  );
}
