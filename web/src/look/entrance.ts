// The keyframes of an entrance in each motion style (D-PHOTOLIVE-006 (d)): the pure, framework-free part of a look's
// motion, shared so every app's entrances match. The rule from the Reskin Lab stands: nothing runs past 200 ms at 1×
// (`MOTIONS` in ./looks.ts carries each style's length), and Off or the system's reduced-motion setting makes every
// change instant. Playing an entrance (the Web Animations API call, Arc's leading edge drawn in --live, the hook for
// the app's framework) stays in the app: crbn-photo-live's src/theme/motion.ts is the reference.

export type From = 'left' | 'right' | 'top' | 'bottom' | 'center'

export const CLIP: Record<From, string> = {
  left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', top: 'inset(0 0 100% 0)', bottom: 'inset(100% 0 0 0)', center: 'inset(50% 50% 50% 50%)',
}
export const shift = (from: From, px: number) =>
  ({ left: `translateX(${-px}px)`, right: `translateX(${px}px)`, top: `translateY(${-px}px)`, bottom: `translateY(${px}px)`, center: 'scale(.97)' })[from]
export const SHOWN = 'inset(0 0 0 0)'

/** The keyframes of an entrance in a style, or null for none. */
export function entrance(style: string, from: From): Keyframe[] | null {
  switch (style) {
    case 'pop': return [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }]
    case 'arc': return [{ clipPath: CLIP[from], filter: 'brightness(1.9) saturate(1.2)' }, { clipPath: SHOWN, filter: 'none' }]
    case 'slide': return [{ opacity: 0, transform: shift(from, 14) }, { opacity: 1, transform: 'none' }]
    case 'snap': return [{ opacity: 0, transform: shift(from, 4) }, { opacity: 1, transform: 'none' }]
    case 'wipe': return [{ clipPath: CLIP[from], opacity: 0.35 }, { clipPath: SHOWN, opacity: 1 }]
    case 'glitch': return [
      { opacity: 0, transform: 'translateX(-7px) skewX(-6deg)', clipPath: 'inset(0 0 62% 0)' },
      { opacity: 1, transform: 'translateX(6px)', clipPath: 'inset(38% 0 0 0)', offset: 0.3 },
      { opacity: 0.55, transform: 'translateX(-3px)', clipPath: 'inset(0 0 18% 0)', offset: 0.6 },
      { opacity: 1, transform: 'none', clipPath: SHOWN },
    ]
    default: return null
  }
}
