// =============================================================================
// Festival CAROUSEL presets a tenant can start from in one click.
//
// Each preset seeds the message bubble (top BODY), a shared button, and a few
// starter cards (offer text only — the tenant uploads their own festive image
// for each card). Text is plain (no positional {{n}} variables) so a preset is
// valid to submit as-is once images are added; the tenant can add variables to
// the bubble if they want per-customer personalization.
//
// Card body text is kept under WhatsApp's 160-char carousel-card limit.
// =============================================================================

export type CarouselPresetButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

export interface CarouselPresetButton {
  type: CarouselPresetButtonType;
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface CarouselPresetCard {
  /** Short title shown in the editor to identify the card (not sent to Meta). */
  title: string;
  bodyText: string;
}

export interface CarouselPreset {
  key: string;
  label: string;
  emoji: string;
  description: string;
  /** Suggested template name (normalised on submit). */
  name: string;
  bodyText: string;
  buttons: CarouselPresetButton[];
  cards: CarouselPresetCard[];
}

export const CAROUSEL_PRESETS: CarouselPreset[] = [
  {
    key: 'navratri',
    label: 'Navratri Offers',
    emoji: '🪔',
    description: 'Festive hair, skin and grooming offers for Navratri.',
    name: 'navratri_special_offers',
    bodyText:
      '🎉 Navratri Special Offers!\n\n' +
      'Glow up this festive season with exclusive offers on hair, skin, waxing and grooming. ' +
      'Limited period only — book your slot today!',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }],
    cards: [
      { title: 'Hair care package', bodyText: 'Navratri Hair Care Package — Cut + Root Touch-Up + Hair Spa + Blow Dry + Styling at just ₹2,500/-' },
      { title: 'Special offers grid', bodyText: 'Global Highlights/Colour ₹2,999 · Keratin ₹3,999 · Smoothening ₹4,999 · Nanoplastia ₹6,999' },
      { title: 'Waxing combo', bodyText: 'Garba-Ready Waxing — Honey Full Body from ₹899/- · Rica & Chocolate combos ₹2,699–₹3,599' },
    ],
  },
  {
    key: 'diwali',
    label: 'Diwali Offers',
    emoji: '✨',
    description: 'Diwali festive glow-up offers.',
    name: 'diwali_special_offers',
    bodyText:
      '🪔 Happy Diwali from our family to yours!\n\n' +
      'Celebrate the festival of lights with a fresh new look. Enjoy our special Diwali offers — ' +
      'limited period only. Book your appointment today!',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }],
    cards: [
      { title: 'Glow facial', bodyText: 'Diwali Glow Facial + Clean-Up + Threading at just ₹999/-' },
      { title: 'Hair makeover', bodyText: 'Festive Hair Makeover — Cut + Colour + Spa + Styling ₹2,999/-' },
      { title: 'Bridal/party', bodyText: 'Party-Ready Makeup + Hairstyling from ₹1,499/-' },
    ],
  },
  {
    key: 'eid',
    label: 'Eid Offers',
    emoji: '🌙',
    description: 'Eid Mubarak festive offers.',
    name: 'eid_special_offers',
    bodyText:
      '🌙 Eid Mubarak!\n\n' +
      'Look your best this Eid with our special festive offers on hair, skin and grooming. ' +
      'Limited slots — book early!',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }],
    cards: [
      { title: 'Grooming combo', bodyText: 'Eid Grooming Combo — Haircut + Beard Styling + Clean-Up ₹699/-' },
      { title: 'Glow facial', bodyText: 'Festive Glow Facial + De-Tan + Threading ₹999/-' },
      { title: 'Mehndi/party', bodyText: 'Party-Ready Makeup + Hairstyling from ₹1,499/-' },
    ],
  },
  {
    key: 'new_year',
    label: 'New Year Offers',
    emoji: '🎊',
    description: 'New Year fresh-start offers.',
    name: 'new_year_special_offers',
    bodyText:
      '🎊 New Year, New You!\n\n' +
      'Start the year looking and feeling your best. Grab our New Year offers on all services — ' +
      'limited period only. Book now!',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }],
    cards: [
      { title: 'Makeover', bodyText: 'New Year Makeover — Haircut + Colour + Spa ₹2,499/-' },
      { title: 'Facial', bodyText: 'Fresh Start Facial + Clean-Up + Threading ₹999/-' },
      { title: 'Membership', bodyText: 'Join our membership and save up to 20% all year. Ask us how!' },
    ],
  },
  {
    key: 'generic',
    label: 'Blank Offers',
    emoji: '🏷️',
    description: 'Start from a blank 2-card carousel.',
    name: 'special_offers',
    bodyText:
      'Special Offers just for you!\n\n' +
      'Check out our latest offers below and book your favourite. Limited period only!',
    buttons: [{ type: 'QUICK_REPLY', text: 'Book Now' }],
    cards: [
      { title: 'Offer 1', bodyText: 'Describe your first offer here (e.g. Haircut + Spa at ₹999/-).' },
      { title: 'Offer 2', bodyText: 'Describe your second offer here (e.g. Facial + Clean-Up ₹799/-).' },
    ],
  },
];

export function getCarouselPreset(key: string): CarouselPreset | undefined {
  return CAROUSEL_PRESETS.find((p) => p.key === key);
}
