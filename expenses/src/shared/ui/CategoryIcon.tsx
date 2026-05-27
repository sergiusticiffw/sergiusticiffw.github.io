import React from 'react';
import { cn } from './cn';
import {
  FiFilm,
  FiCoffee,
  FiGift,
  FiHome,
  FiPackage,
  FiHeart,
  FiTruck,
  FiZap,
  FiShoppingBag,
  FiUsers,
  FiUser,
  FiMapPin,
  FiTrendingUp,
  FiTag,
} from 'react-icons/fi';

const CATEGORY_MAP: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  // Keep category colors unique and semantically meaningful.
  '1': { icon: FiShoppingBag, color: '#ec4899' }, // clothing
  '2': { icon: FiFilm, color: '#8b5cf6' }, // entertainment
  '3': { icon: FiCoffee, color: '#f59e0b' }, // food
  '4': { icon: FiGift, color: '#14b8a6' }, // gifts
  '5': { icon: FiPackage, color: '#f97316' }, // household
  '6': { icon: FiHome, color: '#3b82f6' }, // housing
  '7': { icon: FiHeart, color: '#ef4444' }, // health
  '8': { icon: FiUser, color: '#06b6d4' }, // personal
  '9': { icon: FiTruck, color: '#64748b' }, // transport
  '10': { icon: FiZap, color: '#eab308' }, // utilities
  '11': { icon: FiMapPin, color: '#6366f1' }, // travel
  '12': { icon: FiUsers, color: '#84cc16' }, // family
  '13': { icon: FiTrendingUp, color: '#22c55e' }, // investment
};

export interface CategoryIconProps {
  categoryId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showBackground?: boolean;
}

const sizeMap = {
  sm: { box: 'w-9 h-9', icon: 'w-[18px] h-[18px]' },
  md: { box: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { box: 'w-12 h-12', icon: 'w-6 h-6' },
};

export function CategoryIcon({
  categoryId,
  size = 'md',
  className,
  showBackground = true,
}: CategoryIconProps) {
  const config = categoryId ? CATEGORY_MAP[categoryId] : null;
  const Icon = config?.icon ?? FiTag;
  const color = config?.color ?? 'var(--color-app-muted)';
  const sizes = sizeMap[size];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl shrink-0',
        sizes.box,
        className
      )}
      style={
        showBackground
          ? {
              backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            }
          : undefined
      }
      aria-hidden
    >
      <Icon className={sizes.icon} style={{ color }} />
    </span>
  );
}
