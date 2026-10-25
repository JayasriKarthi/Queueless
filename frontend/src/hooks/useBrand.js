import { useMemo } from 'react';
import { brandVars, BRAND } from '../config/theme';

// CSS variables (--brand, --brand-soft, --brand-contrast) for public pages.
export function useBrand(business) {
  const color = business?.branding?.brandColor ?? BRAND.teal;
  return useMemo(() => brandVars(color), [color]);
}
