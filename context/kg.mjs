#!/usr/bin/env node
// Tiny zero-dependency query tool for the repo knowledge graph
// (context/knowledge.json). The point is to answer "what/why/how does X relate"
// from a compact structured source instead of re-reading goal.md + decisions.md
// + the source every time — cheaper on tokens, and a quick way to "chat" with
// the codebase's own memory.
//
//   node context/kg.mjs                 overview (nodes by type)
//   node context/kg.mjs show <id>       a node + everything it links to
//   node context/kg.mjs find <term...>  search names/summaries/tags/ids
//   node context/kg.mjs neighbors <id> [depth]   what's connected (BFS)
//   node context/kg.mjs why <id>        decisions/conventions behind it
//   node context/kg.mjs path <a> <b>    how two nodes connect
//   node context/kg.mjs check           validate the graph
//   node context/kg.mjs render          regenerate context/KNOWLEDGE.md
//
// Also wired as `npm run kg -- <cmd>`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GRAPH = join(HERE, "knowledge.json");

const g = JSON.parse(readFileSync(GRAPH, "utf8"));
const byId = new Map(g.nodes.map((n) => [n.id, n]));
const name = (id) => byId.get(id)?.name ?? id;
const out = (...a) => console.log(...a);

function outgoing(id) {
  return g.edges.filter((e) => e.from === id);
}
function incoming(id) {
  return g.edges.filter((e) => e.to === id);
}

// ── overview ───────────────────────────────────────────────────────────────
function cmdMap() {
  out(`# ${g.nodes.length} nodes · ${g.edges.length} edges · updated ${g.meta.updated}\n`);
  const types = [...new Set(g.nodes.map((n) => n.type))];
  for (const t of types) {
    out(`${t.toUpperCase()}`);
    for (const n of g.nodes.filter((n) => n.type === t)) out(`  ${n.id.padEnd(24)} ${n.name}`);
    out("");
  }
  out(`Query a node:  node context/kg.mjs show <id>`);
}

// ── one node + its relations ─────────────────────────────────────────────────
function cmdShow(id) {
  const n = byId.get(id);
  if (!n) return notFound(id);
  const meta = [n.type, n.file, n.date, n.ref].filter(Boolean).join(" · ");
  out(`${n.name}  [${meta}]`);
  if (n.summary) out(n.summary);
  if (n.tags?.length) out(`tags: ${n.tags.join(", ")}`);
  const og = outgoing(id);
  const ic = incoming(id);
  if (og.length) {
    out(`\n→ outgoing`);
    for (const e of og) out(`    ${e.rel.padEnd(13)} ${e.to.padEnd(24)} (${name(e.to)})`);
  }
  if (ic.length) {
    out(`\n← incoming`);
    for (const e of ic) out(`    ${e.rel.padEnd(13)} ${e.from.padEnd(24)} (${name(e.from)})`);
  }
}

// ── keyword search ───────────────────────────────────────────────────────────
function cmdFind(terms) {
  const q = terms.join(" ").toLowerCase();
  const hits = g.nodes.filter((n) =>
    [n.id, n.name, n.summary, (n.tags || []).join(" ")].join(" ").toLowerCase().includes(q)
  );
  if (!hits.length) return out(`no nodes match "${q}"`);
  for (const n of hits) out(`  ${n.id.padEnd(24)} [${n.type}] ${n.name} — ${n.summary ?? ""}`);
}

// ── BFS neighbourhood ────────────────────────────────────────────────────────
function cmdNeighbors(id, depth = 1) {
  if (!byId.has(id)) return notFound(id);
  const seen = new Set([id]);
  let frontier = [id];
  for (let d = 1; d <= depth; d++) {
    const next = [];
    out(`\n· depth ${d}`);
    for (const cur of frontier) {
      for (const e of outgoing(cur)) if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to); out(`    ${name(cur)} —${e.rel}→ ${name(e.to)}`); }
      for (const e of incoming(cur)) if (!seen.has(e.from)) { seen.add(e.from); next.push(e.from); out(`    ${name(e.from)} —${e.rel}→ ${name(cur)}`); }
    }
    frontier = next;
    if (!frontier.length) break;
  }
}

// ── "why is this the way it is" ──────────────────────────────────────────────
function cmdWhy(id) {
  const n = byId.get(id);
  if (!n) return notFound(id);
  out(`Why "${n.name}"?`);
  const drivers = incoming(id).filter((e) => ["establishes", "constrains"].includes(e.rel));
  if (!drivers.length && !n.ref) return out("  (no linked decision/convention — see summary)");
  for (const e of drivers) {
    const src = byId.get(e.from);
    out(`  ${e.rel}: ${src.name}${src.date ? ` (${src.date})` : ""} — ${src.summary ?? ""}`);
    if (src.ref) out(`      details: ${src.ref}`);
  }
  if (n.ref) out(`  see also: ${n.ref}`);
}

// ── shortest relation path (edges treated as undirected) ─────────────────────
function cmdPath(a, b) {
  if (!byId.has(a)) return notFound(a);
  if (!byId.has(b)) return notFound(b);
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) break;
    for (const e of g.edges) {
      const step = e.from === cur ? [e.to, `—${e.rel}→`] : e.to === cur ? [e.from, `←${e.rel}—`] : null;
      if (step && !prev.has(step[0])) { prev.set(step[0], [cur, step[1]]); queue.push(step[0]); }
    }
  }
  if (!prev.has(b)) return out(`no path between ${a} and ${b}`);
  const chain = [];
  for (let cur = b; cur; cur = prev.get(cur)?.[0]) chain.unshift([cur, prev.get(cur)?.[1]]);
  out(chain.map(([id, rel], i) => (i ? `  ${rel} ` : "") + name(id)).join("\n"));
}

// ── integrity check ──────────────────────────────────────────────────────────
function cmdCheck() {
  const problems = [];
  const ids = new Set();
  for (const n of g.nodes) {
    if (ids.has(n.id)) problems.push(`duplicate id: ${n.id}`);
    ids.add(n.id);
    if (!n.type || !n.name) problems.push(`node missing type/name: ${n.id}`);
  }
  for (const e of g.edges) {
    if (!byId.has(e.from)) problems.push(`edge from missing node: ${e.from}`);
    if (!byId.has(e.to)) problems.push(`edge to missing node: ${e.to}`);
    if (!g.meta.relations[e.rel]) problems.push(`unknown relation "${e.rel}" (${e.from}→${e.to})`);
  }
  const linked = new Set(g.edges.flatMap((e) => [e.from, e.to]));
  const orphans = g.nodes.filter((n) => !linked.has(n.id)).map((n) => n.id);
  if (orphans.length) problems.push(`orphan nodes (no edges): ${orphans.join(", ")}`);
  if (!problems.length) out(`OK — ${g.nodes.length} nodes, ${g.edges.length} edges, no problems.`);
  else { problems.forEach((p) => out(`✗ ${p}`)); process.exitCode = 1; }
}

// ── regenerate the human-readable view ───────────────────────────────────────
function cmdRender() {
  const L = ["# Knowledge graph", "", `> Generated from \`knowledge.json\` by \`npm run kg -- render\` — do not hand-edit. ${g.nodes.length} nodes · ${g.edges.length} edges · updated ${g.meta.updated}.`, "", g.meta.about, "", "## Relations", ""];
  for (const [r, d] of Object.entries(g.meta.relations)) L.push(`- \`${r}\` — ${d}`);
  const types = [...new Set(g.nodes.map((n) => n.type))];
  for (const t of types) {
    L.push("", `## ${t}s`, "");
    for (const n of g.nodes.filter((n) => n.type === t)) {
      const meta = [n.file, n.date, n.ref].filter(Boolean).join(" · ");
      L.push(`### ${n.name} \`${n.id}\`${meta ? ` — ${meta}` : ""}`);
      if (n.summary) L.push(n.summary);
      const rels = outgoing(n.id).map((e) => `${e.rel} → **${name(e.to)}**`);
      if (rels.length) L.push("", rels.join(" · "));
      L.push("");
    }
  }
  writeFileSync(join(HERE, "KNOWLEDGE.md"), L.join("\n"));
  out("wrote context/KNOWLEDGE.md");
}

function notFound(id) {
  out(`no node "${id}". Try:  node context/kg.mjs find ${id}`);
  process.exitCode = 1;
}

// ── dispatch ─────────────────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case undefined:
  case "map": cmdMap(); break;
  case "show": cmdShow(args[0]); break;
  case "find": cmdFind(args); break;
  case "neighbors": cmdNeighbors(args[0], Number(args[1]) || 1); break;
  case "why": cmdWhy(args[0]); break;
  case "path": cmdPath(args[0], args[1]); break;
  case "check": cmdCheck(); break;
  case "render": cmdRender(); break;
  default: out(`unknown command "${cmd}". Commands: map, show, find, neighbors, why, path, check, render`); process.exitCode = 1;
}
