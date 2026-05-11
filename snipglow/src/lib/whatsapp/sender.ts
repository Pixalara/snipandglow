// WhatsApp Cloud API sender — Section 7 of TECHSTACK
const WA_BASE = 'https://graph.facebook.com/v18.0'

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: Record<string, unknown>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${WA_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error?.message }
    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

export function templateMessage(
  name: string,
  params: string[],
  buttons?: string[]
) {
  return {
    type: 'template',
    template: {
      name,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: params.map((text) => ({ type: 'text', text })),
        },
        ...(buttons || []).map((payload, index) => ({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(index),
          parameters: [{ type: 'payload', payload }],
        })),
      ],
    },
  }
}

export function interactiveButtons(
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  }
}

export function interactiveList(
  body: string,
  buttonLabel: string,
  sections: Array<{
    title: string
    rows: Array<{ id: string; title: string; description?: string }>
  }>
) {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonLabel, sections },
    },
  }
}

export function documentMessage(
  link: string,
  filename: string,
  caption?: string
) {
  return {
    type: 'document',
    document: { link, filename, ...(caption ? { caption } : {}) },
  }
}
