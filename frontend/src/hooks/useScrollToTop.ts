// PingFlow — Scroll to top on route change
// Ensures smooth UX when navigating between pages

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instant scroll to top — no jarring jump because page transition handles the visual
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
}
