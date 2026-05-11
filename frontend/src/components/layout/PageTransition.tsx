// PingFlow — Smooth Page Transition Wrapper
// Inspired by Wellfound's buttery-smooth route transitions

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<'enter' | 'exit'>('enter');
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      setTransitionStage('exit');
      prevPathRef.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (transitionStage === 'exit') {
      const timer = setTimeout(() => {
        setDisplayChildren(children);
        setTransitionStage('enter');
      }, 150); // Short exit duration for snappy feel
      return () => clearTimeout(timer);
    }
    setDisplayChildren(children);
  }, [transitionStage, children]);

  return (
    <div
      style={{
        willChange: 'opacity, transform',
        opacity: transitionStage === 'enter' ? 1 : 0,
        transform: transitionStage === 'enter' ? 'translateY(0)' : 'translateY(6px)',
        transition: transitionStage === 'enter'
          ? 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      {displayChildren}
    </div>
  );
}
