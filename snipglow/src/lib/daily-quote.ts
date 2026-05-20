// =============================================================================
// Daily Motivational Quotes — One per day for salon owners
// Returns a different quote each day based on day of year
// =============================================================================

const QUOTES: Array<{ text: string; author: string }> = [
  { text: "Every great salon was once a small dream. Keep building.", author: "Daily Inspiration" },
  { text: "Your customers don't remember what you said, they remember how you made them feel.", author: "Maya Angelou" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { text: "Your most unhappy customers are your greatest source of learning.", author: "Bill Gates" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "A satisfied customer is the best business strategy of all.", author: "Michael LeBoeuf" },
  { text: "Don't find customers for your services. Find services for your customers.", author: "Seth Godin" },
  { text: "Make every detail perfect, and limit the number of details to perfect.", author: "Jack Dorsey" },
  { text: "Your business is only as good as the people behind it.", author: "Daily Inspiration" },
  { text: "Small details make a big difference. Sweat them.", author: "Daily Inspiration" },
  { text: "Treat every customer like they're the only one. They might be your next regular.", author: "Daily Inspiration" },
  { text: "Style is a way to say who you are without having to speak.", author: "Rachel Zoe" },
  { text: "Beauty begins the moment you decide to be yourself.", author: "Coco Chanel" },
  { text: "Excellence is not a skill. It's an attitude.", author: "Ralph Marston" },
  { text: "The customer's perception is your reality.", author: "Kate Zabriskie" },
  { text: "Happy salons make happy customers. Happy customers make great businesses.", author: "Daily Inspiration" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Good service is the lifeline for any business.", author: "Daily Inspiration" },
  { text: "Show up every day. Your customers depend on you.", author: "Daily Inspiration" },
  { text: "The best advertising is done by satisfied customers.", author: "Philip Kotler" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "Care more for your customers than they care about themselves.", author: "Daily Inspiration" },
  { text: "Every appointment is a chance to create a memory.", author: "Daily Inspiration" },
  { text: "Your salon's reputation is built one customer at a time.", author: "Daily Inspiration" },
  { text: "If you don't take care of your customer, your competitor will.", author: "Bob Hooey" },
  { text: "Great things never come from comfort zones.", author: "Daily Inspiration" },
  { text: "Listen to your customers. They will tell you exactly what they want.", author: "Daily Inspiration" },
  { text: "Confidence is the best outfit. Help your customers wear it.", author: "Daily Inspiration" },
  { text: "Hair is the crown you never take off. Make it royal.", author: "Daily Inspiration" },
];

/**
 * Returns a quote based on the current day of year (deterministic per day).
 */
export function getDailyQuote(): { text: string; author: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return QUOTES[dayOfYear % QUOTES.length];
}
