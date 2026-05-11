// PingFlow — AI Broadcast Assistant
// Uses Vertex AI (Gemini 1.5 Flash) via REST API with intent-aware prompting

import { onCall, HttpsError } from 'firebase-functions/v2/https';

const MODEL = 'gemini-1.5-flash';

function getEndpoint(): string {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
}

const BASE_SYSTEM = `You are an expert fitness copywriter for Indian gym owners. Transform rough notes into stunning WhatsApp messages.

Rules:
- Use emojis strategically (2-4 per message, not excessive)
- Apply WhatsApp formatting: *bold* for emphasis
- Always include a clear Call to Action (CTA) at the end
- Keep it professional yet motivating
- Target audience: Indian gym members
- Max 500 characters
- Include the gym name naturally if provided
- Do NOT use markdown headers or bullet points
- Use line breaks for readability
- Output ONLY the message text, no explanations`;

const INTENT_INSTRUCTIONS: Record<string, string> = {
  active: `INTENT: Message for ACTIVE members who are currently training.
Focus on: class updates, new equipment, motivation, community events, challenges.
Tone: Upbeat, inclusive, "you're part of the family".
CTA: "See you at the gym!", "Reply to join!", "Book your spot!"`,

  inactive: `INTENT: Win-back message for INACTIVE/EXPIRED members who stopped coming.
Focus on: "We miss you", health benefits of returning, special return offers, low-friction CTAs.
Tone: Warm, non-judgmental, encouraging. Never guilt-trip.
CTA: "Reply for a free trial session!", "Come back for a free week!", "Reply YES and we'll save your spot!"
IMPORTANT: If the user's draft is too plain or doesn't mention an offer, automatically suggest adding a "Special Return Offer" like a free session, discounted first month, or buddy pass.`,

  all: `INTENT: General broadcast to ALL members (active + inactive).
Focus on: announcements, offers, events that appeal to everyone.
Tone: Energetic, community-focused.
CTA: "Reply YES to grab your spot!", "Don't miss out!"`,
};

const VIBES = [
  'Write in an energetic, motivating tone. Use power words like "crush", "unstoppable", "transform".',
  'Write in a warm, friendly tone. Make it feel like a personal message from a friend.',
  'Write with urgency and FOMO. Emphasize limited time, limited spots, exclusivity.',
  'Write in a celebratory, festive tone. Make it feel like a party invitation.',
  'Write in a professional, premium tone. Make the gym feel like an elite club.',
];

export const generateAIBroadcast = onCall(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login required.');

    const { draft, gymName, vibeIndex, intent } = request.data;
    if (!draft || typeof draft !== 'string' || draft.trim().length < 5) {
      throw new HttpsError('invalid-argument', 'Please provide a draft message (at least 5 characters).');
    }

    const vibe = VIBES[(vibeIndex ?? 0) % VIBES.length];
    const intentKey = (intent === 'active' || intent === 'inactive') ? intent : 'all';
    const intentInstruction = INTENT_INSTRUCTIONS[intentKey];

    const systemPrompt = `${BASE_SYSTEM}\n\n${intentInstruction}`;

    try {

      const prompt = `Gym name: ${gymName || 'our gym'}
Tone: ${vibe}

Transform this rough draft into a professional WhatsApp broadcast message:

"${draft.trim()}"`;

      console.log(`[PingFlow][AI] Intent: ${intentKey}, Vibe: ${(vibeIndex ?? 0) % VIBES.length}, Draft: ${draft.length} chars`);

      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.9,
          topP: 0.95,
        },
      };

      const response = await fetch(getEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PingFlow][AI] Vertex AI error ${response.status}:`, errorText);
        throw new Error(`Vertex AI returned ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!text) throw new HttpsError('internal', 'AI returned empty response');

      console.log(`[PingFlow][AI] Generated ${text.length} chars for intent: ${intentKey}`);

      return {
        success: true,
        message: text,
        vibeUsed: (vibeIndex ?? 0) % VIBES.length,
        totalVibes: VIBES.length,
      };
    } catch (error: any) {
      console.error('[PingFlow][AI] Generation failed:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'AI generation failed');
    }
  }
);
