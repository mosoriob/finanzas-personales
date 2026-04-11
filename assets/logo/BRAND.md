# Mis Finanzas — Brand Assets

## Logo Files

| File | Use |
|------|-----|
| `logo-full.svg` | Logo completo: ícono + "mis finanzas" + tagline. Para headers, landing pages. |
| `logo-icon.svg` | Solo el ícono de billetera. Para favicon, app icon, espacios pequeños. |
| `logo-text.svg` | Solo el texto + tagline, sin ícono. Para navbars donde el ícono va separado. |

## Brand Name

- **Primary**: "mis finanzas" (lowercase, casual)
- **Tagline**: "tu plata, tu control"

## Colors

| Token | Hex | Use |
|-------|-----|-----|
| `--brand-gradient-start` | `#ff9a56` | Gradient start (warm orange) |
| `--brand-gradient-end` | `#ff6b6b` | Gradient end (coral red) |
| `--brand-text` | `#2d2d2d` | Primary text |
| `--brand-muted` | `#b0876e` | Tagline / secondary text |
| `--brand-bg` | `#fff8f0` | Background tint (optional) |

## Fonts

- **Logo text**: `Caveat` (Google Fonts, weight 600) — handwritten/casual style
- **Tagline / UI**: `DM Sans` (Google Fonts) — clean sans-serif
- **Google Fonts import**: `https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap`

## Usage Notes

- The icon gradient goes from top-left (#ff9a56) to bottom-right (#ff6b6b) at 135deg
- Icon has a rounded square container with `border-radius: 20px` (at 72x72 size)
- The wallet icon is white (#fff) strokes on the gradient background
- For favicon: use `logo-icon.svg`, or render to 32x32 PNG
- For dark backgrounds: the text color should switch to `#fff` or `#f5f0e8`
