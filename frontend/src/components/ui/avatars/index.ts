/**
 * 12 geometric samurai-themed avatars. Colors are fixed per-avatar (not
 * theme-driven) — this app is dark-only, so hardcoded hex from the real
 * accent family (green/violet/danger/warn) is simpler than CSS vars here.
 */
export interface AvatarDef {
  id: string;
  name: string;
  color: string;
  svg: string;
}

const GREEN = "#00FF00";
const VIOLET = "#9b8cf6";
const RED = "#f0637a";
const AMBER = "#e8a030";

function face(bg: string, accent: string, dark: string, inner: string) {
  return `
    <rect width="100" height="100" rx="20" fill="${bg}"/>
    ${inner}
    <ellipse cx="50" cy="60" rx="17" ry="20" fill="${dark}" stroke="${accent}" stroke-width="1.5"/>
    <rect x="39" y="55" width="7" height="3" rx="1.5" fill="${accent}"/>
    <rect x="54" y="55" width="7" height="3" rx="1.5" fill="${accent}"/>
  `;
}

export const AVATARS: AvatarDef[] = [
  {
    id: "ronin", name: "Ronin", color: GREEN,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#0f1f16", GREEN, "#1a3328", `<polygon points="50,10 18,40 82,40" fill="${GREEN}" opacity=".9"/>`)}
      <line x1="35" y1="70" x2="30" y2="80" stroke="${GREEN}" stroke-width="1.5" opacity=".4"/>
      <line x1="65" y1="70" x2="70" y2="80" stroke="${GREEN}" stroke-width="1.5" opacity=".4"/>
    </svg>`,
  },
  {
    id: "shogun", name: "Shogun", color: VIOLET,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#110e1f", VIOLET, "#1e1640", `
        <path d="M20,45 Q20,14 50,12 Q80,14 80,45 Z" fill="#1e1640" stroke="${VIOLET}" stroke-width="1.5"/>
        <path d="M26,30 L14,8 L30,26" fill="${VIOLET}" opacity=".85"/>
        <path d="M74,30 L86,8 L70,26" fill="${VIOLET}" opacity=".85"/>
      `)}
    </svg>`,
  },
  {
    id: "ninja", name: "Ninja", color: RED,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#1f0e12"/>
      <ellipse cx="50" cy="58" rx="27" ry="29" fill="#2a1018"/>
      <rect x="20" y="32" width="60" height="12" rx="3" fill="${RED}" opacity=".85"/>
      <rect x="62" y="29" width="16" height="8" rx="3" fill="${RED}"/>
      <rect x="22" y="50" width="56" height="20" rx="4" fill="#1f0e12" stroke="${RED}" stroke-width="1"/>
      <ellipse cx="38" cy="49" rx="6" ry="4" fill="#2a1018"/>
      <ellipse cx="62" cy="49" rx="6" ry="4" fill="#2a1018"/>
      <ellipse cx="38" cy="49" rx="3.5" ry="2.5" fill="${RED}"/>
      <ellipse cx="62" cy="49" rx="3.5" ry="2.5" fill="${RED}"/>
    </svg>`,
  },
  {
    id: "samurai", name: "Samurai", color: GREEN,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#0f1f16", GREEN, "#1a3328", `
        <path d="M22,42 Q50,20 78,42 L78,34 Q50,14 22,34 Z" fill="${GREEN}"/>
        <rect x="47" y="6" width="6" height="14" rx="2" fill="${GREEN}"/>
      `)}
    </svg>`,
  },
  {
    id: "kensei", name: "Kensei", color: AMBER,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#1f1608", AMBER, "#332a14", "")}
      <line x1="20" y1="30" x2="80" y2="85" stroke="${AMBER}" stroke-width="3" opacity=".8"/>
      <line x1="40" y1="28" x2="30" y2="38" stroke="${AMBER}" stroke-width="3" opacity=".8"/>
    </svg>`,
  },
  {
    id: "daimyo", name: "Daimyo", color: VIOLET,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#110e1f", VIOLET, "#1e1640", `
        <rect x="24" y="24" width="52" height="10" rx="3" fill="${VIOLET}"/>
        <polygon points="50,8 44,24 56,24" fill="${VIOLET}"/>
      `)}
    </svg>`,
  },
  {
    id: "oni", name: "Oni", color: RED,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#1f0e12", RED, "#3a1620", `
        <polygon points="30,30 22,8 38,26" fill="${RED}"/>
        <polygon points="70,30 78,8 62,26" fill="${RED}"/>
      `)}
      <polygon points="44,68 48,76 52,68" fill="${RED}" opacity=".8"/>
      <polygon points="52,68 56,76 60,68" fill="${RED}" opacity=".8"/>
    </svg>`,
  },
  {
    id: "tengu", name: "Tengu", color: GREEN,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#0f1f16", GREEN, "#1a3328", "")}
      <polygon points="50,58 78,64 50,66" fill="${GREEN}" opacity=".9"/>
      <path d="M18,50 Q6,40 14,26" stroke="${GREEN}" stroke-width="2" fill="none" opacity=".6"/>
      <path d="M82,50 Q94,40 86,26" stroke="${GREEN}" stroke-width="2" fill="none" opacity=".6"/>
    </svg>`,
  },
  {
    id: "kitsune", name: "Kitsune", color: AMBER,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#1f1608", AMBER, "#332a14", `
        <polygon points="28,34 18,10 40,30" fill="${AMBER}"/>
        <polygon points="72,34 82,10 60,30" fill="${AMBER}"/>
      `)}
      <line x1="20" y1="62" x2="36" y2="60" stroke="${AMBER}" stroke-width="1.2" opacity=".5"/>
      <line x1="20" y1="67" x2="36" y2="67" stroke="${AMBER}" stroke-width="1.2" opacity=".5"/>
      <line x1="80" y1="62" x2="64" y2="60" stroke="${AMBER}" stroke-width="1.2" opacity=".5"/>
      <line x1="80" y1="67" x2="64" y2="67" stroke="${AMBER}" stroke-width="1.2" opacity=".5"/>
      <polygon points="50,62 46,70 54,70" fill="${AMBER}"/>
    </svg>`,
  },
  {
    id: "yari", name: "Yari", color: VIOLET,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#110e1f", VIOLET, "#1e1640", "")}
      <line x1="50" y1="10" x2="50" y2="90" stroke="${VIOLET}" stroke-width="3" opacity=".8"/>
      <polygon points="50,6 44,20 56,20" fill="${VIOLET}"/>
    </svg>`,
  },
  {
    id: "katana", name: "Katana", color: GREEN,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#0f1f16", GREEN, "#1a3328", "")}
      <line x1="14" y1="86" x2="80" y2="20" stroke="${GREEN}" stroke-width="4" opacity=".85"/>
      <circle cx="70" cy="30" r="7" fill="none" stroke="${GREEN}" stroke-width="2.5"/>
    </svg>`,
  },
  {
    id: "kabuto", name: "Kabuto", color: RED,
    svg: `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      ${face("#1f0e12", RED, "#3a1620", `
        <path d="M20,40 Q50,10 80,40 Z" fill="${RED}" opacity=".9"/>
        <rect x="46" y="4" width="8" height="20" rx="2" fill="${RED}"/>
      `)}
    </svg>`,
  },
];

export function findAvatar(id?: string | null): AvatarDef | undefined {
  if (!id) return undefined;
  return AVATARS.find(a => a.id === id);
}
