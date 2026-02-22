/* Crown & Quill Chronicle: Rumor Ledger
   Generates a handful of in-universe rumors on page load.
   Safe, lightweight, and fully client-side. */

const $ = (sel) => document.querySelector(sel);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const uniq = (n, make) => {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < n && guard < n * 50) {
    guard += 1;
    const v = make();
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const titleCase = (s) => s.replace(/\b\w/g, (m) => m.toUpperCase());

// --- Layout sync -----------------------------------------------------------
// Request: make the scrolling rumor lane only as wide as the masthead title.
// This also prevents the marquee (which duplicates items) from forcing the masthead
// card to expand to the full container width.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function syncRumorLaneToTitle() {
  const list = $("#cq-rumors");
  const title = document.querySelector(".cqMastheadTitleRow .crownTitle");
  if (!list || !title) return;

  const titleW = Math.ceil(title.getBoundingClientRect().width);
  if (!titleW || titleW < 140) return;

  // Cap to the viewport so we never cause horizontal overflow.
  const viewportCap = Math.floor(window.innerWidth - 24);
  const finalW = clamp(titleW, 240, viewportCap);

  list.style.maxWidth = `${finalW}px`;
  list.style.marginLeft = "auto";
  list.style.marginRight = "auto";
}

let cqRumorLaneBound = false;
let cqRumorLaneTimer = null;
function queueRumorLaneSync() {
  clearTimeout(cqRumorLaneTimer);
  cqRumorLaneTimer = setTimeout(syncRumorLaneToTitle, 90);
}

function buildRumor() {
  const places = [
    "Lantern-Leaf Harbor",
    "the Glass Arcade",
    "the Crown Plaza",
    "Lens Tower",
    "the Dragonstone Atrium",
    "the Scriptorium",
    "the Old Subway Line",
    "Moonlit Bridge",
    "the Ward Gardens",
    "the Night Market",
    "the River-Quay Steps",
    "the Cathedral of Quiet Echoes",
  ];

  const actors = [
    "a Holy Night",
    "an archivist in ash-gray gloves",
    "a courier with a sealed satchel",
    "a first-year from the School of Touch",
    "a lenswright",
    "a dockhand with ink-stained palms",
    "a masked inspector",
    "a Royals aide",
    "a mirror-mage",
    "an owl-headed merchant",
    "a choir-singer",
    "a mapmaker",
  ];

  const artifacts = [
    "a lens that shows yesterday",
    "a ring bound in ember-thread",
    "a feather that points toward magic",
    "a mirror that remembers faces",
    "a parchment that rewrites itself",
    "a compass that refuses north",
    "a coin that hums when lies are told",
    "a vial of starlight ink",
    "a pocket watch stuck on the third bell",
    "a charm etched with cathedral runes",
  ];

  const happenings = [
    "a ward flickered and nobody admitted it",
    "a shipment was quietly rerouted",
    "someone offered a blessing for a price",
    "a private duel was called off at the last heartbeat",
    "a bell rang without being struck",
    "a meeting ended before it began",
    "a name was scratched out of the registry",
    "a corridor appeared where there shouldn't be one",
    "a familiar bird refused to land",
    "a candle burned blue at noon",
  ];

  const timePhrases = [
    "after vespers",
    "at first light",
    "at the third bell",
    "between midnight and the ink-dry hour",
    "during the rain's quietest minute",
    "when the lanterns blink",
  ];

  const sources = [
    "overheard near a brass samovar",
    "whispered between library stacks",
    "scribbled in the margins of a borrowed book",
    "murmured by a conductor on Line 3",
    "passed hand-to-hand like a warm coin",
    "told by someone who wouldn't give their name",
    "carried on a paper crane",
  ];

  const templates = [
    () => `${titleCase(pick(actors))} was seen at ${pick(places)} carrying ${pick(artifacts)} ${pick(["under a cloak", "in plain sight", "wrapped in velvet", "tucked into a coat lining"]) }.`,
    () => `Rumor says ${pick(happenings)} at ${pick(places)} ${pick(timePhrases)}.`,
    () => `A note claims ${pick(places)} is "closed for repairs" but ${pick(["the lights are still on", "the doors keep opening", "someone keeps going in", "the guards look away"]) }.`,
    () => `Someone swears ${pick(artifacts)} is changing hands at ${pick(places)} ${pick(timePhrases)}.`,
    () => `They say a secret gathering is planned beneath ${pick(places)} ${pick(timePhrases)} and the password is "${pick(["Candle & Ink", "Hush", "Roseglass", "Vow", "Third Bell"]) }".`,
  ];

  const text = pick(templates)();
  const source = pick(sources);
  const heat = pick(["faint", "smoldering", "hot", "icy", "gold-tinged"]);
  return { text, source, heat };
}

function formatEditionStamp(now = new Date()) {
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Filed ${dateFmt.format(now)} · ${timeFmt.format(now)}`;
}

function rumorCount() {
  const mq = window.matchMedia("(max-width: 520px)");
  return mq.matches ? 4 : 6;
}

function renderRumors(rumors) {
  const list = $("#cq-rumors");
  const meta = $("#cq-rumor-meta");
  if (!list) return;
  list.innerHTML = "";

  for (const r of rumors) {
    const li = document.createElement("li");
    li.className = "cqRumorItem";

    const badge = document.createElement("span");
    badge.className = "cqRumorBadge";
    badge.textContent = "RUMOR";
    badge.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    body.className = "cqRumorBody";

    const text = document.createElement("p");
    text.className = "cqRumorText";
    text.textContent = r.text;

    const sub = document.createElement("p");
    sub.className = "muted small cqRumorSub";
    sub.textContent = `${r.heat} · ${r.source}`;

    body.appendChild(text);
    body.appendChild(sub);

    li.appendChild(badge);
    li.appendChild(body);
    list.appendChild(li);
  }

  if (meta) { meta.textContent = ""; meta.hidden = true; }

  // After rendering, enable the continuous left-scroll ticker.
  // (Respects prefers-reduced-motion, and restarts cleanly on reroll/resizes.)
  setupRumorMarquee();
}

// --- Marquee (continuous left scroll) --------------------------------------
// We duplicate the rumor cards once and then auto-advance scrollLeft.
// When we reach the end of the first set, we wrap seamlessly.
let cqRumorMarquee = { raf: null, lastTs: 0, paused: false };

function stopRumorMarquee() {
  if (cqRumorMarquee.raf) {
    cancelAnimationFrame(cqRumorMarquee.raf);
    cqRumorMarquee.raf = null;
  }
  cqRumorMarquee.lastTs = 0;
}

function setupRumorMarquee() {
  const list = $("#cq-rumors");
  if (!list) return;

  // Always keep the lane sized to the title (even if marquee is disabled).
  syncRumorLaneToTitle();

  // Respect reduced motion.
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduce) {
    stopRumorMarquee();
    list.classList.remove("cqMarquee");
    return;
  }

  // Remove any prior clones from a previous run.
  stopRumorMarquee();
  list.querySelectorAll("[data-cq-clone='1']").forEach((n) => n.remove());

  const originals = Array.from(list.children);
  if (originals.length < 2) return; // nothing meaningful to scroll

  const frag = document.createDocumentFragment();
  for (const li of originals) {
    const clone = li.cloneNode(true);
    clone.dataset.cqClone = "1";
    clone.setAttribute("aria-hidden", "true");
    frag.appendChild(clone);
  }
  list.appendChild(frag);

  list.classList.add("cqMarquee");
  list.scrollLeft = 0;

  // Pause on hover/focus so users can read.
  const onEnter = () => (cqRumorMarquee.paused = true);
  const onLeave = () => (cqRumorMarquee.paused = false);
  list.onmouseenter = onEnter;
  list.onmouseleave = onLeave;
  list.onfocusin = onEnter;
  list.onfocusout = onLeave;

  const pxPerSecond = 38; // speed tuning
  const step = (ts) => {
    if (!cqRumorMarquee.lastTs) cqRumorMarquee.lastTs = ts;
    const dt = ts - cqRumorMarquee.lastTs;
    cqRumorMarquee.lastTs = ts;

    if (!cqRumorMarquee.paused) {
      const resetAt = list.scrollWidth / 2;
      list.scrollLeft += (dt * pxPerSecond) / 1000;
      if (list.scrollLeft >= resetAt) {
        list.scrollLeft -= resetAt;
      }
    }

    cqRumorMarquee.raf = requestAnimationFrame(step);
  };

  cqRumorMarquee.raf = requestAnimationFrame(step);
}

function loadCachedRumors() {
  try {
    const raw = sessionStorage.getItem("cqRumors");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items) || !parsed.savedAt) return null;
    // keep cache for 20 minutes
    if (Date.now() - parsed.savedAt > 20 * 60 * 1000) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function saveCachedRumors(items) {
  try {
    sessionStorage.setItem("cqRumors", JSON.stringify({ items, savedAt: Date.now() }));
  } catch {
    // ignore storage errors
  }
}

function generateAndRender() {
  const count = rumorCount();
  const items = uniq(count, () => {
    const r = buildRumor();
    return JSON.stringify(r);
  }).map((s) => JSON.parse(s));
  saveCachedRumors(items);
  renderRumors(items);
}

function initRumors() {
  const host = $("#cq-rumors");
  if (!host) return; // not on this page

  // Bind a single resize listener to keep the rumor lane matched to the title.
  if (!cqRumorLaneBound) {
    cqRumorLaneBound = true;
    window.addEventListener("resize", queueRumorLaneSync, { passive: true });
    window.addEventListener("orientationchange", queueRumorLaneSync, { passive: true });
  }

  const cached = loadCachedRumors();
  if (cached) {
    renderRumors(cached);
  } else {
    generateAndRender();
  }

  // Ensure initial sizing occurs even before the marquee kicks in.
  syncRumorLaneToTitle();

  const btn = $("#cq-reroll-rumors");
  if (btn) {
    btn.addEventListener("click", () => {
      generateAndRender();
      btn.blur();
    });
  }

  // If the viewport crosses the rumorCount breakpoint, re-render with the right amount.
  const mq = window.matchMedia("(max-width: 520px)");
  mq.addEventListener?.("change", () => generateAndRender());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initRumors);
} else {
  initRumors();
}
