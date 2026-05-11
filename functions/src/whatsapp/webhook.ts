// PingFlow — WhatsApp Webhook Endpoint
// Handles Meta webhook verification (GET) and delivery status callbacks (POST)

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Maps Meta delivery status strings to PingFlow's currentStatus values.
 */
const STATUS_MAP: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

/**
 * Verifies the X-Hub-Signature-256 header using HMAC-SHA256.
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 */
function verifySignature(
  rawBody: string,
  signatureHeader: string,
  appSecret: string
): boolean {
  const expectedSignature =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  // Both buffers must be the same length for timingSafeEqual
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const receivedBuf = Buffer.from(signatureHeader, "utf8");

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Finds automation log documents matching a given messageId and updates
 * their currentStatus field.
 */
async function updateAutomationLogStatus(
  messageId: string,
  status: string
): Promise<void> {
  try {
    const logsSnap = await db
      .collectionGroup("automationLogs")
      .where("messageId", "==", messageId)
      .limit(5)
      .get();

    if (logsSnap.empty) {
      console.warn(
        `[PingFlow][Webhook] No automation log found for messageId: ${messageId}`
      );
      return;
    }

    const batch = db.batch();
    for (const doc of logsSnap.docs) {
      batch.update(doc.ref, {
        currentStatus: status,
        lastStatusUpdate: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    console.log(
      `[PingFlow][Webhook] Updated ${logsSnap.size} log(s) for messageId=${messageId} → ${status}`
    );
  } catch (err) {
    console.error(
      `[PingFlow][Webhook] Error updating log for messageId=${messageId}:`,
      err
    );
  }
}

/**
 * whatsappWebhook — HTTP Cloud Function for Meta webhook verification and
 * delivery status callbacks.
 *
 * GET:  Webhook verification handshake
 * POST: Delivery status updates (sent, delivered, read, failed)
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 16.1, 16.2, 16.3
 */
export const whatsappWebhook = onRequest(
  { region: "asia-south1" },
  async (req, res) => {
    // ─── GET: Webhook Verification ──────────────────────────────────────
    if (req.method === "GET") {
      const mode = req.query["hub.mode"] as string | undefined;
      const token = req.query["hub.verify_token"] as string | undefined;
      const challenge = req.query["hub.challenge"] as string | undefined;

      const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

      if (mode === "subscribe" && token === verifyToken) {
        console.log("[PingFlow][Webhook] Verification successful");
        res.status(200).send(challenge || "");
        return;
      }

      console.warn("[PingFlow][Webhook] Verification failed: invalid token");
      res.status(403).send("");
      return;
    }

    // ─── POST: Status Callbacks ─────────────────────────────────────────
    if (req.method === "POST") {
      // 1. Verify signature
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        console.error(
          "[PingFlow][Webhook] META_APP_SECRET not configured"
        );
        // Still respond 200 to prevent retries, but log the config error
        res.status(200).send("");
        return;
      }

      const signatureHeader = req.headers["x-hub-signature-256"] as
        | string
        | undefined;
      const rawBody =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);

      if (
        !signatureHeader ||
        !verifySignature(rawBody, signatureHeader, appSecret)
      ) {
        console.warn("[PingFlow][Webhook] Invalid signature");
        res.status(401).send("");
        return;
      }

      // 2. Parse status updates
      try {
        const body =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body;

        const entries = body?.entry;
        if (!Array.isArray(entries)) {
          console.warn(
            "[PingFlow][Webhook] No entry array in webhook payload"
          );
          res.status(200).send("");
          return;
        }

        for (const entry of entries) {
          const changes = entry?.changes;
          if (!Array.isArray(changes)) continue;

          for (const change of changes) {
            const statuses = change?.value?.statuses;
            if (!Array.isArray(statuses)) continue;

            for (const statusUpdate of statuses) {
              const messageId: string | undefined = statusUpdate?.id;
              const metaStatus: string | undefined = statusUpdate?.status;

              if (!messageId || !metaStatus) continue;

              const mappedStatus = STATUS_MAP[metaStatus];
              if (!mappedStatus) {
                console.warn(
                  `[PingFlow][Webhook] Unknown status "${metaStatus}" for messageId=${messageId}`
                );
                continue;
              }

              await updateAutomationLogStatus(messageId, mappedStatus);
            }
          }
        }
      } catch (err) {
        console.error(
          "[PingFlow][Webhook] Error processing webhook payload:",
          err
        );
      }

      // Always respond 200 to prevent Meta retries (Req 6.6)
      res.status(200).send("");
      return;
    }

    // ─── Other methods: not supported ───────────────────────────────────
    res.status(405).send("");
  }
);
