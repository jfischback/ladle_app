/**
 * Hand-drawn style food illustrations, used where a recipe has no photo.
 * The drawing is picked from the recipe name (soup, taco, pasta…), so every card gets something cheerful to look at.
 */

export type FoodKind =
  | "soup" | "pasta" | "sandwich" | "burger" | "taco" | "skewer" | "rice" | "chicken" | "ribs" | "pot" | "sausage" | "steak" | "nightoff";

// Order matters: the main dish is usually named first, so its rule comes first.
const RULES: [RegExp, FoodKind][] = [
  [/ribs/i, "ribs"],
  [/chili|pozole|birria|soup|stew/i, "soup"],
  [/spaghetti|fettuccine|alfredo|pasta|mac and cheese$|lasagna/i, "pasta"],
  [/burger/i, "burger"],
  [/sandwich|subs?\b|blt|club/i, "sandwich"],
  [/taco|tostada|fajita|tinga|quesadilla|burrito/i, "taco"],
  [/kabob|kebab|pincho|skewer/i, "skewer"],
  [/steak/i, "steak"],
  [/sausage/i, "sausage"],
  [/bean|frijoles|slow cooker/i, "pot"],
  [/rice|bowl/i, "rice"],
  [/chicken|turkey/i, "chicken"],
];

export function foodKind(name: string | null | undefined, protein?: string | null): FoodKind {
  if (!name) return "nightoff";
  for (const [re, kind] of RULES) if (re.test(name)) return kind;
  if (protein && /chicken|turkey/i.test(protein)) return "chicken";
  if (protein && /bean/i.test(protein)) return "pot";
  return "steak";
}

const BG: Record<FoodKind, string> = {
  soup: "#f3e0d8",
  pasta: "#f4e6c6",
  sandwich: "#e3e5d3",
  burger: "#f4e6c6",
  taco: "#e3e5d3",
  skewer: "#f3e0d8",
  rice: "#e3e5d3",
  chicken: "#f4e6c6",
  ribs: "#f3e0d8",
  pot: "#f4e6c6",
  sausage: "#e3e5d3",
  steak: "#f3e0d8",
  nightoff: "#ede6d8",
};

const INK = "#4f5b3a";
const S = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Drawing({ kind }: { kind: FoodKind }) {
  switch (kind) {
    case "soup":
      return (
        <g>
          <path d="M40 22 q-5 6 0 12 q5 6 0 12" fill="none" stroke="#d2a24c" strokeWidth="3" strokeLinecap="round" />
          <path d="M58 18 q-5 6 0 12 q5 6 0 12" fill="none" stroke="#d2a24c" strokeWidth="3" strokeLinecap="round" />
          <path d="M16 54 H84 A34 30 0 0 1 16 54 Z" fill="#b5654a" {...S} />
          <ellipse cx="50" cy="54" rx="34" ry="8" fill="#d9825f" {...S} />
          <circle cx="38" cy="53" r="2.5" fill="#5e6b47" />
          <circle cx="56" cy="55" r="2.5" fill="#5e6b47" />
          <circle cx="48" cy="51" r="2" fill="#f4e6c6" />
          <circle cx="64" cy="52" r="2" fill="#f4e6c6" />
          <path d="M30 70 q4 3 8 0" fill="none" stroke="#f8f4ec" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "pasta":
      return (
        <g>
          <ellipse cx="50" cy="66" rx="38" ry="14" fill="#fffdf8" {...S} />
          <path d="M24 62 C28 36, 72 36, 76 62 Z" fill="#e9c27a" {...S} />
          <path d="M30 56 q10 -10 20 0 q10 10 20 0 M32 48 q9 -8 18 0 q9 8 18 0" fill="none" stroke="#c4913a" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="42" cy="46" r="7" fill="#8e4632" {...S} />
          <circle cx="58" cy="44" r="7" fill="#8e4632" {...S} />
          <path d="M50 34 q6 -6 10 -2 q-4 6 -10 2 Z" fill="#5e6b47" {...S} strokeWidth={2} />
        </g>
      );
    case "burger":
      return (
        <g>
          <path d="M22 46 C22 24, 78 24, 78 46 Z" fill="#d2a24c" {...S} />
          <ellipse cx="40" cy="34" rx="2" ry="1.3" fill="#fffdf8" />
          <ellipse cx="52" cy="30" rx="2" ry="1.3" fill="#fffdf8" />
          <ellipse cx="62" cy="36" rx="2" ry="1.3" fill="#fffdf8" />
          <path d="M18 50 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 16 0" fill="none" stroke="#5e6b47" strokeWidth="5" strokeLinecap="round" />
          <path d="M22 54 h56 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 l-6 -6 l-6 6 Z" fill="#f2c94c" {...S} strokeWidth={2} />
          <rect x="20" y="56" width="60" height="11" rx="5.5" fill="#8e4632" {...S} />
          <path d="M22 70 h56 a4 4 0 0 1 0 0 v2 a8 8 0 0 1 -8 8 h-40 a8 8 0 0 1 -8 -8 Z" fill="#d2a24c" {...S} />
        </g>
      );
    case "sandwich":
      return (
        <g>
          <path d="M18 60 L50 26 L82 60 Z" fill="#e9c27a" {...S} />
          <path d="M18 60 q8 -6 16 0 q8 6 16 0 q8 -6 16 0 q8 6 16 0" fill="none" stroke="#5e6b47" strokeWidth="5" strokeLinecap="round" />
          <rect x="20" y="62" width="60" height="6" rx="3" fill="#d9825f" {...S} strokeWidth={2} />
          <path d="M18 72 L82 72 L82 76 Q82 80 78 80 L22 80 Q18 80 18 76 Z" fill="#e9c27a" {...S} />
          <circle cx="50" cy="44" r="3" fill="#b5654a" />
          <path d="M50 18 v10" {...S} />
          <circle cx="50" cy="17" r="3" fill="#b5654a" stroke={INK} strokeWidth={2} />
        </g>
      );
    case "taco":
      return (
        <g>
          <path d="M22 48 q8 -10 14 -2 q6 -10 14 -2 q6 -10 14 -2 q6 -8 14 4" fill="#5e6b47" {...S} />
          <circle cx="36" cy="50" r="4" fill="#b5654a" {...S} strokeWidth={2} />
          <circle cx="52" cy="47" r="4" fill="#b5654a" {...S} strokeWidth={2} />
          <circle cx="66" cy="50" r="4" fill="#b5654a" {...S} strokeWidth={2} />
          <path d="M44 52 h14" stroke="#f8f4ec" strokeWidth="3" strokeLinecap="round" />
          <path d="M16 74 A34 30 0 0 1 84 74 Z" fill="#e9b45a" {...S} />
          <path d="M26 72 A24 22 0 0 1 74 72" fill="none" stroke="#c4913a" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />
        </g>
      );
    case "skewer":
      return (
        <g>
          <path d="M14 82 L86 18" stroke="#8a6420" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="22" y="60" width="16" height="16" rx="4" fill="#8e4632" {...S} transform="rotate(-42 30 68)" />
          <rect x="36" y="48" width="14" height="14" rx="3" fill="#5e6b47" {...S} transform="rotate(-42 43 55)" />
          <rect x="47" y="36" width="16" height="16" rx="4" fill="#b5654a" {...S} transform="rotate(-42 55 44)" />
          <rect x="61" y="25" width="14" height="14" rx="3" fill="#f2c94c" {...S} transform="rotate(-42 68 32)" />
        </g>
      );
    case "rice":
      return (
        <g>
          <path d="M26 50 q4 -14 12 -12 q4 -10 12 -8 q8 -6 14 4 q10 0 10 16 Z" fill="#fffdf8" {...S} />
          <path d="M38 44 h4 M50 38 h4 M58 46 h4 M44 50 h3" stroke="#e6dccb" strokeWidth="2" strokeLinecap="round" />
          <circle cx="46" cy="42" r="5" fill="#b5654a" {...S} strokeWidth={2} />
          <circle cx="58" cy="40" r="4" fill="#5e6b47" {...S} strokeWidth={2} />
          <path d="M18 52 H82 A32 28 0 0 1 18 52 Z" fill="#5e6b47" {...S} />
          <path d="M30 64 h40" stroke="#e3e5d3" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 6" />
          <path d="M66 14 L84 40 M74 12 L88 36" stroke="#8a6420" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "chicken":
      return (
        <g>
          <path d="M58 52 L76 70" stroke="#fffdf8" strokeWidth="8" strokeLinecap="round" />
          <path d="M58 52 L76 70" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="78" cy="68" r="5" fill="#fffdf8" {...S} />
          <circle cx="74" cy="74" r="5" fill="#fffdf8" {...S} />
          <path d="M60 50 C70 30, 46 14, 30 26 C16 36, 22 60, 42 62 C50 63, 56 56, 60 50 Z" fill="#c9773f" {...S} />
          <path d="M32 34 q4 -4 10 -3" fill="none" stroke="#f4e6c6" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "ribs":
      return (
        <g>
          <rect x="18" y="34" width="64" height="34" rx="12" fill="#8e4632" {...S} />
          {[30, 42, 54, 66].map((x) => (
            <g key={x}>
              <path d={`M${x} 34 V68`} stroke="#b5654a" strokeWidth="3" />
              <path d={`M${x} 30 V34 M${x} 68 V72`} stroke="#fffdf8" strokeWidth="5" strokeLinecap="round" />
            </g>
          ))}
          <path d="M26 44 q24 6 48 0" fill="none" stroke="#d9825f" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "pot":
      return (
        <g>
          <path d="M42 22 q-4 5 0 10 M56 20 q-4 5 0 10" fill="none" stroke="#d2a24c" strokeWidth="3" strokeLinecap="round" />
          <rect x="44" y="34" width="12" height="6" rx="3" fill="#4f5b3a" />
          <path d="M20 42 h60" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M22 44 h56 v22 a12 12 0 0 1 -12 12 h-32 a12 12 0 0 1 -12 -12 Z" fill="#b5654a" {...S} />
          <path d="M22 50 h-6 M78 50 h6" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="40" cy="60" r="2.2" fill={INK} />
          <circle cx="60" cy="60" r="2.2" fill={INK} />
          <path d="M45 66 q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="34" cy="65" r="3" fill="#d9825f" opacity="0.8" />
          <circle cx="66" cy="65" r="3" fill="#d9825f" opacity="0.8" />
        </g>
      );
    case "sausage":
      return (
        <g>
          <ellipse cx="50" cy="62" rx="38" ry="16" fill="#fffdf8" {...S} />
          <rect x="22" y="44" width="40" height="13" rx="6.5" fill="#8e4632" {...S} transform="rotate(-10 42 50)" />
          <rect x="36" y="56" width="40" height="13" rx="6.5" fill="#b5654a" {...S} transform="rotate(8 56 62)" />
          <path d="M26 66 q6 -4 10 2 M64 52 q6 -4 12 0" fill="none" stroke="#5e6b47" strokeWidth="4" strokeLinecap="round" />
          <path d="M28 54 q4 2 6 6" fill="none" stroke="#f2c94c" strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "steak":
      return (
        <g>
          <ellipse cx="50" cy="62" rx="38" ry="16" fill="#fffdf8" {...S} />
          <path d="M26 54 C24 38, 50 34, 62 42 C74 48, 76 62, 62 64 C48 66, 28 66, 26 54 Z" fill="#8e4632" {...S} />
          <path d="M36 48 l18 10 M42 44 l18 10" stroke="#b5654a" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M68 62 q6 -8 12 -4" fill="none" stroke="#5e6b47" strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case "nightoff":
      return (
        <g>
          <path d="M28 26 L76 40 L42 82 Z" fill="#f2c94c" {...S} />
          <path d="M26 26 q26 2 52 14" fill="none" stroke="#c9773f" strokeWidth="7" strokeLinecap="round" />
          <circle cx="50" cy="48" r="5" fill="#b5654a" />
          <circle cx="44" cy="62" r="4.5" fill="#b5654a" />
          <circle cx="58" cy="54" r="2" fill="#5e6b47" />
          <circle cx="38" cy="44" r="2" fill="#5e6b47" />
          <path d="M80 18 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="#d2a24c" />
        </g>
      );
  }
}

export function FoodArt({ name, protein, kind, className = "h-16 w-16", rounded = "rounded-2xl" }: {
  name?: string | null; protein?: string | null; kind?: FoodKind; className?: string; rounded?: string;
}) {
  const k = kind ?? foodKind(name, protein);
  return (
    <div
      aria-hidden="true"
      className={`relative shrink-0 overflow-hidden ${rounded} ${className}`}
      style={{
        backgroundColor: BG[k],
        backgroundImage: "radial-gradient(rgb(255 253 248 / 0.7) 1.5px, transparent 1.6px)",
        backgroundSize: "12px 12px",
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 m-auto h-[82%] w-[82%]">
        <Drawing kind={k} />
      </svg>
    </div>
  );
}
