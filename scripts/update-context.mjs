#!/usr/bin/env node
// Regenerates the auto-maintained context views from the feature specs, so the
// project's "current state" never drifts from reality and can be read from one
// small file instead of re-derived from every doc.
//
// Single source of truth per feature: its spec's `> Status:` line, plus whether
// the file lives in context/features/completed/ (shipped).
//
// Fills the marked blocks in:
//   - context/STATE.md            (the read-first snapshot)
//   - context/features/backlog.md (the status table)
//
// Usage:
//   node scripts/update-context.mjs          # rewrite the generated blocks
//   node scripts/update-context.mjs --check  # exit 1 if anything is stale (CI)

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES = join(ROOT, "context", "features");
const COMPLETED = join(FEATURES, "completed");
const START = "<!-- context:features:start -->";
const END = "<!-- context:features:end -->";

const STATUS = {
  implemented: { label: "✅ Done", rank: 0 },
  "in progress": { label: "🔨 In progress", rank: 1 },
  designed: { label: "📐 Designed", rank: 2 },
  proposed: { label: "• Proposed", rank: 3 },
  unknown: { label: "? Unknown", rank: 4 },
};

function normalizeStatus(raw) {
  const s = raw.replace(/[*`]/g, "").toLowerCase();
  if (s.includes("implemented")) return "implemented";
  if (s.includes("in progress") || s.includes("in-progress")) return "in progress";
  if (s.includes("designed")) return "designed";
  if (s.includes("proposed")) return "proposed";
  return "unknown";
}

async function readFeature(dir, file) {
  const md = await readFile(join(dir, file), "utf8");
  const idMatch = file.match(/^(\d+)-/);
  const id = idMatch ? idMatch[1] : "??";
  const statusLine = md.match(/^>\s*Status:\s*(.+)$/m);
  const status = normalizeStatus(statusLine ? statusLine[1] : "");
  const titleLine = md.match(/^#\s+(.+)$/m);
  let title = titleLine ? titleLine[1].trim() : file;
  // "Feature 01 — The Empty Yellow (walkable base Backrooms)" -> "The Empty Yellow"
  title = title.replace(/^Feature\s+\d+\s*[—-]\s*/i, "").replace(/\s*\(.*\)$/, "");
  return { id, title, status, file, path: join(dir, file) };
}

async function collect() {
  const out = [];
  for (const [dir] of [[FEATURES], [COMPLETED]]) {
    let entries;
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of entries) {
      if (/^\d+-.*\.md$/.test(f)) out.push(await readFeature(dir, f));
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

// Build a markdown link to a feature's spec, relative to the file that will
// contain the link.
function linkFrom(fromFile, feature) {
  let rel = relative(dirname(fromFile), feature.path).split("\\").join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return `[${feature.id}](${rel})`;
}

function renderTable(fromFile, features) {
  const rows = features.map(
    (f) => `| ${linkFrom(fromFile, f)} | ${f.title} | ${STATUS[f.status].label} |`,
  );
  return ["| ID | Feature | Status |", "| --- | --- | --- |", ...rows].join("\n");
}

function renderSnapshot(fromFile, features) {
  const groups = [
    ["Done", "implemented"],
    ["In progress", "in progress"],
    ["Designed", "designed"],
    ["Proposed", "proposed"],
  ];
  const lines = [];
  for (const [heading, key] of groups) {
    const items = features.filter((f) => f.status === key);
    if (!items.length) continue;
    lines.push(`**${heading}** — ${items.map((f) => `${linkFrom(fromFile, f)} ${f.title}`).join(" · ")}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function splice(content, block) {
  const s = content.indexOf(START);
  const e = content.indexOf(END);
  if (s === -1 || e === -1) {
    throw new Error(`Missing ${START} / ${END} markers`);
  }
  return content.slice(0, s + START.length) + "\n" + block + "\n" + content.slice(e);
}

async function apply(file, render, features, check, stale) {
  const content = await readFile(file, "utf8");
  const next = splice(content, render(file, features));
  if (next !== content) {
    if (check) {
      stale.push(relative(ROOT, file));
    } else {
      await writeFile(file, next);
      console.log("updated " + relative(ROOT, file));
    }
  }
}

const check = process.argv.includes("--check");
const features = await collect();
const stale = [];
await apply(join(ROOT, "context", "STATE.md"), renderSnapshot, features, check, stale);
await apply(join(FEATURES, "backlog.md"), renderTable, features, check, stale);

if (check && stale.length) {
  console.error("Stale context (run `npm run context`):\n  " + stale.join("\n  "));
  process.exit(1);
}
if (!check) console.log(`context up to date (${features.length} features)`);
