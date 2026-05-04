import { Platform } from 'react-native';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
// Deep forest green — the core brand color. Conveys trust and stability.
// Never swap this for a generic blue or use primary shades for status meanings.
export const BrandColors = {
  primary: {
    50:  '#E8F5F0',
    100: '#C6E8DC',
    200: '#8FD0B8',
    300: '#57B894',
    400: '#2E9A72',
    500: '#1F7A58',
    600: '#185E44',
    700: '#144F3A',
    800: '#103F2F',
    900: '#1B3C34', // DEFAULT — headers, primary buttons, active nav
    950: '#0D2420',
  },

  // Fixed semantic colors — do not substitute with primary shades
  status: {
    confirmed: { text: '#16A34A', bg: '#DCFCE7' },
    pending:   { text: '#D97706', bg: '#FEF3C7' },
    overdue:   { text: '#DC2626', bg: '#FEE2E2' },
    active:    { text: '#16A34A', bg: '#DCFCE7' },
    inactive:  { text: '#6B7280', bg: '#F3F4F6' },
  },

  neutral: {
    0:   '#FFFFFF',
    50:  '#F9FAFB', // page background
    100: '#F3F4F6', // section backgrounds, dividers
    200: '#E5E7EB', // borders, separators
    300: '#D1D5DB',
    400: '#9CA3AF', // placeholder text, disabled
    500: '#6B7280', // secondary text, labels, icons
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937', // body text
    900: '#111827', // headings, primary text
  },
} as const;

// ─── Semantic Aliases ─────────────────────────────────────────────────────────
// Use these in components — never raw hex values.
export const Colors = {
  // Brand
  brand:        BrandColors.primary[900],
  brandLight:   BrandColors.primary[500],
  brandSurface: BrandColors.primary[50],
  brandTint:    BrandColors.primary[100],

  // Surfaces
  bgPage:    BrandColors.neutral[50],
  bgCard:    BrandColors.neutral[0],
  bgSection: BrandColors.neutral[100],

  // Text
  textPrimary:   BrandColors.neutral[900],
  textSecondary: BrandColors.neutral[500],
  textDisabled:  BrandColors.neutral[400],
  textInverse:   BrandColors.neutral[0],
  textBrand:     BrandColors.primary[900],
  textLink:      BrandColors.primary[500],
  textDanger:    BrandColors.status.overdue.text,

  // Borders
  border:       BrandColors.neutral[200],
  borderStrong: BrandColors.neutral[300],

  // Icons
  iconDefault: BrandColors.neutral[500],
  iconBrand:   BrandColors.primary[900],
  iconDanger:  BrandColors.status.overdue.text,

  // Tab bar
  tabBarActive:     BrandColors.primary[900],
  tabBarInactive:   BrandColors.neutral[400],
  tabBarBackground: BrandColors.neutral[0],

  // Legacy — kept for themed-view / themed-text compatibility
  light: {
    text:           BrandColors.neutral[900],
    background:     BrandColors.neutral[50],
    tint:           BrandColors.primary[900],
    icon:           BrandColors.neutral[500],
    tabIconDefault: BrandColors.neutral[400],
    tabIconSelected: BrandColors.primary[900],
  },
  // Dark mode deferred to post-MVP — stub kept to avoid TS errors
  dark: {
    text:            '#ECEDEE',
    background:      '#151718',
    tint:            '#FFFFFF',
    icon:            '#9BA1A6',
    tabIconDefault:  '#9BA1A6',
    tabIconSelected: '#FFFFFF',
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────
// Typeface: Inter (all weights). Load via expo-font before first render.
// Fallback: system-ui / normal keeps layout stable on first load.
export const FontFamily = Platform.select({
  ios: {
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
    fallback: 'system-ui',
  },
  android: {
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
    fallback: 'normal',
  },
  default: {
    regular:  'Inter-Regular',
    medium:   'Inter-Medium',
    semiBold: 'Inter-SemiBold',
    bold:     'Inter-Bold',
    fallback: 'normal',
  },
});

// Use only these sizes — no one-off values
export const FontSize = {
  xs:   11, // timestamps, fine print
  sm:   13, // labels, captions, badges
  base: 15, // body text, list items
  md:   17, // section titles, form labels
  lg:   20, // card headings, screen subtitles
  xl:   24, // amount displays (₱X,XXX.XX)
  '2xl': 28, // dashboard hero amounts
  '3xl': 34, // onboarding / splash hero
} as const;

export const LineHeight = {
  xs:   16,
  sm:   18,
  base: 22,
  md:   24,
  lg:   28,
  xl:   32,
  '2xl': 36,
  '3xl': 42,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// 4-point grid. Compose only from these — never use arbitrary values.
export const Spacing = {
  1:  4,
  2:  8,
  3:  12,
  4:  16, // standard screen horizontal padding
  5:  20,
  6:  24, // card inner padding
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────
export const Radius = {
  sm:   6,
  md:   10, // badges, chips, input fields
  lg:   14, // cards
  xl:   20, // bottom sheets, large modals
  full: 9999, // avatars, pill buttons
} as const;

// ─── Elevation / Shadow ───────────────────────────────────────────────────────
// Cards → shadow.1  |  Modals + bottom sheets → shadow.3
export const Shadow = {
  1: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius:  3,
    elevation:     2,
  },
  2: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius:  6,
    elevation:     4,
  },
  3: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  12,
    elevation:     8,
  },
} as const;

// ─── Legacy export — kept for files still importing Fonts ────────────────────
export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono:    "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
