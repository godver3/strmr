export const radiusTokens = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type RadiusTokens = typeof radiusTokens;
