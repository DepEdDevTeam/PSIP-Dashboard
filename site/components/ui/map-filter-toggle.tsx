'use client';

import { motion, useReducedMotion } from 'motion/react';
import { X, type LucideIcon } from 'lucide-react';

export function MapFilterToggle({
  label,
  checked,
  color,
  icon: Icon,
  onToggle,
  hideLabel = false,
  className = '',
}: {
  label: string;
  checked: boolean;
  color: string;
  icon: LucideIcon;
  onToggle: () => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`flex min-h-11 touch-manipulation items-center rounded-xl px-1.5 py-1 text-left text-sm font-semibold text-[#34445f] transition-[background-color,box-shadow] hover:bg-[#f5f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1854bd] ${hideLabel ? 'w-fit' : 'w-full gap-2.5'} ${className}`}
    >
      <span className="relative h-8 w-[60px] shrink-0" aria-hidden="true">
        <motion.span
          className="absolute inset-0 rounded-full border"
          initial={false}
          animate={{ backgroundColor: checked ? color : '#f1f3f7', borderColor: checked ? color : '#d5dce6' }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        />
        <motion.span
          className="absolute left-0.5 top-0.5 size-7 rounded-full border border-[#d9e2ee] bg-white shadow-sm"
          initial={false}
          animate={{ x: checked ? 28 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
        />
        <span className="absolute inset-0 flex items-center justify-around">
          <X className={`size-3 ${checked ? 'text-white' : 'text-[#647089]'}`} />
          <motion.span
            initial={false}
            animate={{ rotate: checked ? 0 : -12, scale: checked ? 1 : 0.9 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            style={{ color: checked ? color : '#647089' }}
          >
            <Icon className="size-3.5" />
          </motion.span>
        </span>
      </span>
      {!hideLabel && <span className="min-w-0 flex-1">{label}</span>}
    </button>
  );
}
