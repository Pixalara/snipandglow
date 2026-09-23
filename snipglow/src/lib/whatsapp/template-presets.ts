// =============================================================================
// Curated MARKETING template presets a Pro tenant can submit to their WABA in
// one click. These are ready-made, well-formed WhatsApp templates (positional
// {{n}} placeholders + example values), unlike the free-text preview cards in
// the dashboard — these are the exact definitions that get sent to Meta for
// approval on the tenant's own WhatsApp Business Account.
//
// Style: plain hyphens (no em/en dashes), short lines, an explicit opt-out
// footer (recommended for marketing), and an example value per placeholder so
// Meta can approve without a blank-example rejection.
// =============================================================================

import type { TemplateDefinition } from './template-management';

export interface MarketingTemplatePreset {
  key: string;
  label: string;
  description: string;
  /** Human-readable label for each positional placeholder, in order (1..N). */
  variableLabels: string[];
  definition: TemplateDefinition;
}

export const MARKETING_TEMPLATE_PRESETS: MarketingTemplatePreset[] = [
  {
    key: 'welcome_new_customer_v2',
    label: 'Welcome new customer',
    // v2 name: Meta locks a deleted template's name for ~30 days, so a fresh
    // submission (after the first stalled in review) must use a new name.
    // send-welcome.ts accepts both v2 and the original, so either works.
    description: 'Greet a newly added customer and invite them to book on WhatsApp by just sending "Hi".',
    variableLabels: ['Customer name', 'Salon name'],
    definition: {
      name: 'welcome_new_customer_v2',
      language: 'en',
      category: 'MARKETING',
      bodyText:
        'Hi {{1}}! 👋 Welcome to {{2}}.\n\n' +
        'You can now book your appointments right here on WhatsApp - no phone calls or apps needed.\n\n' +
        'To book, just send "Hi" to this chat and we\'ll help you pick a service, date and time in seconds. 💇✨\n\n' +
        'We can\'t wait to pamper you!',
      exampleParams: ['Priya', 'Bhakti Beauty Care'],
    },
  },
  {
    key: 'birthday_offer',
    label: 'Birthday offer',
    description: 'Wish a customer on their birthday with a limited-time discount.',
    variableLabels: ['Customer name', 'Salon name', 'Discount %'],
    definition: {
      name: 'birthday_offer',
      language: 'en',
      category: 'MARKETING',
      bodyText:
        'Hi {{1}}! 🎂 Happy Birthday from {{2}}!\n\n' +
        'Celebrate your special day with {{3}}% off any service this week. We would love to pamper you.\n\n' +
        'Reply BOOK or call us to grab your slot.',
      exampleParams: ['Priya', 'Glow Salon', '20'],
      footerText: 'Reply STOP to unsubscribe.',
    },
  },
  {
    key: 'anniversary_offer',
    label: 'Anniversary offer',
    description: 'Thank a customer on their anniversary with a gift discount.',
    variableLabels: ['Customer name', 'Salon name', 'Discount %'],
    definition: {
      name: 'anniversary_offer',
      language: 'en',
      category: 'MARKETING',
      bodyText:
        'Hi {{1}}! 🎉 Happy anniversary from {{2}}!\n\n' +
        'Thank you for celebrating your special moments with us. Enjoy {{3}}% off your next visit as our gift to you.\n\n' +
        'Reply BOOK to reserve your time.',
      exampleParams: ['Priya', 'Glow Salon', '15'],
      footerText: 'Reply STOP to unsubscribe.',
    },
  },
  {
    key: 'festival_offer',
    label: 'Festival offer',
    description: 'Broadcast a festive greeting with a seasonal offer.',
    variableLabels: ['Customer name', 'Salon name', 'Festival name', 'Discount %'],
    definition: {
      name: 'festival_offer',
      language: 'en',
      category: 'MARKETING',
      bodyText:
        'Hi {{1}}! {{2}} wishes you a joyful {{3}}. 🎊\n\n' +
        'Celebrate the festive season with {{4}}% off select services. Look your best for every occasion.\n\n' +
        'Reply BOOK or call us to reserve your slot.',
      exampleParams: ['Priya', 'Glow Salon', 'Diwali', '25'],
      footerText: 'Reply STOP to unsubscribe.',
    },
  },
];

/** Look up a preset by key. */
export function getMarketingPreset(key: string): MarketingTemplatePreset | undefined {
  return MARKETING_TEMPLATE_PRESETS.find((p) => p.key === key);
}
