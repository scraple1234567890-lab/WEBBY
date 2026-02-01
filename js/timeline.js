/* Timeline page renderer (static JSON -> filters -> lore cards) */

const TIERS = [
  { id: "public", label: "Public only" },
  { id: "book1", label: "Up to Book 1" },
  { id: "book2", label: "Up to Book 2" },
  { id: "full", label: "Full spoilers" },
];

function tierRank(tierId) {
  const idx = TIERS.findIndex((t) => t.id === tierId);
  return idx === -1 ? TIERS.length : idx;
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function buildSearchBlob(event) {
  const chunks = [
    safeText(event.title),
    safeText(event.hook),
    safeText(event.when),
    safeText(event.arc),
    safeText(event.mystery_tag),
    ...normalizeArray(event.facts).map(safeText),
  ];

  const relatedBuckets = [
    normalizeArray(event.related_characters),
    normalizeArray(event.related_locations),
    normalizeArray(event.related_artifacts),
    normalizeArray(event.tags),
  ];

  for (const bucket of relatedBuckets) {
    for (const item of bucket) {
      if (typeof item === "string") chunks.push(item);
      if (item && typeof item === "object") {
        chunks.push(safeText(item.name));
        chunks.push(safeText(item.label));
      }
    }
  }

  return chunks
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSortKey(event) {
  if (event.date) {
    const t = Date.parse(event.date);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof event.sort_index === "number") return event.sort_index;
  return 0;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function renderBadge(text) {
  return el("span", { class: "timelineBadge", text });
}

function renderChip(item) {
  if (typeof item === "string") {
    return el("span", { class: "timelineChip", text: item });
  }

  if (item && typeof item === "object") {
    const name = safeText(item.name) || safeText(item.label) || "";
    const href = safeText(item.href);
    if (href) {
      return el("a", { class: "timelineChip", href, text: name });
    }
    return el("span", { class: "timelineChip", text: name });
  }

  return null;
}

function renderEventCard(event) {
  const metaBits = [];
  if (event.when) metaBits.push(renderBadge(event.when));

  const tierLabel = TIERS.find((t) => t.id === event.spoiler_tier)?.label || event.spoiler_tier || "";
  if (tierLabel) metaBits.push(renderBadge(`Spoiler: ${tierLabel.replace(" only", "")}`));

  if (event.mystery_tag) metaBits.push(renderBadge(event.mystery_tag));

  const header = el("div", { class: "timelineHeader" }, [
    el("h3", { text: safeText(event.title) || "Untitled event" }),
    el("div", { class: "timelineMeta" }, metaBits),
  ]);

  const hook = event.hook ? el("p", { class: "muted", text: safeText(event.hook), style: "margin:0" }) : null;

  const facts = normalizeArray(event.facts)
    .map((f) => safeText(f))
    .filter(Boolean);
  const factList = facts.length
    ? el(
        "ul",
        { class: "timelineFacts" },
        facts.map((fact) => el("li", { text: fact }))
      )
    : null;

  const tagsRow = el("div", { class: "timelineTags" }, []);
  const bucketDefs = [
    { label: "Characters", key: "related_characters" },
    { label: "Locations", key: "related_locations" },
    { label: "Artifacts", key: "related_artifacts" },
  ];

  let addedAnyTag = false;
  for (const bucket of bucketDefs) {
    const items = normalizeArray(event[bucket.key]);
    if (!items.length) continue;

    if (addedAnyTag) tagsRow.appendChild(el("span", { class: "timelineTagLabel", text: "•" }));
    tagsRow.appendChild(el("span", { class: "timelineTagLabel", text: `${bucket.label}:` }));
    for (const item of items) {
      const chip = renderChip(item);
      if (chip) tagsRow.appendChild(chip);
    }
    addedAnyTag = true;
  }

  const children = [header, hook, factList, addedAnyTag ? tagsRow : null].filter(Boolean);
  return el("article", { class: "timelineCard" }, children);
}

function renderLockedCard(event, selectedTierId) {
  const neededTier = event.spoiler_tier || "full";
  const neededLabel = TIERS.find((t) => t.id === neededTier)?.label || neededTier;
  const selectedLabel = TIERS.find((t) => t.id === selectedTierId)?.label || selectedTierId;

  return el("article", { class: "timelineCard timelineLocked" }, [
    el("div", { class: "timelineLockedBox" }, [
      el("p", { class: "timelineLockedTitle", text: "Locked event" }),
      el("p", { class: "muted", style: "margin:8px 0 0" }, [
        "Arc: ",
        el("strong", { text: safeText(event.arc) || "Unknown" }),
      ]),
      el("p", { class: "muted timelineLockedHint" }, [
        `This entry is gated (needs ${neededLabel}). Your filter is set to ${selectedLabel}.`,
      ]),
    ]),
  ]);
}

function groupByArc(events) {
  const groups = new Map();
  for (const event of events) {
    const key = safeText(event.arc) || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return [...groups.entries()];
}

async function loadTimeline() {
  const eraSelect = document.getElementById("timelineEra");
  const spoilerSelect = document.getElementById("timelineSpoiler");
  const searchInput = document.getElementById("timelineSearch");
  const listEl = document.getElementById("timelineList");
  const countEl = document.getElementById("timelineCount");
  const resetBtn = document.getElementById("timelineReset");
  const sortBtn = document.getElementById("timelineSort");
  const lockedToggle = document.getElementById("timelineShowLocked");

  if (!eraSelect || !spoilerSelect || !searchInput || !listEl || !countEl || !resetBtn || !sortBtn || !lockedToggle) {
    return;
  }

  for (const tier of TIERS) {
    spoilerSelect.appendChild(el("option", { value: tier.id, text: tier.label }));
  }
  spoilerSelect.value = "public";

  function hasEmbeddedTimeline() {
    return (
      window.TIMELINE_DATA &&
      typeof window.TIMELINE_DATA === "object" &&
      Array.isArray(window.TIMELINE_DATA.events)
    );
  }

  async function loadTimelineData() {
    // When a user opens timeline.html directly via file://, most browsers block fetch().
    // In that case we fall back to embedded JS data (data/timeline-data.js).
    if (location.protocol === "file:" && hasEmbeddedTimeline()) {
      return window.TIMELINE_DATA;
    }

    try {
      const res = await fetch("./data/timeline.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (hasEmbeddedTimeline()) {
        return window.TIMELINE_DATA;
      }
      throw err;
    }
  }

  let timelineData;
  try {
    timelineData = await loadTimelineData();
  } catch (err) {
    listEl.innerHTML = "";
    listEl.appendChild(
      el("div", { class: "timelineCard" }, [
        el("h3", { text: "Couldn't load timeline" }),
        el("p", {
          class: "muted",
          text:
            "If you opened this page as a local file (file://), browsers block fetch(). Run the site with server.js, or use data/timeline-data.js (included).",
        }),
      ])
    );
    console.error(err);
    return;
  }

  const eventsRaw = Array.isArray(timelineData?.events) ? timelineData.events : [];
  const events = eventsRaw.map((event) => {
    const normalized = { ...event };
    normalized.arc = safeText(normalized.arc) || "Other";
    normalized.spoiler_tier = safeText(normalized.spoiler_tier) || "public";
    normalized._sort = getSortKey(normalized);
    normalized._search = buildSearchBlob(normalized);
    return normalized;
  });

  const arcs = [...new Set(events.map((e) => e.arc).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const arc of arcs) {
    eraSelect.appendChild(el("option", { value: arc, text: arc }));
  }

  const state = {
    era: "all",
    tier: "public",
    search: "",
    sort: "asc", // asc = oldest first
    showLocked: false,
  };

  function applyFilters() {
    const tierGate = tierRank(state.tier);
    const searchLower = state.search.trim().toLowerCase();

    const visible = [];
    const locked = [];

    for (const ev of events) {
      if (state.era !== "all" && ev.arc !== state.era) continue;
      if (searchLower && !ev._search.includes(searchLower)) continue;

      const evRank = tierRank(ev.spoiler_tier);
      if (evRank <= tierGate) visible.push(ev);
      else locked.push(ev);
    }

    const sorter = (a, b) => (a._sort - b._sort) || safeText(a.title).localeCompare(safeText(b.title));
    visible.sort(sorter);
    locked.sort(sorter);
    if (state.sort === "desc") {
      visible.reverse();
      locked.reverse();
    }

    return { visible, locked };
  }

  function render() {
    const { visible, locked } = applyFilters();

    listEl.innerHTML = "";

    const totalMatching = visible.length + locked.length;
    countEl.textContent = `${visible.length} of ${totalMatching} event${totalMatching === 1 ? "" : "s"} shown`;

    if (!totalMatching) {
      listEl.appendChild(
        el("div", { class: "timelineCard" }, [
          el("h3", { text: "No matches" }),
          el("p", { class: "muted", text: "Try clearing filters or searching for a different tag." }),
        ])
      );
      return;
    }

    const toGroup = state.showLocked ? [...visible, ...locked] : visible;
    const grouped = groupByArc(toGroup);

    for (const [arc, arcEvents] of grouped) {
      listEl.appendChild(el("div", { class: "timelineEraHeader" }, [el("h2", { text: arc })]));
      for (const ev of arcEvents) {
        const isLocked = tierRank(ev.spoiler_tier) > tierRank(state.tier);
        listEl.appendChild(isLocked ? renderLockedCard(ev, state.tier) : renderEventCard(ev));
      }
    }
  }

  function reset() {
    state.era = "all";
    state.tier = "public";
    state.search = "";
    state.sort = "asc";
    state.showLocked = false;

    eraSelect.value = "all";
    spoilerSelect.value = "public";
    searchInput.value = "";
    sortBtn.textContent = "Oldest first";
    sortBtn.setAttribute("aria-pressed", "false");
    lockedToggle.checked = false;
    render();
  }

  eraSelect.addEventListener("change", () => {
    state.era = eraSelect.value || "all";
    render();
  });

  spoilerSelect.addEventListener("change", () => {
    state.tier = spoilerSelect.value || "public";
    render();
  });

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    render();
  });

  sortBtn.addEventListener("click", () => {
    state.sort = state.sort === "asc" ? "desc" : "asc";
    const isDesc = state.sort === "desc";
    sortBtn.textContent = isDesc ? "Newest first" : "Oldest first";
    sortBtn.setAttribute("aria-pressed", isDesc ? "true" : "false");
    render();
  });

  lockedToggle.addEventListener("change", () => {
    state.showLocked = !!lockedToggle.checked;
    render();
  });

  resetBtn.addEventListener("click", reset);

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  loadTimeline();
});
