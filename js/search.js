/* Universal search page (Option A: client-side index) */
(() => {
  const TYPES = ["artifact", "event", "character", "location", "animal"];

  const input = document.getElementById("worldSearchInput");
  const filtersEl = document.getElementById("worldSearchFilters");
  const resultsEl = document.getElementById("worldSearchResults");
  const statusEl = document.getElementById("worldSearchStatus");

  if (!input || !filtersEl || !resultsEl || !statusEl) return;

  const params = new URLSearchParams(window.location.search);
  const initialQ = (params.get("q") || "").trim();

  let activeTypes = new Set(TYPES);
  let index = [];
  let loaded = false;
  let typeCounts = null;

  function normalize(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  function tokenize(q) {
    return normalize(q).split(/\s+/).filter(Boolean);
  }

  function scoreItem(item, qTokens) {
    const title = normalize(item.title);
    const summary = normalize(item.summary);
    const details = normalize(item.details);
    const tags = Array.isArray(item.tags) ? item.tags.map(normalize).join(" ") : "";
    const aliases = Array.isArray(item.aliases) ? item.aliases.map(normalize).join(" ") : "";

    let score = 0;
    for (const t of qTokens) {
      if (!t) continue;
      if (title.includes(t)) score += 10;
      if (aliases.includes(t)) score += 9;
      if (summary.includes(t)) score += 6;
      if (tags.includes(t)) score += 6;
      if (details.includes(t)) score += 3;
    }

    // small bonus for exact title match
    if (qTokens.length === 1 && title === qTokens[0]) score += 12;

    return score;
  }

  function makeTag(text) {
    const span = document.createElement("span");
    span.className = "searchTag";
    span.textContent = text;
    return span;
  }

  function computeTypeCounts(items) {
    const counts = Object.create(null);
    for (const t of TYPES) counts[t] = 0;
    for (const it of items) {
      const t = (it && it.type) ? normalize(it.type) : "";
      if (t && Object.prototype.hasOwnProperty.call(counts, t)) counts[t] += 1;
    }
    return counts;
  }

  function renderFilters() {
    filtersEl.innerHTML = "";

    // "None" chip (explicitly selects no types)
    const noneBtn = document.createElement("button");
    noneBtn.type = "button";
    noneBtn.className = "searchChip";
    noneBtn.dataset.filter = "none";
    const noneActive = activeTypes.size === 0;
    noneBtn.setAttribute("aria-pressed", noneActive ? "true" : "false");
    noneBtn.textContent = "none";
    noneBtn.addEventListener("click", () => {
      activeTypes = new Set();
      renderFilters();
      runSearch(input.value);
    });
    filtersEl.appendChild(noneBtn);

    // "All" chip
    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "searchChip";
    allBtn.dataset.filter = "all";
    const allActive = activeTypes.size === TYPES.length;
    allBtn.setAttribute("aria-pressed", allActive ? "true" : "false");
    allBtn.textContent = "all";
    allBtn.addEventListener("click", () => {
      activeTypes = new Set(TYPES);
      renderFilters();
      runSearch(input.value);
    });
    filtersEl.appendChild(allBtn);

    for (const t of TYPES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "searchChip";
      btn.dataset.filter = t;
      const ct = typeCounts && typeof typeCounts[t] === "number" ? typeCounts[t] : null;
      btn.textContent = ct === null ? t : `${t} (${ct})`;
      btn.setAttribute("aria-pressed", activeTypes.has(t) ? "true" : "false");
      btn.addEventListener("click", () => {
        if (activeTypes.has(t)) activeTypes.delete(t);
        else activeTypes.add(t);

        // Allow an empty set now ("none" state)
        renderFilters();
        runSearch(input.value);
      });
      filtersEl.appendChild(btn);
    }
  }

  function renderEmptyState(msg) {
    resultsEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "muted";
    p.style.margin = "0";
    p.textContent = msg;
    resultsEl.appendChild(p);
  }

  function typeOrder(type) {
    const idx = TYPES.indexOf(type);
    return idx === -1 ? 999 : idx;
  }

  function compareTitle(a, b) {
    const at = (a && a.title ? a.title : "").toString();
    const bt = (b && b.title ? b.title : "").toString();
    return at.localeCompare(bt, undefined, { sensitivity: "base" });
  }

  function createResultEl(item) {
    const details = document.createElement("details");
    details.className = "searchResult";

    const summary = document.createElement("summary");

    const left = document.createElement("div");
    left.className = "searchResultHeaderLeft";

    if (item.image) {
      const img = document.createElement("img");
      img.className = "searchThumb";
      img.loading = "lazy";
      img.alt = item.title ? `${item.title} portrait` : "Result image";
      img.src = item.image;
      left.appendChild(img);
    }

    const title = document.createElement("div");
    title.className = "searchResultTitle";
    title.textContent = item.title || "Untitled";
    left.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "searchResultMeta";
    meta.textContent = (item.type || "").toString();

    summary.appendChild(left);
    summary.appendChild(meta);
    details.appendChild(summary);

    if (item.summary) {
      const p = document.createElement("p");
      p.className = "searchResultSummary";
      p.textContent = item.summary;
      details.appendChild(p);
    }

    if (item.details) {
      const p = document.createElement("p");
      p.className = "searchResultDetails";
      p.textContent = item.details;
      details.appendChild(p);
    }

    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean).slice(0, 12) : [];
    if (tags.length) {
      const tagRow = document.createElement("div");
      tagRow.className = "searchTagRow";
      for (const t of tags) tagRow.appendChild(makeTag(t));
      details.appendChild(tagRow);
    }

    const actions = document.createElement("div");
    actions.className = "searchActions";
    const a = document.createElement("a");
    a.className = "btn ghost";
    a.href = item.url || "#";
    a.textContent = "Open";
    actions.appendChild(a);
    details.appendChild(actions);

    return details;
  }

  function renderResults(items, q) {
    resultsEl.innerHTML = "";

    // No query? Show everything (respecting active type filters).
    if (!q.trim()) {
      if (!loaded) {
        statusEl.textContent = "Loading search index…";
        renderEmptyState("Loading entries…");
        return;
      }

      if (items.length === 0) {
        if (activeTypes.size === 0) {
          renderEmptyState("No types selected. Choose one above to browse.");
          statusEl.textContent = "No types selected";
        } else {
          renderEmptyState("No entries to show for the selected filters.");
          statusEl.textContent = "0 entries";
        }
        return;
      }

      statusEl.textContent = `Showing ${items.length} entr${items.length === 1 ? "y" : "ies"}. Type to narrow.`;

      // Group by type for browsing
      for (const t of TYPES) {
        const group = items.filter((it) => it.type === t);
        if (!group.length) continue;

        const h = document.createElement("h3");
        h.className = "searchGroupTitle";
        h.textContent = t;
        resultsEl.appendChild(h);

        const wrap = document.createElement("div");
        wrap.className = "searchGroup";
        for (const item of group) wrap.appendChild(createResultEl(item));
        resultsEl.appendChild(wrap);
      }
      return;
    }

    if (items.length === 0) {
      if (activeTypes.size === 0) {
        renderEmptyState("No types selected. Choose a filter above.");
        statusEl.textContent = "No types selected";
      } else {
        renderEmptyState("No matches. Try fewer words or a different keyword.");
        statusEl.textContent = loaded ? "0 results" : "Loading search index…";
      }
      return;
    }

    statusEl.textContent = `${items.length} result${items.length === 1 ? "" : "s"} for “${q.trim()}”`;

    for (const item of items) resultsEl.appendChild(createResultEl(item));
  }

  function runSearch(q) {
    const qTokens = tokenize(q);
    const pool = index.filter((it) => activeTypes.has(it.type));

    // Browse mode: no query, show everything in a nice order.
    if (qTokens.length === 0) {
      const ordered = pool
        .slice()
        .sort((a, b) => {
          const d = typeOrder(a.type) - typeOrder(b.type);
          if (d !== 0) return d;
          return compareTitle(a, b);
        });
      renderResults(ordered, q);
      return;
    }

    const scored = pool
      .map((it) => ({ it, s: scoreItem(it, qTokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => {
        const d = b.s - a.s;
        if (d !== 0) return d;
        const t = typeOrder(a.it.type) - typeOrder(b.it.type);
        if (t !== 0) return t;
        return compareTitle(a.it, b.it);
      })
      .slice(0, 60)
      .map((x) => x.it);

    renderResults(scored, q);
  }

  function normalizeUrl(url) {
    if (!url) return "#";
    // Keep relative URLs working from /search.html
    if (url.startsWith("./") || url.startsWith("../") || url.startsWith("/") || url.startsWith("http")) return url;
    return "./" + url.replace(/^\//, "");
  }

  function buildIndex(extraItems, mapJson, timelineJson, charactersJson) {
    const out = [];

    // Extra items are author-defined (artifacts/characters/animals now, anything later)
    if (Array.isArray(extraItems)) {
      for (const item of extraItems) {
        if (!item || !item.title || !item.type) continue;
        const type = normalize(item.type);
        if (!TYPES.includes(type)) continue;
        out.push({
          type,
          id: item.id || "",
          title: item.title,
          summary: item.summary || "",
          details: item.details || "",
          image: item.image ? normalizeUrl(item.image) : "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          aliases: Array.isArray(item.aliases) ? item.aliases : [],
          url: normalizeUrl(item.url || ""),
        });
      }
    }


// Characters from characters JSON
if (charactersJson && Array.isArray(charactersJson.characters)) {
  for (const ch of charactersJson.characters) {
    if (!ch || !ch.name) continue;
    const facts = Array.isArray(ch.facts) ? ch.facts.filter(Boolean) : [];
    const detailText = facts.length ? facts.join(" • ") : "";

    const tags = Array.isArray(ch.tags) ? ch.tags : [];
    const aliases = Array.isArray(ch.aliases) ? ch.aliases : [];

    out.push({
      type: "character",
      id: ch.id || "",
      title: ch.name,
      summary: ch.summary || ch.hook || "",
      details: detailText,
      image: ch.image ? normalizeUrl(ch.image) : "",
      tags,
      aliases,
      url: normalizeUrl(ch.href || `characters.html#${ch.id || ""}`),
    });
  }
}

    // Locations from map JSON
    if (mapJson && Array.isArray(mapJson.locations)) {
      for (const loc of mapJson.locations) {
        if (!loc || !loc.title) continue;
        out.push({
          type: "location",
          id: loc.id || "",
          title: loc.title,
          summary: loc.blurb || "",
          details: loc.blurb || "",
          tags: ["location"],
          aliases: [],
          url: normalizeUrl(loc.href || `map.html#${loc.id || ""}`),
        });
      }
    }

    // Events from timeline JSON
    if (timelineJson && Array.isArray(timelineJson.events)) {
      for (const ev of timelineJson.events) {
        if (!ev || !ev.title) continue;
        const facts = Array.isArray(ev.facts) ? ev.facts.filter(Boolean) : [];
        const detailText = facts.length ? facts.join(" • ") : "";
        const tags = [];
        if (ev.arc) tags.push(ev.arc);
        if (ev.mystery_tag) tags.push(ev.mystery_tag);
        if (ev.spoiler_tier) tags.push(`spoiler:${ev.spoiler_tier}`);

        out.push({
          type: "event",
          id: ev.id || "",
          title: ev.title,
          summary: ev.hook || "",
          details: detailText,
          tags,
          aliases: [],
          url: normalizeUrl(`timeline.html#${ev.id || ""}`),
        });
      }
    }

    return out;
  }

  async function loadAll() {
    statusEl.textContent = "Loading search index…";
    renderFilters();

    // Many browsers block fetch() for file:// pages. We *try* anyway and fall back to embedded JS data.
    const isFile = location.protocol === "file:";

    async function tryFetchJson(url, fallback) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        return fallback;
      }
    }

    const extraFallback =
      window.SEARCH_INDEX_DATA && Array.isArray(window.SEARCH_INDEX_DATA) ? window.SEARCH_INDEX_DATA : [];
    const mapFallback =
      window.MAP_LOCATIONS_DATA && typeof window.MAP_LOCATIONS_DATA === "object" ? window.MAP_LOCATIONS_DATA : null;
    const timelineFallback =
      window.TIMELINE_DATA && typeof window.TIMELINE_DATA === "object" ? window.TIMELINE_DATA : null;

    const charsFallback =
      window.CHARACTERS_DATA && typeof window.CHARACTERS_DATA === "object" ? window.CHARACTERS_DATA : null;

    const [extra, mapJson, timelineJson, charactersJson] = await Promise.all([
      tryFetchJson("./data/searchIndex.json", extraFallback),
      tryFetchJson("./data/map-locations.json", mapFallback),
      tryFetchJson("./data/timeline.json", timelineFallback),
      tryFetchJson("./data/characters.json", charsFallback)
    ]);

    index = buildIndex(extra, mapJson, timelineJson, charactersJson);
    typeCounts = computeTypeCounts(index);
    loaded = true;

    // Re-render filters so counts appear
    renderFilters();

    runSearch(input.value);
  }


  // Debounce typing
  let debounce = null;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => runSearch(input.value), 180);
  });

  // Prefill from ?q=
  if (initialQ) input.value = initialQ;

  // Auto-focus
  setTimeout(() => input.focus(), 0);

  loadAll().catch((err) => {
    console.error(err);
    statusEl.textContent = "Could not load the search index.";
    renderEmptyState("Search is temporarily unavailable.");
  });
})();
