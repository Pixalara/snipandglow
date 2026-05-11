// Snip & Glow — WhatsApp Template Constants (Frontend)
// Keep in sync with functions/src/whatsapp/templates.ts

export const TEMPLATES = {
  EXPIRY_WARNING: 'salon_expiry_reminder_d3',
  EXPIRY_TODAY: 'salon_expiry_reminder_d0',
  EXPIRY_PASSED: 'salon_expiry_reminder_p2',
  INACTIVITY_D5: 'salon_inactivity_5d',
  INACTIVITY_D10: 'salon_inactivity_10d',
} as const;

export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES];
