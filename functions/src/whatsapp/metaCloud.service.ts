import * as admin from "firebase-admin";
import { decryptToken } from "./crypto.util";

if (!admin.apps.length) {
  admin.initializeApp();
}

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

export interface SendMessageResult {
  success: boolean;
  messageId: string | null;
  error: string | null;
}

/**
 * Resolves WhatsApp API credentials for a gym.
 *
 * - If gymId is '__default__', skips Firestore lookup and uses env defaults.
 * - If the gym has a live whatsappConfig, decrypts the stored token.
 * - Otherwise falls back to DEFAULT_PHONE_NUMBER_ID / DEFAULT_WA_ACCESS_TOKEN.
 */
async function resolveCredentials(
  gymId: string
): Promise<{ phoneNumberId: string; accessToken: string } | { error: string }> {
  // Special case: skip config lookup for default credentials
  if (gymId === "__default__") {
    return getDefaultCredentials();
  }

  try {
    const configSnap = await admin
      .firestore()
      .collection("gyms")
      .doc(gymId)
      .collection("whatsappConfig")
      .doc("default")
      .get();

    if (configSnap.exists) {
      const config = configSnap.data();
      if (config && config.status === "live") {
        try {
          const accessToken = decryptToken(config.accessToken);
          return {
            phoneNumberId: config.phoneNumberId,
            accessToken,
          };
        } catch (decryptErr) {
          console.warn(
            `[PingFlow][MetaCloud] Decryption failed for gym ${gymId}, falling back to default:`,
            decryptErr
          );
          // Fall through to default credentials
        }
      }
    }
  } catch (firestoreErr) {
    console.warn(
      `[PingFlow][MetaCloud] Firestore lookup failed for gym ${gymId}, falling back to default:`,
      firestoreErr
    );
    // Fall through to default credentials
  }

  return getDefaultCredentials();
}

/**
 * Returns default credentials from environment variables, or an error
 * if they are not configured.
 */
function getDefaultCredentials(): { phoneNumberId: string; accessToken: string } | { error: string } {
  const phoneNumberId = process.env.DEFAULT_PHONE_NUMBER_ID;
  const accessToken = process.env.DEFAULT_WA_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { error: "Default WhatsApp credentials not configured" };
  }

  return { phoneNumberId, accessToken };
}

/**
 * Formats a phone number for the Meta Cloud API:
 * - Strips all non-digit characters
 * - Prepends '91' (India country code) if exactly 10 digits
 */
export function formatPhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "91" + digits;
  }
  return digits;
}

/**
 * Sends a WhatsApp template message via the Meta Cloud API.
 *
 * Never throws — always returns a SendMessageResult.
 *
 * @param gymId        - The gym ID to resolve credentials for.
 *                       Use '__default__' to skip config lookup.
 * @param phoneNumber  - Recipient phone number (any format).
 * @param templateName - Meta-approved template name.
 * @param templateParams - Array of string parameters for the template body.
 * @param languageCode - Template language code (defaults to "en").
 */
export async function sendWhatsAppMessage(
  gymId: string,
  phoneNumber: string,
  templateName: string,
  templateParams: string[],
  languageCode: string = "en"
): Promise<SendMessageResult> {
  try {
    // 1. Resolve credentials
    const creds = await resolveCredentials(gymId);
    if ("error" in creds) {
      console.error(`[PingFlow][MetaCloud] Credential error: ${creds.error}`);
      return { success: false, messageId: null, error: creds.error };
    }

    const { phoneNumberId, accessToken } = creds;

    // 2. Format phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // 3. Build template payload
    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [
          {
            type: "body",
            parameters: templateParams.map((text) => ({
              type: "text",
              text,
            })),
          },
        ],
      },
    };

    // 4. POST to Meta Cloud API
    const url = `${META_GRAPH_URL}/${phoneNumberId}/messages`;

    console.log(
      `[PingFlow][MetaCloud] Sending to: ${formattedPhone}, Template: ${templateName}, Gym: ${gymId}`
    );

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      // Try to extract a meaningful error from the Meta API response
      let errorDetail = `${response.status}: ${response.statusText}`;
      try {
        const errorBody = JSON.parse(responseText);
        if (errorBody.error?.message) {
          errorDetail = `${response.status}: ${errorBody.error.message}`;
        }
      } catch {
        // Use the raw status text
      }
      console.error(
        `[PingFlow][MetaCloud] API error for gym ${gymId}: ${errorDetail}`
      );
      return { success: false, messageId: null, error: errorDetail };
    }

    // 5. Parse success response
    let messageId: string | null = null;
    try {
      const data = JSON.parse(responseText);
      messageId = data.messages?.[0]?.id ?? null;
    } catch {
      console.warn(
        `[PingFlow][MetaCloud] Non-JSON success response for gym ${gymId}`
      );
    }

    console.log(
      `[PingFlow][MetaCloud] Success: messageId=${messageId}, gym=${gymId}`
    );

    return { success: true, messageId, error: null };
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error sending WhatsApp message";
    console.error(`[PingFlow][MetaCloud] Unexpected error for gym ${gymId}:`, err);
    return { success: false, messageId: null, error: errorMessage };
  }
}
