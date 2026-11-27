/**
 * Envío de recordatorios por WhatsApp (API de WhatsApp Cloud de Meta).
 *
 * WhatsApp solo permite iniciar conversaciones con PLANTILLAS aprobadas por Meta. La plantilla debe
 * tener 6 variables en el cuerpo, en este orden:
 *   {{1}} nombre · {{2}} negocio · {{3}} servicio · {{4}} "mañana" / "en 2 horas" / "en 30 minutos"
 *   {{5}} fecha (DD/MM) · {{6}} hora
 * Texto sugerido: "Hola {{1}}, te recordamos tu reserva en {{2}} ({{3}}) {{4}}: {{5}} a las {{6}}."
 *
 * Variables de entorno (solo servidor):
 *   WHATSAPP_TOKEN            token de acceso de la app de Meta
 *   WHATSAPP_PHONE_NUMBER_ID  id del número emisor
 *   WHATSAPP_TEMPLATE         nombre de la plantilla aprobada
 *   WHATSAPP_TEMPLATE_LANG    idioma de la plantilla (por defecto "es")
 *   WHATSAPP_API_VERSION      versión de la Graph API, por ejemplo "v21.0" (la indica el panel de Meta)
 */

export type ReminderParams = {
  name?: string;
  business?: string;
  service?: string;
  when?: string;
  date?: string;
  time?: string;
};

export type SendResult = { ok: true } | { ok: false; error: string };

const REQUIRED_ENV = [
  "WHATSAPP_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_TEMPLATE",
  "WHATSAPP_API_VERSION",
] as const;

/** Nombres de las variables que faltan (nunca sus valores). */
export function missingWhatsAppConfig(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

/** Deja solo dígitos y agrega el código de Panamá (507) a los números locales de 7 u 8 dígitos. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 7 || digits.length === 8) return `507${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export async function sendWhatsAppReminder(toPhone: string, params: ReminderParams): Promise<SendResult> {
  const missing = missingWhatsAppConfig();
  if (missing.length > 0) return { ok: false, error: `WhatsApp sin configurar: falta ${missing.join(", ")}` };

  const version = process.env.WHATSAPP_API_VERSION!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
  const text = (value: string | undefined) => ({ type: "text", text: (value ?? "").trim() || "-" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
          components: [
            {
              type: "body",
              parameters: [
                text(params.name),
                text(params.business),
                text(params.service),
                text(params.when),
                text(params.date),
                text(params.time),
              ],
            },
          ],
        },
      }),
      signal: controller.signal,
    });

    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, error: `WhatsApp ${response.status}: ${body?.error?.message ?? "error"}`.slice(0, 300) };
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.name === "AbortError" ? "Tiempo agotado" : "Error de red" };
  } finally {
    clearTimeout(timer);
  }
}
