import { useState, useEffect } from 'react';

/**
 * Custom hook to handle responsive breakpoints in JS
 * Matches standard Tailwind breakpoints:
 * sm: 640px
 * md: 768px (Tablet)
 * lg: 1024px (Desktop)
 * xl: 1280px
 */
export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setWindowWidth(window.innerWidth), 100);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timeout); };
  }, []);

  return {
    isMobile: windowWidth < 768,
    isTablet: windowWidth >= 768 && windowWidth < 1024,
    isDesktop: windowWidth >= 1024,
    windowWidth,
  };
}
