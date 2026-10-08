import { initials } from "../utils/format";

/**
 * Built-in avatar set (4 male + 4 female styles), rendered as inline SVGs —
 * no external services, works offline. Falls back to initials when the user
 * has not picked an avatar.
 */

export const AVATARS = [
  { id: "male_1",   label: "Male 1",   gender: "male",   bg: "#dbeafe", skin: "#f2c99b", hair: "#2f2a26", shirt: "#3b82f6" },
  { id: "male_2",   label: "Male 2",   gender: "male",   bg: "#dcfce7", skin: "#e8b184", hair: "#141414", shirt: "#16a34a" },
  { id: "female_1", label: "Female 1", gender: "female", bg: "#fce7f3", skin: "#f2c99b", hair: "#5b3a29", shirt: "#ec4899" },
  { id: "female_2", label: "Female 2", gender: "female", bg: "#fee2e2", skin: "#e8b184", hair: "#141414", shirt: "#ef4444" },
];

// Older accounts may still reference the retired male_3/4 & female_3/4 ids —
// keep them renderable so those avatars don't break.
const LEGACY_AVATARS = [
  { id: "male_3",   label: "Male 3",   gender: "male",   bg: "#fef3c7", skin: "#f7d7b0", hair: "#7c4a21", shirt: "#d97706" },
  { id: "male_4",   label: "Male 4",   gender: "male",   bg: "#ede9fe", skin: "#c98d5e", hair: "#1f2937", shirt: "#7c3aed" },
  { id: "female_3", label: "Female 3", gender: "female", bg: "#cffafe", skin: "#f7d7b0", hair: "#8a5a2b", shirt: "#0891b2" },
  { id: "female_4", label: "Female 4", gender: "female", bg: "#fae8ff", skin: "#c98d5e", hair: "#3b2f2f", shirt: "#a21caf" },
];

export function getAvatar(id) {
  return [...AVATARS, ...LEGACY_AVATARS].find((a) => a.id === id) || null;
}

function AvatarSvg({ a, size }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={a.label}>
      <circle cx="32" cy="32" r="32" fill={a.bg} />
      {/* shirt / shoulders */}
      <path d="M10 64c2.5-12 11-18 22-18s19.5 6 22 18" fill={a.shirt} />
      {/* neck */}
      <rect x="27.5" y="41" width="9" height="8" rx="3.5" fill={a.skin} />
      {a.gender === "female" && (
        /* long hair behind the face */
        <path d="M16 34c-1.5-13 6-21 16-21s17.5 8 16 21c-.5 5-1.5 9-3 12l-3-9c-1.5-4-6-6.5-10-6.5S23.5 33 22 37l-3 9c-1.5-3-2.5-7-3-12z" fill={a.hair} />
      )}
      {/* face */}
      <circle cx="32" cy="31" r="13.5" fill={a.skin} />
      {a.gender === "male" ? (
        /* short hair cap */
        <path d="M18.5 30c-1-9.5 4.5-16 13.5-16s14.5 6.5 13.5 16c-.5 1.5-1.5-1-4-2.5S35 25 32 25s-6.5 1-9.5 2.5-3 4-4 2.5z" fill={a.hair} />
      ) : (
        /* female fringe / bangs */
        <path d="M18.5 31c-1-10 5-17 13.5-17s14.5 7 13.5 17l-2.5-3.5c-2.5-4-7-6-11-6s-8.5 2-11 6z" fill={a.hair} />
      )}
      {/* eyes */}
      <circle cx="27" cy="31" r="1.7" fill="#1f2937" />
      <circle cx="37" cy="31" r="1.7" fill="#1f2937" />
      {/* smile */}
      <path d="M27 36.5q5 4 10 0" stroke="#1f2937" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {a.gender === "female" && (
        /* blush */
        <>
          <circle cx="23.5" cy="34.5" r="1.7" fill="#f9a8d4" opacity="0.75" />
          <circle cx="40.5" cy="34.5" r="1.7" fill="#f9a8d4" opacity="0.75" />
        </>
      )}
    </svg>
  );
}

export default function Avatar({ avatarId, name, size = 36, className = "" }) {
  const a = getAvatar(avatarId);
  if (a) {
    return (
      <span
        className={`inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm ${className}`}
        style={{ width: size, height: size }}
        title={a.label}
      >
        <AvatarSvg a={a} size={size} />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ring-2 ring-white shadow-sm ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      title={name || "User"}
    >
      {initials(name)}
    </span>
  );
}
