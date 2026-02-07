/* Event detail renderer (per-event page -> pulls from timeline.json) */
(() => {
  const mount = document.getElementById("eventMount");
  const titleEl = document.getElementById("eventTitle");
  const subtitleEl = document.getElementById("eventSubtitle");
  const body = document.body;

  if (!mount || !body) return;

  const EVENT_ID = (body.dataset.eventId || "").trim();

  function safeText(value) {
    return typeof value === "string" ? value : "";
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  }

  function normalizeHref(href, basePrefix = "../") {
    const h = safeText(href);
    if (!h) return "";
    if (h.startsWith("http")) return h;
    if (h.startsWith("../")) return h;
    if (h.startsWith("./")) return basePrefix + h.slice(2);
    if (h.startsWith("/")) return h;
    return basePrefix + h.replace(/^\//, "");
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

  function badge(text) {
    return el("span", { class: "timelineBadge", text });
  }

  function chipLink(text, href) {
    return el("a", { class: "timelineChip", href, text });
  }

  function chipText(text) {
    return el("span", { class: "timelineChip", text });
  }

  function findCharacterHrefByName(charactersJson, name) {
    const list = charactersJson && Array.isArray(charactersJson.characters) ? charactersJson.characters : [];
    const target = safeText(name).toLowerCase();
    if (!target) return "";
    const hit =
      list.find((c) => safeText(c.name).toLowerCase() === target) ||
      list.find((c) => safeText(c.id).toLowerCase() === target) ||
      list.find((c) => (Array.isArray(c.aliases) ? c.aliases.map(safeText).some((a) => a.toLowerCase() === target) : false));
    return hit ? safeText(hit.href) : "";
  }

  async function tryFetchJson(url, fallback) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Bad response");
      return await res.json();
    } catch {
      return fallback;
    }
  }

  async function load() {
    if (!EVENT_ID) {
      mount.innerHTML = "";
      mount.appendChild(
        el("div", { class: "timelineCard" }, [
          el("p", { class: "muted", text: "No event id provided for this page." }),
          el("a", { class: "btn ghost", href: "../search.html", text: "Back to Search" }),
        ])
      );
      return;
    }

    const timelineFallback = window.TIMELINE_DATA && typeof window.TIMELINE_DATA === "object" ? window.TIMELINE_DATA : null;
    const charsFallback = window.CHARACTERS_DATA && typeof window.CHARACTERS_DATA === "object" ? window.CHARACTERS_DATA : null;

    const [timelineJson, charactersJson] = await Promise.all([
      tryFetchJson("../data/timeline.json", timelineFallback),
      tryFetchJson("../data/characters.json", charsFallback),
    ]);

    const events = timelineJson && Array.isArray(timelineJson.events) ? timelineJson.events : [];
    const ev =
      events.find((e) => safeText(e.id) === EVENT_ID) ||
      events.find((e) => safeText(e.id).toLowerCase() === EVENT_ID.toLowerCase());

    if (!ev) {
      mount.innerHTML = "";
      mount.appendChild(
        el("div", { class: "timelineCard" }, [
          el("p", { class: "muted", text: "Could not find that event in data/timeline.json." }),
          el("a", { class: "btn ghost", href: "../search.html", text: "Back to Search" }),
        ])
      );
      if (titleEl) titleEl.textContent = "Event not found";
      return;
    }

    const title = safeText(ev.title) || "Timeline entry";
    if (titleEl) titleEl.textContent = title;

    const subtitleParts = [safeText(ev.arc), safeText(ev.when), safeText(ev.mystery_tag)].filter(Boolean);
    if (subtitleEl) subtitleEl.textContent = subtitleParts.join(" • ");

    document.title = `Dragonstone | ${title}`;

    // Build card content
    mount.innerHTML = "";

    const metaBits = [];
    if (ev.when) metaBits.push(badge(safeText(ev.when)));
    if (ev.spoiler_tier) metaBits.push(badge(`Spoiler: ${safeText(ev.spoiler_tier)}`));
    if (ev.mystery_tag) metaBits.push(badge(safeText(ev.mystery_tag)));
    if (ev.arc) metaBits.push(badge(safeText(ev.arc)));

    const header = el("div", { class: "timelineHeader" }, [
      el("h3", { text: "Entry details" }),
      el("div", { class: "timelineMeta" }, metaBits),
    ]);

    const hook = ev.hook ? el("p", { class: "muted", text: safeText(ev.hook), style: "margin:0" }) : null;

    const facts = normalizeArray(ev.facts)
      .map((f) => safeText(f))
      .filter(Boolean);

    const factList = facts.length
      ? el(
          "ul",
          { class: "timelineFacts" },
          facts.map((fact) => el("li", { text: fact }))
        )
      : el("p", { class: "muted", text: "No facts listed for this entry yet." });

    // Related chips
    const tagsRow = el("div", { class: "timelineTags" }, []);
    let addedAny = false;

    function addBucket(label, items, renderer) {
      const arr = normalizeArray(items);
      if (!arr.length) return;
      if (addedAny) tagsRow.appendChild(el("span", { class: "timelineTagLabel", text: "•" }));
      tagsRow.appendChild(el("span", { class: "timelineTagLabel", text: `${label}:` }));
      for (const item of arr) {
        const node = renderer(item);
        if (node) tagsRow.appendChild(node);
      }
      addedAny = true;
    }

    addBucket("Characters", ev.related_characters, (item) => {
      const name = safeText(item);
      if (!name) return null;
      const href = findCharacterHrefByName(charactersJson, name);
      if (href) return chipLink(name, normalizeHref(href, "../"));
      return chipLink(name, `../search.html?q=${encodeURIComponent(name)}`);
    });

    addBucket("Locations", ev.related_locations, (item) => {
      if (typeof item === "string") {
        const name = safeText(item);
        if (!name) return null;
        return chipLink(name, `../search.html?q=${encodeURIComponent(name)}`);
      }
      if (item && typeof item === "object") {
        const name = safeText(item.name) || safeText(item.label) || "";
        const href = safeText(item.href);
        if (href) return chipLink(name || "Location", normalizeHref(href, "../"));
        if (name) return chipLink(name, `../search.html?q=${encodeURIComponent(name)}`);
        return null;
      }
      return null;
    });

    addBucket("Artifacts", ev.related_artifacts, (item) => {
      if (typeof item === "string") {
        const name = safeText(item);
        if (!name) return null;
        return chipLink(name, `../search.html?q=${encodeURIComponent(name)}`);
      }
      if (item && typeof item === "object") {
        const name = safeText(item.name) || safeText(item.label) || "";
        const href = safeText(item.href);
        if (href) return chipLink(name || "Artifact", normalizeHref(href, "../"));
        if (name) return chipLink(name, `../search.html?q=${encodeURIComponent(name)}`);
        return null;
      }
      return null;
    });

    const actions = el("div", { class: "timelineActions" }, [
      el("a", { class: "btn ghost", href: "../search.html", text: "Back to Search" }),
      el("a", { class: "btn ghost", href: `../search.html?q=${encodeURIComponent(title)}`, text: "Search" }),
    ]);

    const cardChildren = [header, hook, factList, addedAny ? tagsRow : null, actions].filter(Boolean);
    mount.appendChild(el("article", { class: "timelineCard", id: safeText(ev.id) }, cardChildren));
  }

  load();
})();
