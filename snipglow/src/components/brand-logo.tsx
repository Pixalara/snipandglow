/**
 * Brand Logo — "snipandglow" text logo
 * "snipand" in dark slate, "glow" in pink-to-purple gradient
 */
export function BrandLogo({ className = '', size = 'default' }: { className?: string; size?: 'small' | 'default' | 'large' }) {
  const textSize = size === 'small' ? 'text-base' : size === 'large' ? 'text-2xl' : 'text-lg';

  return (
    <span className={`font-bold tracking-tight ${textSize} ${className}`}>
      <span className="text-slate-900 dark:text-white">snipand</span>
      <span className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-transparent">glow</span>
    </span>
  );
}
