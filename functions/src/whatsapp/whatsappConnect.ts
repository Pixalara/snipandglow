// PingFlow — WhatsApp Connection Management Cloud Functions
// Handles connecting, checking status, and disconnecting a gym's WhatsApp Business number

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { encryptToken } from "./crypto.util";

const db = admin.firestore();
const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

/**
 * Validates that a required environment variable is set and returns its value.
 * Throws HttpsError with `failed-precondition` if missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new HttpsError(
      "failed-precondition",
      `Missing required environment variable: ${name}`
    );
  }
  return value;
}

/**
 * connectWhatsApp — Exchange a Meta auth code for credentials and store them.
 *
 * Input: { gymId: string, code: string }
 * Returns: { success: true }
 *
 * Requirements: 1.1, 1.2, 1.4, 2.1–2.7, 14.2, 17.1
 */
export const connectWhatsApp = onCall(
  { region: "asia-south1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { gymId, code } = request.data;

    if (!gymId || !code) {
      throw new HttpsError("invalid-argument", "gymId and code are required.");
    }

    // 2. Admin-only check
    if (request.auth.uid !== gymId) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    // 3. Read required env vars
    const metaAppId = requireEnv("META_APP_ID");
    const metaAppSecret = requireEnv("META_APP_SECRET");

    const configRef = db
      .collection("gyms")
      .doc(gymId)
      .collection("whatsappConfig")
      .doc("default");

    try {
      // 4. Exchange auth code for long-lived token
      const tokenUrl = `${META_GRAPH_URL}/oauth/access_token`;
      const tokenParams = new URLSearchParams({
        client_id: metaAppId,
        client_secret: metaAppSecret,
        code: code,
      });

      const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        console.error(
          "[PingFlow][WhatsAppConnect] Token exchange failed:",
          tokenData
        );
        // Set status to not_connected on failure (Req 2.5)
        await configRef.set(
          { status: "not_connected" },
          { merge: true }
        );
        throw new HttpsError(
          "invalid-argument",
          "Invalid or expired authorization code"
        );
      }

      const accessToken: string = tokenData.access_token;

      // 5. Fetch WABA details
      const wabaResponse = await fetch(
        `${META_GRAPH_URL}/me/whatsapp_business_accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const wabaData = await wabaResponse.json();

      if (!wabaResponse.ok || !wabaData.data || wabaData.data.length === 0) {
        console.error(
          "[PingFlow][WhatsAppConnect] WABA fetch failed:",
          wabaData
        );
        await configRef.set(
          { status: "not_connected" },
          { merge: true }
        );
        throw new HttpsError(
          "internal",
          "Failed to connect WhatsApp: Unable to fetch WhatsApp Business Account details"
        );
      }

      const waba = wabaData.data[0];
      const wabaId: string = waba.id;

      // 6. Fetch phone numbers under the WABA
      const phonesResponse = await fetch(
        `${META_GRAPH_URL}/${wabaId}/phone_numbers`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const phonesData = await phonesResponse.json();

      if (!phonesResponse.ok || !phonesData.data || phonesData.data.length === 0) {
        console.error(
          "[PingFlow][WhatsAppConnect] Phone numbers fetch failed:",
          phonesData
        );
        await configRef.set(
          { status: "not_connected" },
          { merge: true }
        );
        throw new HttpsError(
          "internal",
          "Failed to connect WhatsApp: Unable to fetch phone number details"
        );
      }

      const phone = phonesData.data[0];
      const phoneNumberId: string = phone.id;
      const phoneNumber: string = phone.display_phone_number || phone.phone_number || "";
      const displayName: string = phone.verified_name || phone.display_name || "";
      const metaBusinessId: string = waba.business_id || waba.owner_business_info?.id || "";

      // 7. Encrypt the access token
      const encryptedToken = encryptToken(accessToken);

      // 8. Write WhatsApp config to Firestore (Req 1.1, 1.2, 1.4, 2.3)
      await configRef.set({
        wabaId,
        phoneNumberId,
        accessToken: encryptedToken,
        phoneNumber,
        displayName,
        status: "live",
        metaBusinessId,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 9. Log audit event (Req 2.7)
      await db
        .collection("gyms")
        .doc(gymId)
        .collection("auditLogs")
        .add({
          gymId,
          branchId: "GLOBAL",
          userId: request.auth.uid,
          userName: "Admin",
          userRole: "admin",
          actionType: "WHATSAPP_CONNECTED",
          description: `WhatsApp Business number connected: ${phoneNumber} (${displayName})`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log(
        `[PingFlow][WhatsAppConnect] Successfully connected WhatsApp for gym ${gymId}: ${phoneNumber}`
      );

      return { success: true };
    } catch (err: unknown) {
      // Re-throw HttpsError instances as-is
      if (err instanceof HttpsError) {
        throw err;
      }

      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during WhatsApp connection";
      console.error(
        `[PingFlow][WhatsAppConnect] Unexpected error for gym ${gymId}:`,
        err
      );

      // Set status to not_connected on unexpected failure (Req 2.5)
      try {
        await configRef.set(
          { status: "not_connected" },
          { merge: true }
        );
      } catch (fsErr) {
        console.error(
          "[PingFlow][WhatsAppConnect] Failed to update status on error:",
          fsErr
        );
      }

      throw new HttpsError(
        "internal",
        `Failed to connect WhatsApp: ${errorMessage}`
      );
    }
  }
);

/**
 * getWhatsAppStatus — Read the current WhatsApp connection state for a gym.
 *
 * Input: { gymId: string }
 * Returns: { status, phoneNumber, displayName }
 *
 * Requirements: 3.1, 3.2, 3.3
 */
export const getWhatsAppStatus = onCall(
  { region: "asia-south1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { gymId } = request.data;

    if (!gymId) {
      throw new HttpsError("invalid-argument", "gymId is required.");
    }

    // 2. Read whatsappConfig
    const configSnap = await db
      .collection("gyms")
      .doc(gymId)
      .collection("whatsappConfig")
      .doc("default")
      .get();

    // 3. Return status (Req 3.1, 3.2)
    if (!configSnap.exists) {
      return {
        status: "not_connected",
        phoneNumber: null,
        displayName: null,
      };
    }

    const config = configSnap.data()!;
    return {
      status: config.status || "not_connected",
      phoneNumber: config.phoneNumber || null,
      displayName: config.displayName || null,
    };
  }
);

/**
 * disconnectWhatsApp — Delete the WhatsApp config and revert to default number.
 *
 * Input: { gymId: string }
 * Returns: { success: true }
 *
 * Requirements: 4.1, 4.2, 4.3, 17.2
 */
export const disconnectWhatsApp = onCall(
  { region: "asia-south1" },
  async (request) => {
    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { gymId } = request.data;

    if (!gymId) {
      throw new HttpsError("invalid-argument", "gymId is required.");
    }

    // 2. Admin-only check (Req 4.3, 17.2)
    if (request.auth.uid !== gymId) {
      throw new HttpsError("permission-denied", "Admin only");
    }

    // 3. Delete whatsappConfig doc (Req 4.1)
    await db
      .collection("gyms")
      .doc(gymId)
      .collection("whatsappConfig")
      .doc("default")
      .delete();

    // 4. Log audit event (Req 4.2)
    await db
      .collection("gyms")
      .doc(gymId)
      .collection("auditLogs")
      .add({
        gymId,
        branchId: "GLOBAL",
        userId: request.auth.uid,
        userName: "Admin",
        userRole: "admin",
        actionType: "WHATSAPP_DISCONNECTED",
        description: "WhatsApp Business number disconnected",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log(
      `[PingFlow][WhatsAppConnect] Disconnected WhatsApp for gym ${gymId}`
    );

    return { success: true };
  }
);
