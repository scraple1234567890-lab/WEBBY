/* Characters page renderer (static JSON -> filters -> roster cards) */

const CHARACTER_TIERS = [
  { id: "public", label: "Public only" },
  { id: "book1", label: "Up to Book 1" },
  { id: "book2", label: "Up to Book 2" },
  { id: "full", label: "Full spoilers" },
];

function characterTierRank(tierId) {
  const idx = CHARACTER_TIERS.findIndex((t) => t.id === tierId);
  return idx === -1 ? CHARACTER_TIERS.length : idx;
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function buildSearchBlob(ch) {
  const chunks = [
    safeText(ch.name),
    safeText(ch.hook),
    safeText(ch.summary),
    safeText(ch.group),
    safeText(ch.school),
    safeText(ch.element),
    safeText(ch.alignment),
    ...normalizeArray(ch.facts).map(safeText),
    ...normalizeArray(ch.tags).map(safeText),
    ...normalizeArray(ch.aliases).map(safeText),
  ];

  const relatedBuckets = [
    normalizeArray(ch.related_events),
    normalizeArray(ch.related_locations),
    normalizeArray(ch.related_artifacts),
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
  return el("span", { class: "characterBadge", text });
}

function renderChip(item) {
  if (typeof item === "string") {
    return el("span", { class: "characterChip", text: item });
  }

  if (item && typeof item === "object") {
    const name = safeText(item.name) || safeText(item.label) || "";
    const href = safeText(item.href);
    if (href) {
      return el("a", { class: "characterChip", href, text: name });
    }
    return el("span", { class: "characterChip", text: name });
  }

  return null;
}

function renderCharacterCard(ch) {
  const metaBits = [];

  if (ch.school) metaBits.push(renderBadge(`School: ${safeText(ch.school)}`));
  if (ch.element) metaBits.push(renderBadge(`Element: ${safeText(ch.element)}`));
  if (ch.alignment) metaBits.push(renderBadge(`Alignment: ${safeText(ch.alignment)}`));

  const tierLabel = CHARACTER_TIERS.find((t) => t.id === ch.spoiler_tier)?.label || ch.spoiler_tier || "";
  if (tierLabel) metaBits.push(renderBadge(`Spoiler: ${tierLabel.replace(" only", "")}`));

  const avatar = el("div", { class: "characterAvatar" }, [
    ch.image
      ? el("img", { src: ch.image, alt: safeText(ch.name) ? `${safeText(ch.name)} portrait` : "Character portrait", loading: "lazy" })
      : el("span", { class: "muted", text: "?" }),
  ]);

  const header = el("div", { class: "characterHeader" }, [
    avatar,
    el("div", { class: "characterTitleRow" }, [
      el("h3", { text: safeText(ch.name) || "Unnamed character" }),
      metaBits.length ? el("div", { class: "characterMeta" }, metaBits) : null,
    ]),
  ]);

  const hook = ch.hook ? el("p", { class: "muted", text: safeText(ch.hook), style: "margin:0" }) : null;

  const facts = normalizeArray(ch.facts)
    .map((f) => safeText(f))
    .filter(Boolean);
  const factList = facts.length
    ? el(
        "ul",
        { class: "characterFacts" },
        facts.map((fact) => el("li", { text: fact }))
      )
    : null;

  const tagsRow = el("div", { class: "characterTags" }, []);
  const bucketDefs = [
    { label: "Events", key: "related_events" },
    { label: "Locations", key: "related_locations" },
    { label: "Artifacts", key: "related_artifacts" },
  ];

  let addedAnyTag = false;
  for (const bucket of bucketDefs) {
    const items = normalizeArray(ch[bucket.key]);
    if (!items.length) continue;

    if (addedAnyTag) tagsRow.appendChild(el("span", { class: "muted", text: "•" }));
    tagsRow.appendChild(el("span", { class: "muted", text: `${bucket.label}:` }));
    for (const item of items) {
      const chip = renderChip(item);
      if (chip) tagsRow.appendChild(chip);
    }
    addedAnyTag = true;
  }

  const actions = el("div", { class: "characterActions" }, []);
  if (ch.href) {
    actions.appendChild(el("a", { class: "btn ghost", href: ch.href, text: "Open dossier" }));
  }
  actions.appendChild(el("a", { class: "btn ghost", href: `./search.html?q=${encodeURIComponent(safeText(ch.name) || "")}`, text: "Search" }));

  const children = [header, hook, factList, addedAnyTag ? tagsRow : null, actions].filter(Boolean);
  return el("article", { class: "characterCard", id: safeText(ch.id) }, children);
}

function renderLockedCard(ch, selectedTierId) {
  const neededTier = ch.spoiler_tier || "full";
  const neededLabel = CHARACTER_TIERS.find((t) => t.id === neededTier)?.label || neededTier;
  const selectedLabel = CHARACTER_TIERS.find((t) => t.id === selectedTierId)?.label || selectedTierId;

  return el("article", { class: "characterCard characterLocked", id: safeText(ch.id) }, [
    el("div", { class: "characterLockedBox" }, [
      el("p", { class: "characterLockedTitle", text: "Locked character" }),
      el("p", { class: "muted", style: "margin:8px 0 0" }, [
        "Group: ",
        el("strong", { text: safeText(ch.group) || "Other" }),
      ]),
      el("p", { class: "muted", style: "margin:8px 0 0" }, [
        `This entry is gated (needs ${neededLabel}). Your filter is set to ${selectedLabel}.`,
      ]),
    ]),
  ]);
}

function groupByGroup(characters) {
  const groups = new Map();
  for (const ch of characters) {
    const key = safeText(ch.group) || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ch);
  }
  return [...groups.entries()];
}

async function loadCharacters() {
  const groupSelect = document.getElementById("charactersGroup");
  const schoolSelect = document.getElementById("charactersSchool");
  const spoilerSelect = document.getElementById("charactersSpoiler");
  const searchInput = document.getElementById("charactersSearch");
  const listEl = document.getElementById("charactersList");
  const countEl = document.getElementById("charactersCount");
  const resetBtn = document.getElementById("charactersReset");
  const sortBtn = document.getElementById("charactersSort");
  const lockedToggle = document.getElementById("charactersShowLocked");

  if (!groupSelect || !schoolSelect || !spoilerSelect || !searchInput || !listEl || !countEl || !resetBtn || !sortBtn || !lockedToggle) {
    return;
  }

  for (const tier of CHARACTER_TIERS) {
    spoilerSelect.appendChild(el("option", { value: tier.id, text: tier.label }));
  }
  spoilerSelect.value = "public";

  function hasEmbeddedCharacters() {
    return (
      window.CHARACTERS_DATA &&
      typeof window.CHARACTERS_DATA === "object" &&
      Array.isArray(window.CHARACTERS_DATA.characters)
    );
  }

  async function loadCharactersData() {
    if (location.protocol === "file:" && hasEmbeddedCharacters()) {
      return window.CHARACTERS_DATA;
    }

    try {
      const res = await fetch("./data/characters.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (hasEmbeddedCharacters()) {
        return window.CHARACTERS_DATA;
      }
      throw err;
    }
  }

  let charactersData;
  try {
    charactersData = await loadCharactersData();
  } catch (err) {
    listEl.innerHTML = "";
    listEl.appendChild(
      el("div", { class: "characterCard" }, [
        el("h3", { text: "Couldn't load characters" }),
        el("p", {
          class: "muted",
          text:
            "If you opened this page as a local file (file://), browsers block fetch(). Run the site with server.js, or use data/characters-data.js (included).",
        }),
      ])
    );
    console.error(err);
    return;
  }

  const charsRaw = Array.isArray(charactersData?.characters) ? charactersData.characters : [];
  const characters = charsRaw.map((ch) => {
    const normalized = { ...ch };
    normalized.group = safeText(normalized.group) || "Other";
    normalized.spoiler_tier = safeText(normalized.spoiler_tier) || "public";
    normalized.name = safeText(normalized.name) || "";
    normalized.school = safeText(normalized.school) || "";
    normalized._search = buildSearchBlob(normalized);
    return normalized;
  });

  const groups = [...new Set(characters.map((c) => c.group).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const g of groups) {
    groupSelect.appendChild(el("option", { value: g, text: g }));
  }

  const schools = [...new Set(characters.map((c) => c.school).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  for (const s of schools) {
    schoolSelect.appendChild(el("option", { value: s, text: s }));
  }

  const state = {
    group: "all",
    school: "all",
    tier: "public",
    search: "",
    sort: "asc", // asc = A-Z
    showLocked: false,
  };

  function scrollToHash() {
    const id = (location.hash || "").replace(/^#/, "").trim();
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("characterFlash");
    window.setTimeout(() => target.classList.remove("characterFlash"), 1400);
  }

  function applyFilters() {
    const tierGate = characterTierRank(state.tier);
    const searchLower = state.search.trim().toLowerCase();

    const visible = [];
    const locked = [];

    for (const ch of characters) {
      if (state.group !== "all" && ch.group !== state.group) continue;
      if (state.school !== "all" && ch.school !== state.school) continue;
      if (searchLower && !ch._search.includes(searchLower)) continue;

      const chRank = characterTierRank(ch.spoiler_tier);
      if (chRank <= tierGate) visible.push(ch);
      else locked.push(ch);
    }

    const sorter = (a, b) => safeText(a.name).localeCompare(safeText(b.name));
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
    countEl.textContent = `${visible.length} of ${totalMatching} character${totalMatching === 1 ? "" : "s"} shown`;

    if (!totalMatching) {
      listEl.appendChild(
        el("div", { class: "characterCard" }, [
          el("h3", { text: "No matches" }),
          el("p", { class: "muted", text: "Try clearing filters or searching for a different keyword." }),
        ])
      );
      return;
    }

    const toGroup = state.showLocked ? [...visible, ...locked] : visible;
    const grouped = groupByGroup(toGroup);

    for (const [groupName, groupChars] of grouped) {
      listEl.appendChild(el("div", { class: "charactersGroupHeader" }, [el("h2", { text: groupName })]));
      for (const ch of groupChars) {
        const isLocked = characterTierRank(ch.spoiler_tier) > characterTierRank(state.tier);
        listEl.appendChild(isLocked ? renderLockedCard(ch, state.tier) : renderCharacterCard(ch));
      }
    }

    scrollToHash();

  }

  function reset() {
    state.group = "all";
    state.school = "all";
    state.tier = "public";
    state.search = "";
    state.sort = "asc";
    state.showLocked = false;

    groupSelect.value = "all";
    schoolSelect.value = "all";
    spoilerSelect.value = "public";
    searchInput.value = "";
    sortBtn.textContent = "A-Z";
    sortBtn.setAttribute("aria-pressed", "false");
    lockedToggle.checked = false;
    render();
  }

  groupSelect.addEventListener("change", () => {
    state.group = groupSelect.value || "all";
    render();
  });

  schoolSelect.addEventListener("change", () => {
    state.school = schoolSelect.value || "all";
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
    sortBtn.textContent = isDesc ? "Z-A" : "A-Z";
    sortBtn.setAttribute("aria-pressed", isDesc ? "true" : "false");
    render();
  });

  lockedToggle.addEventListener("change", () => {
    state.showLocked = !!lockedToggle.checked;
    render();
  });

  resetBtn.addEventListener("click", reset);

  render();

  window.addEventListener("hashchange", () => {
    scrollToHash();
  });

}

document.addEventListener("DOMContentLoaded", () => {
  loadCharacters();
});
