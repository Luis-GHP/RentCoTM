# RentCo — Brand Guidelines

> This document defines the visual language of RentCo. Every screen,
> component, and asset must follow these rules. When in doubt, refer
> here before making a design decision.

---

## 1. Brand Identity

**App name:** RentCo
**Voice:** Direct, professional, warm. Not corporate-cold. Not overly casual.
**Audience:** Filipino landlords (primary), Filipino tenants (secondary).
**Context:** Philippines. Currency ₱. Payment methods: GCash, Maya, bank transfer, cash.

---

## 2. Colors

### 2.1 Primary — Forest Green

The brand's core color. Conveys trust, stability, and ownership.

| Token | Hex | When to use |
|---|---|---|
| `primary-900` | `#1B3C34` | Headers, primary buttons, active nav tab, splash |
| `primary-500` | `#1F7A58` | Links, secondary brand accents |
| `primary-100` | `#C6E8DC` | Icon tile backgrounds (Quick Actions) |
| `primary-50`  | `#E8F5F0` | Tinted surface highlights |

**Rule:** Never use `primary` as a background behind long text blocks.

---

### 2.2 Status Colors

Fixed. Never substitute with primary shades or invent new ones.

| Status | Text | Background | Used for |
|---|---|---|---|
| Confirmed / Active | `#16A34A` | `#DCFCE7` | Paid payments, active tenants, confirmed bills |
| Pending | `#D97706` | `#FEF3C7` | Awaiting landlord confirmation |
| Overdue | `#DC2626` | `#FEE2E2` | Past-due payments, overdue alerts |
| Inactive | `#6B7280` | `#F3F4F6` | Deactivated tenants, voided ORs |

**Rule:** Always pair the text color with its matching background. Never use either alone.

---

### 2.3 Neutrals

| Token | Hex | Used for |
|---|---|---|
| `neutral-900` | `#111827` | Headings |
| `neutral-800` | `#1F2937` | Body text |
| `neutral-500` | `#6B7280` | Labels, secondary text, inactive icons |
| `neutral-400` | `#9CA3AF` | Placeholder text, disabled |
| `neutral-200` | `#E5E7EB` | Dividers, row separators |
| `neutral-100` | `#F3F4F6` | Section backgrounds inside cards |
| `neutral-50`  | `#F9FAFB` | Page background |
| `neutral-0`   | `#FFFFFF` | Card backgrounds |

---

## 3. Typography

### 3.1 Typeface

**Inter** — all weights. Load via `expo-font`:
`Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`, `Inter-Bold`

Fallback: `system-ui` → `normal` (keeps layout stable before fonts load).

No decorative fonts. No serifs in the UI.

### 3.2 Type Scale

| Name | Size | Weight | Used for |
|---|---|---|---|
| `3xl` | 34px | Bold | Onboarding hero |
| `2xl` | 28px | Bold | Dashboard hero amounts |
| `xl` | 24px | Bold | Payment amounts (₱8,000.00) |
| `lg` | 20px | SemiBold | Screen titles, card headings |
| `md` | 17px | SemiBold | Section headers, form labels |
| `base` | 15px | Regular / Medium | Body text, list items |
| `sm` | 13px | Regular | Captions, metadata, dates |
| `xs` | 11px | Regular | Timestamps, fine print |

### 3.3 Rules

- Peso amounts: **Bold**, `xl` or larger. Always format as `₱X,XXX.XX`
- Screen titles: **SemiBold `lg`**, never ALL CAPS
- Detail row labels (left): `sm`, `neutral-500`
- Detail row values (right): `base`, `neutral-900`

---

## 4. Spacing & Layout

### 4.1 Grid

4-point grid. All spacing must be a multiple of 4. No arbitrary values.

| Token | Value | Common use |
|---|---|---|
| `1` | 4px | Tight gaps inside chips |
| `2` | 8px | Between icon and label |
| `3` | 12px | Between compact list rows |
| `4` | 16px | Standard screen horizontal padding |
| `6` | 24px | Card inner padding |
| `8` | 32px | Between major page sections |

### 4.2 Screen Layout Template

```
StatusBar (transparent, dark-content)
Header (white OR primary-900 depending on screen)
  ├── Back chevron left — 24×24
  ├── Title center — SemiBold lg
  └── Optional action icon right
ScrollView (bg: page / neutral-50)
  └── White cards (radius-lg, shadow-1)
      separated by 8px vertical gaps
Fixed bottom area (CTA button OR tab bar)
```

### 4.3 Card Rules

- Background: `#FFFFFF`
- Border radius: `14px`
- Padding: `16px` horizontal + vertical
- Shadow: `shadow-1` only — no hard borders

---

## 5. Components

### 5.1 Buttons

| Type | Background | Text | Border | Use for |
|---|---|---|---|---|
| Primary (filled) | `primary-900` | White SemiBold | — | Main CTA |
| Secondary (outline) | Transparent | `primary-900` SemiBold | `primary-900` 1.5px | Secondary actions |
| Danger (outline) | Transparent | `#DC2626` SemiBold | `#DC2626` 1.5px | Deactivate, Mark as Unpaid |
| Disabled | `neutral-200` | `neutral-400` | — | Any disabled state |

Height: 52px. Radius: `14px`. Full-width when at bottom of screen.

**Danger buttons are always outline — never filled red.**

### 5.2 Status Badges

Pill shape (`radius-full`). Padding: 10px horizontal, 4px vertical.
Font: SemiBold `sm`. Always use paired text + background from section 2.2.

### 5.3 Detail Row (label / value pairs)

```
Label (sm, neutral-500)              Value (base, neutral-900)
```

- Min height: 48px
- Separated by 1px `neutral-200` dividers
- Chevron `›` only on tappable rows — never on static display rows

### 5.4 Person / Tenant Row

```
[Avatar 40px]  Name — base SemiBold        [Amount or Badge]
               Subtitle — sm neutral-500
```

Avatar: 40px circle. Fallback: 2-letter initials on `primary-100` background.

### 5.5 Quick Action Tile

```
[Icon 24px inside 48px tinted circle]
Label — xs neutral-700 centered
```

Default circle background: `primary-100`. Use semantic colors for contextual actions.

### 5.6 Tab Bar

- Background: white, top border 1px `neutral-200`
- Active: `primary-900` icon (filled) + label
- Inactive: `neutral-400` icon (outline) + label
- Label: `xs` Regular

### 5.7 Input Fields

- Border: `neutral-200` 1px at rest → `primary-900` 1.5px on focus
- Background: white
- Radius: `10px`
- Height: 52px
- Label above: SemiBold `sm`, `neutral-700`
- Error: border `#DC2626`, error message `xs` below field

### 5.8 Section Group Headers (within lists)

```
MAY 2026        ← sm SemiBold neutral-500, 16px above / 8px below
```

---

## 6. Iconography

Style: **Outline**, 24×24px, 1.5px stroke.
Library: **Lucide React Native**.

- Stroke color inherits from surrounding text color
- Only the active tab bar icon uses a filled variant
- Icon-only buttons: minimum 44×44px tap target

### Icon Map

| Feature | Lucide icon |
|---|---|
| Dashboard | `home` |
| Properties | `building-2` |
| Payments | `credit-card` |
| Maintenance | `wrench` |
| Utilities | `zap` |
| Documents | `file-text` |
| More / Settings | `more-horizontal` |
| Notifications | `bell` |
| Add Tenant | `user-plus` |
| Record Payment | `circle-dollar-sign` |
| Upload Bill | `upload` |
| Tenant Profile | `user` |
| Lease | `file-text` |
| Overdue Alert | `alert-circle` |
| Lease Expiring | `calendar-clock` |
| Pending | `clock` |
| Rent Increase | `trending-up` |
| Deactivate Tenant | `user-x` |

---

## 7. Screen Patterns

### 7.1 Landlord screens
Standard white header on all screens except the dashboard's Monthly Summary card,
which uses a `primary-900` filled card.

### 7.2 Tenant screens
Home screen uses a full-bleed `primary-900` hero header (greeting + unit name).
This is the primary visual signal that the user is in the tenant role.
All other tenant screens revert to the standard white header.

### 7.3 Auth screens
Logo centered in the upper third. Input fields on a white card surface.
Background: `primary-900` top section, white below — or full white with a
`primary-900` accent block. Single primary CTA at the bottom.

### 7.4 Empty states
- Centered icon: 48px, `neutral-300`
- Heading: SemiBold `md`, `neutral-700`
- Subtext: `sm`, `neutral-400`
- Optional outline CTA button

### 7.5 Success / Confirmation screens
- Large checkmark in `confirmed` green
- OR number or amount in `xl` Bold
- Subtext `sm` `neutral-500`
- Single "Done" or "Back to [screen]" CTA

---

## 8. Do's and Don'ts

| Do | Don't |
|---|---|
| Use `primary-900` for all primary CTAs | Use blue or any off-brand color for buttons |
| Pair every status color with its background | Use status text colors without the bg |
| Prefix all peso amounts with `₱` | Write `PHP`, `P`, or omit the symbol |
| Format as `₱X,XXX.XX` with comma | Write `₱8000` or `₱8000.00` without comma |
| Format dates as `January 15, 2026` | Use `01/15/2026` or ISO format in UI |
| Use `OR-YYYY-XXXXXX` for receipt numbers | Abbreviate or reformat OR numbers |
| Warn on RA 9653 violations, let user proceed | Hard-block a rent increase over 7% |
| Use outline icons everywhere except active tab | Mix outline and filled icons on the same screen |
| Show a chevron only on tappable rows | Show chevrons on static display rows |

---

## 9. Roadmap (Post-MVP)

- **Dark mode** — deferred. Do not build dark variants until explicitly instructed.
- **Custom illustrations** — placeholder icons are fine for MVP.
- **Animation / microinteractions** — deferred until core flows are stable.
