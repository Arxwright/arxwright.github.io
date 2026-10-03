// Generates every Arxwright brand asset from one geometry: `bun run build` (needs rsvg-convert for PNGs).
// The mark: three voussoirs of an arch, the keystone proud, a wedge-headed club hammer cut from it.
// The wordmark: Tenor Sans capitals, outlined so no asset depends on the font being installed.
import opentype from "opentype.js";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const COLORS = {
  light: { bg: "#f2f4f1", mark: "#2e5b50", ink: "#1f2a27" },
  dark: { bg: "#151d1b", mark: "#86b8aa", ink: "#dfe7e4" },
};

const f = (n: number) => +n.toFixed(2);
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (cx: number, cy: number, r: number, a: number) =>
  `${f(cx + r * Math.cos(rad(a)))},${f(cy - r * Math.sin(rad(a)))}`;
const poly = (pts: [number, number][]) => "M" + pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" L") + " Z";

// Annular sector between angles a0..a1 (degrees, 0 = right, counter-clockwise) with radial joints.
const voussoir = (cx: number, cy: number, r1: number, r2: number, a0: number, a1: number) =>
  `M${pt(cx, cy, r2, a0)} A${r2},${r2} 0 0 0 ${pt(cx, cy, r2, a1)} L${pt(cx, cy, r1, a1)} A${r1},${r1} 0 0 1 ${pt(cx, cy, r1, a0)} Z`;

// Arch centre sits below the canvas so only the crown shows. KEY is the keystone's half-angle.
const CY = 124, R1 = 52, R2 = 92, KEY = 11.5, LIFT = 10, GAP = 3.2;
const flanks = [voussoir(50, CY, R1, R2, 90 + KEY + GAP, 119), voussoir(50, CY, R1, R2, 61, 90 - KEY - GAP)];
const key = voussoir(50, CY, R1, R2 + LIFT, 90 - KEY, 90 + KEY);

// The head's ends run parallel to the keystone's sides, so the head is a small keystone itself.
const T = Math.tan(rad(KEY)), INSET = 4.5, HT = 26, HB = 41, CH = 1.6;
const half = (y: number) => (CY - y) * T - INSET;
const head = poly([
  [50 - half(HT) + CH, HT], [50 + half(HT) - CH, HT], [50 + half(HT + CH), HT + CH],
  [50 + half(HB - CH), HB - CH], [50 + half(HB) - CH, HB], [50 - half(HB) + CH, HB],
  [50 - half(HB - CH), HB - CH], [50 - half(HT + CH), HT + CH],
]);
const handle = poly([[45, 41], [55, 41], [53.4, 45.5], [53.4, 63], [54.6, 66], [50, 69.5], [45.4, 66], [46.6, 63], [46.6, 45.5]]);

// The hammer lies wholly inside the keystone, so even-odd filling cuts it out with no mask.
const markPaths = (fill?: string) => {
  const fa = fill ? ` fill="${fill}"` : "";
  return flanks.map((d) => `<path${fa} d="${d}"/>`).join("") + `<path${fa} fill-rule="evenodd" d="${key} ${head} ${handle}"/>`;
};
const MARK_BOX = { x: 4, y: 20, w: 92, h: 60 }; // tight around the drawn shapes

const svgDoc = (vb: string, body: string, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${body}</svg>\n`;

// Wordmark: tracked capitals, laid out glyph by glyph so kerning and tracking both apply.
const font = opentype.parse(readFileSync(new URL("./fonts/TenorSans-Regular.ttf", import.meta.url)).buffer);
const SIZE = 100, TRACK = 0.14 * SIZE;
function wordmark(text: string) {
  const glyphs = font.stringToGlyphs(text);
  const scale = SIZE / font.unitsPerEm;
  let x = 0;
  const parts: string[] = [];
  glyphs.forEach((g, i) => {
    parts.push(g.getPath(x, 0, SIZE).toPathData(2));
    x += g.advanceWidth! * scale + TRACK;
    if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return { d: parts.join(""), width: x - TRACK };
}
const CAP = (font.tables.os2.sCapHeight / font.unitsPerEm) * SIZE;
const word = wordmark("ARXWRIGHT");

// Lockup: mark 1.3× cap height, centred on the capitals, gap 0.45em.
function lockup(c: (typeof COLORS)["light"]) {
  const s = (CAP * 1.3) / MARK_BOX.h;
  const mw = MARK_BOX.w * s, gap = 0.45 * SIZE, pad = 0.1 * SIZE;
  const top = -CAP / 2 - (MARK_BOX.h * s) / 2; // capitals span y = -CAP..0
  const body =
    `<g transform="translate(0 ${f(top)}) scale(${f(s)}) translate(${-MARK_BOX.x} ${-MARK_BOX.y})">${markPaths(c.mark)}</g>` +
    `<path fill="${c.ink}" transform="translate(${f(mw + gap)} 0)" d="${word.d}"/>`;
  const H = Math.max(MARK_BOX.h * s, CAP) + 2 * pad;
  return svgDoc(`${f(-pad)} ${f(-CAP / 2 - H / 2)} ${f(mw + gap + word.width + 2 * pad)} ${f(H)}`, body);
}

const out = new URL("./out/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const write = (name: string, s: string) => writeFileSync(out + name, s);
const vb = `${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.w} ${MARK_BOX.h}`;

write("mark.svg", svgDoc(vb, markPaths("currentColor")));
for (const [t, c] of Object.entries(COLORS)) {
  write(`mark-${t}.svg`, svgDoc(vb, markPaths(c.mark)));
  write(`wordmark-${t}.svg`, svgDoc(`0 ${f(-CAP - 4)} ${f(word.width)} ${f(CAP + 8)}`, `<path fill="${c.ink}" d="${word.d}"/>`));
  write(`lockup-${t}.svg`, lockup(c));
}

// Favicon follows the browser's theme; app icons are opaque tiles, which home screens require.
const square = (inner: string, bg?: string) =>
  svgDoc("0 0 100 100", (bg ? `<rect width="100" height="100" fill="${bg}"/>` : "") +
    `<g transform="translate(50 50) scale(${bg ? 0.8 : 1}) translate(-50 ${-(MARK_BOX.y + MARK_BOX.h / 2)})">${inner}</g>`);
write("favicon.svg", square(
  `<style>path{fill:${COLORS.light.mark}}@media (prefers-color-scheme:dark){path{fill:${COLORS.dark.mark}}}</style>${markPaths()}`,
));
write("icon-tile.svg", square(markPaths(COLORS.light.mark), COLORS.light.bg));
for (const [t, c] of Object.entries(COLORS)) write(`mark-${t}-square.svg`, square(markPaths(c.mark)));

const png = (src: string, dst: string, size: number) =>
  execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), out + src, "-o", out + dst]);
png("favicon.svg", "favicon-32.png", 32);
png("icon-tile.svg", "apple-touch-icon.png", 180);
png("icon-tile.svg", "icon-512.png", 512);
png("mark-light-square.svg", "mark-light-512.png", 512);
png("mark-dark-square.svg", "mark-dark-512.png", 512);

console.log("wrote", out);
