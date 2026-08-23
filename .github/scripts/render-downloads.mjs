/**
 * Regenerate the downloads table in README.md from a release's actual assets.
 *
 * Reads the tag and the asset list from argv/stdin rather than guessing
 * filenames: a rename in the Tauri bundle config would otherwise produce a
 * table of 404s on the public landing page. Only the region between the
 * markers is touched, so the surrounding prose stays hand-editable.
 *
 *   node render-downloads.mjs <tag> <readme-path>   # assets JSON on stdin
 */
import { readFileSync, writeFileSync } from "node:fs";

const START = "<!-- downloads:start -->";
const END = "<!-- downloads:end -->";

// Extension → which row it belongs in, and how to label it. Order within a row
// is the order listed here, so the primary installer comes first.
const ROWS = [
  { os: "**macOS** (Apple silicon + Intel)", exts: [".dmg"] },
  { os: "**Windows**", exts: [".exe", ".msi"] },
  { os: "**Linux**", exts: [".AppImage", ".deb"] },
];

const [tag, readmePath] = process.argv.slice(2);
if (!tag || !readmePath) {
  console.error("usage: render-downloads.mjs <tag> <readme-path>  (assets JSON on stdin)");
  process.exit(2);
}

const assets = JSON.parse(readFileSync(0, "utf8")).map((a) => (typeof a === "string" ? a : a.name));
if (assets.length === 0) {
  console.error("::error::release has no assets — refusing to write a table of dead links");
  process.exit(1);
}

const link = (name, label) => `[${label}](../../releases/download/${tag}/${name})`;

const lines = [];
for (const { os, exts } of ROWS) {
  const found = [];
  for (const ext of exts) {
    for (const name of assets.filter((n) => n.endsWith(ext))) {
      // First entry in a row is named in full; the alternates are just the
      // extension, which is how the table read when maintained by hand.
      found.push(link(name, found.length === 0 && ext === exts[0] ? name : ext));
    }
  }
  // A platform that produced nothing is omitted rather than rendered empty —
  // the release itself failing is the signal, not a blank table cell.
  if (found.length > 0) lines.push(`| ${os} | ${found.join(" · ")} |`);
}

if (lines.length === 0) {
  console.error("::error::no assets matched any known installer extension");
  process.exit(1);
}

const table = [
  `Direct links for the current **${tag}**:`,
  "",
  "| OS | Download |",
  "|---|---|",
  ...lines,
].join("\n");

const readme = readFileSync(readmePath, "utf8");
const s = readme.indexOf(START);
const e = readme.indexOf(END);
if (s === -1 || e === -1 || e < s) {
  console.error(`::error::markers ${START} / ${END} not found in ${readmePath}`);
  process.exit(1);
}

const next = readme.slice(0, s + START.length) + "\n" + table + "\n" + readme.slice(e);
if (next === readme) {
  console.log("README already current — nothing to do.");
  process.exit(0);
}
writeFileSync(readmePath, next);
console.log(`README updated for ${tag} (${assets.length} assets).`);
