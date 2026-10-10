import { useEffect, useState } from 'react';
import { Bird } from '../types';

// Shared bird avatar: prefers a real bird image when provided, and falls back
// to the breed-specific SVG illustration. Real images are auto-fitted via
// object-cover. Uploaded photos are compressed client-side and stored in
// MongoDB (served from /api/images/<id>), so they survive redeploys.

type Size = 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<Size, { box: string; media: string; svg: number; dot: string; badgeOffset: string }> = {
  xs: { box: 'w-8 h-8', media: 'w-8 h-8', svg: 22, dot: 'w-3.5 h-3.5 text-[8px]', badgeOffset: '-bottom-0.5 -right-0.5' },
  sm: { box: 'w-12 h-12', media: 'w-12 h-12', svg: 30, dot: 'w-4 h-4 text-[9px]', badgeOffset: '-bottom-0.5 -right-0.5' },
  md: { box: 'w-16 h-16', media: 'w-16 h-16', svg: 40, dot: 'w-5 h-5 text-[10px]', badgeOffset: '-bottom-1 -right-1' },
  lg: { box: 'w-20 h-20', media: 'w-20 h-20', svg: 52, dot: 'w-5.5 h-5.5 text-[11px]', badgeOffset: '-bottom-1 -right-1' },
};

function breedColors(breed?: string): { bg: string; body: string; body2: string; comb: string; beak: string; tail: string } {
  const b = (breed || 'Desi') as string;
  switch (b) {
    case 'Desi': return { bg: 'from-amber-200 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/40', body: '#b45309', body2: '#78350f', comb: '#dc2626', beak: '#f59e0b', tail: '#7c2d12' };
    case 'Aseel': return { bg: 'from-red-200 to-rose-200 dark:from-red-900/40 dark:to-rose-900/40', body: '#7f1d1d', body2: '#450a0a', comb: '#b91c1c', beak: '#eab308', tail: '#3f0a0a' };
    case 'Rhode Island': return { bg: 'from-rose-200 to-red-200 dark:from-rose-900/40 dark:to-red-900/40', body: '#b91c1c', body2: '#7f1d1d', comb: '#dc2626', beak: '#fbbf24', tail: '#450a0a' };
    case 'Broiler': return { bg: 'from-yellow-100 to-amber-200 dark:from-yellow-900/40 dark:to-amber-900/40', body: '#fde68a', body2: '#fcd34d', comb: '#ef4444', beak: '#f59e0b', tail: '#b45309' };
    case 'Layer': return { bg: 'from-stone-200 to-amber-100 dark:from-stone-800 dark:to-amber-900/30', body: '#fef3c7', body2: '#fde68a', comb: '#ef4444', beak: '#f59e0b', tail: '#92400e' };
    case 'Fayoumi': return { bg: 'from-slate-200 to-zinc-300 dark:from-slate-800 dark:to-zinc-800', body: '#78716c', body2: '#44403c', comb: '#dc2626', beak: '#facc15', tail: '#1c1917' };
    case 'Golden': return { bg: 'from-yellow-200 to-amber-300 dark:from-yellow-900/40 dark:to-amber-900/40', body: '#f59e0b', body2: '#b45309', comb: '#dc2626', beak: '#fcd34d', tail: '#78350f' };
    case 'Misri': return { bg: 'from-emerald-200 to-teal-200 dark:from-emerald-900/40 dark:to-teal-900/40', body: '#065f46', body2: '#064e3b', comb: '#dc2626', beak: '#fbbf24', tail: '#022c22' };
    case 'Custom': return { bg: 'from-indigo-200 to-violet-200 dark:from-indigo-900/40 dark:to-violet-900/40', body: '#6366f1', body2: '#4338ca', comb: '#f97316', beak: '#fbbf24', tail: '#312e81' };
    default: return { bg: 'from-amber-200 to-orange-200 dark:from-amber-900/40 dark:to-orange-900/40', body: '#b45309', body2: '#78350f', comb: '#dc2626', beak: '#f59e0b', tail: '#7c2d12' };
  }
}

function HenSVG({ body, body2, comb, beak, tail, size }: { body: string; body2: string; comb: string; beak: string; tail: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M10 36 Q6 24 14 20 Q14 30 20 34 Z" fill={tail} />
      <path d="M12 36 Q10 28 18 26" stroke={tail} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="32" cy="40" rx="20" ry="14" fill={body} />
      <ellipse cx="32" cy="44" rx="18" ry="9" fill={body2} opacity="0.45" />
      <path d="M28 38 Q34 30 42 36 Q36 44 28 42 Z" fill={body2} opacity="0.7" />
      <path d="M42 32 Q44 22 50 22 L52 32 Z" fill={body} />
      <circle cx="50" cy="22" r="8" fill={body} />
      <path d="M46 15 Q48 10 50 14 Q52 10 54 14 Q56 12 54 17 L46 17 Z" fill={comb} />
      <path d="M50 26 Q51 30 53 28 Q51 30 49 28 Z" fill={comb} />
      <path d="M57 22 L62 23 L57 25 Z" fill={beak} />
      <circle cx="52" cy="21" r="1.3" fill="#111" />
      <circle cx="52.4" cy="20.6" r="0.4" fill="#fff" />
      <path d="M27 52 L27 58 M24 58 L30 58" stroke={beak} strokeWidth="2" strokeLinecap="round" />
      <path d="M38 52 L38 58 M35 58 L41 58" stroke={beak} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RoosterSVG({ body, body2, comb, beak, tail, size }: { body: string; body2: string; comb: string; beak: string; tail: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8 38 Q2 18 16 14 Q10 26 14 34 Z" fill={tail} />
      <path d="M12 32 Q8 22 16 20" stroke={tail} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 36 Q12 26 20 25" stroke={body} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="34" cy="40" rx="20" ry="14" fill={body} />
      <ellipse cx="34" cy="45" rx="18" ry="8" fill={body2} opacity="0.5" />
      <path d="M30 38 Q36 28 44 36 Q38 46 30 42 Z" fill={body2} opacity="0.7" />
      <path d="M44 32 Q44 18 52 18 L52 30 Z" fill={body} />
      <circle cx="52" cy="18" r="8" fill={body} />
      <path d="M46 11 Q48 4 50 10 Q52 4 54 10 Q56 4 58 10 Q58 14 54 15 L46 15 Z" fill={comb} />
      <path d="M52 23 Q53 29 55 26 Q53 29 49 26 Z" fill={comb} />
      <path d="M59 18 L64 19 L59 21 Z" fill={beak} />
      <circle cx="54" cy="17" r="1.4" fill="#111" />
      <circle cx="54.4" cy="16.6" r="0.4" fill="#fff" />
      <path d="M29 52 L29 59 M26 59 L32 59" stroke={beak} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M40 52 L40 59 M37 59 L43 59" stroke={beak} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

interface BirdAvatarProps {
  bird: Bird;
  size?: Size;
  onClick?: () => void;
  className?: string;
  showBadge?: boolean;
  shape?: 'circle' | 'rounded';
}

export default function BirdAvatar({ bird, size = 'md', onClick, className = '', showBadge = true, shape = 'circle' }: BirdAvatarProps) {
  const s = sizeMap[size];
  const c = breedColors(bird.breed);
  const [imgError, setImgError] = useState(false);
  const isMale = bird.gender === 'Male';
  const isDead = bird.status === 'Dead';
  const isSold = bird.status === 'Sold';
  const isSick = bird.status === 'Sick';

  useEffect(() => {
    setImgError(false);
  }, [bird.image]);

  const showImage = !!bird.image && !imgError;
  const shapeCls = shape === 'rounded' ? 'rounded-2xl' : 'rounded-full';

  let badge: { bg: string; label?: string; icon?: 'male' | 'female' | 'dead' | 'sick' } | null = null;
  if (showBadge) {
    if (isDead) badge = { bg: 'bg-rose-500 text-white', icon: 'dead' };
    else if (isSold) badge = { bg: 'bg-violet-500 text-white', label: '₨' };
    else if (isSick) badge = { bg: 'bg-red-500 text-white', icon: 'sick' };
    else if (isMale) badge = { bg: 'bg-sky-500 text-white', icon: 'male' };
    else badge = { bg: 'bg-pink-500 text-white', icon: 'female' };
  }

  // Render as <button> when clickable, <div> when static. React.ElementType
  // is the correct type for "a component or tag name" — covers both cases
  // without losing safety the way `any` did.
  const Btn: React.ElementType = onClick ? 'button' : 'div';

  return (
    <Btn
      onClick={onClick}
      className={`relative ${s.box} ${onClick ? 'hover:scale-110 hover:shadow-md cursor-pointer transition' : ''} ${className}`}
      title={bird.name}
    >
      <div className={`relative ${s.media} ${shapeCls} overflow-hidden bg-gradient-to-br ${c.bg} flex items-center justify-center shadow-sm border border-white/70 dark:border-slate-700/60 ${isDead || isSold ? 'opacity-90' : ''}`}>
        {showImage ? (
          <img
            src={bird.image}
            alt={bird.name}
            className={`w-full h-full object-cover object-center ${isDead || isSold ? 'grayscale' : ''}`}
            onError={() => setImgError(true)}
          />
        ) : isMale ? (
          <RoosterSVG body={c.body} body2={c.body2} comb={c.comb} beak={c.beak} tail={c.tail} size={s.svg} />
        ) : (
          <HenSVG body={c.body} body2={c.body2} comb={c.comb} beak={c.beak} tail={c.tail} size={s.svg} />
        )}
      </div>

      {badge && (
        <span className={`absolute ${s.badgeOffset} ${s.dot} ${badge.bg} rounded-full flex items-center justify-center font-black shadow-lg ring-2 ring-white dark:ring-slate-900 leading-none z-10`}>
          {badge.icon === 'male' && <span>♂</span>}
          {badge.icon === 'female' && <span>♀</span>}
          {badge.icon === 'dead' && <span>✕</span>}
          {badge.icon === 'sick' && <span>+</span>}
          {badge.label && <span>{badge.label}</span>}
        </span>
      )}
    </Btn>
  );
}

export function breedLabel(bird: Bird): string {
  if (bird.breed === 'Custom' && bird.customBreed) return bird.customBreed;
  return bird.breed || 'Desi';
}
