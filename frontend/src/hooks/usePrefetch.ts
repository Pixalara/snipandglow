// PingFlow — Route Prefetching Hook
// Preloads route chunks on hover/focus for instant navigation (like Wellfound)

const routeModules: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Dashboard'),
  '/plans': () => import('@/pages/Plans'),
  '/members': () => import('@/pages/Members'),
  '/leads': () => import('@/pages/Leads'),
  '/billing': () => import('@/pages/Billing'),
  '/automations': () => import('@/pages/AutomationLogs'),
  '/broadcast': () => import('@/pages/Broadcast'),
  '/employees': () => import('@/pages/Employees'),
  '/branches': () => import('@/pages/Branches'),
  '/expenses': () => import('@/pages/Expenses'),
  '/analytics': () => import('@/pages/Analytics'),
  '/activity': () => import('@/pages/ActivityLog'),
  '/settings': () => import('@/pages/Settings'),
};

const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route's JS chunk. Call on mouseenter/focus for instant nav.
 */
export function prefetchRoute(path: string) {
  if (prefetchedRoutes.has(path)) return;
  const loader = routeModules[path];
  if (loader) {
    prefetchedRoutes.add(path);
    loader(); // Fire and forget — browser caches the chunk
  }
}

/**
 * Returns props to spread on a nav link for prefetch-on-hover behavior.
 */
export function usePrefetchProps(path: string) {
  return {
    onMouseEnter: () => prefetchRoute(path),
    onFocus: () => prefetchRoute(path),
    onTouchStart: () => prefetchRoute(path),
  };
}
