/*
  StarSpell Academy: lightweight client-side achievements/badges
  - No backend required
  - Stores unlocks in localStorage
  - Auto-unlocks based on <body data-unlock-badge="..."></body>
  - Renders a badges grid on badges.html
*/

(function () {
  const STORAGE_KEY = "ssa:badges:v1";
  const TOAST_HOST_ID = "badgeToastHost";

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch {
      return fallback;
    }
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = safeJsonParse(raw || "", { unlocked: {} });
    if (!state || typeof state !== "object") return { unlocked: {} };
    if (!state.unlocked || typeof state.unlocked !== "object") state.unlocked = {};
    return state;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function ensureToastHost() {
    let host = document.getElementById(TOAST_HOST_ID);
    if (host) return host;
    host = document.createElement("div");
    host.id = TOAST_HOST_ID;
    host.className = "badgeToastHost";
    document.body.appendChild(host);
    return host;
  }

  function showToast(def) {
    const host = ensureToastHost();
    const toast = document.createElement("div");
    toast.className = "badgeToast";

    const icon = document.createElement("div");
    icon.className = "badgeToastIcon";
    icon.textContent = def.icon || "✨";

    const body = document.createElement("div");
    body.className = "badgeToastBody";

    const title = document.createElement("div");
    title.className = "badgeToastTitle";
    title.textContent = def.title || "Achievement unlocked";

    const desc = document.createElement("div");
    desc.className = "badgeToastDesc";
    desc.textContent = def.desc || "";

    body.appendChild(title);
    if (def.desc) body.appendChild(desc);

    toast.appendChild(icon);
    toast.appendChild(body);
    host.appendChild(toast);

    // Auto-remove
    window.setTimeout(() => {
      toast.classList.add("badgeToast--out");
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function normalizeId(id) {
    return String(id || "").trim();
  }


  function emitBadgeUnlocked(id, unlockedAt, def) {
    try {
      window.dispatchEvent(
        new CustomEvent("ssa:badgeUnlocked", {
          detail: {
            id: String(id || ""),
            unlockedAt: String(unlockedAt || ""),
            def: def || null,
          },
        }),
      );
    } catch {
      // ignore
    }
  }

  function emitBadgesUpdated() {
    try {
      const ids = getUnlockedIds();
      window.dispatchEvent(new CustomEvent("ssa:badgesUpdated", { detail: { unlockedIds: ids } }));
    } catch {
      // ignore
    }
  }

  function sanitizeUnlockedPayload(value) {
    if (value === true) return { unlockedAt: null };
    if (typeof value === "string") return { unlockedAt: value };
    if (value && typeof value === "object") {
      const ua = typeof value.unlockedAt === "string" ? value.unlockedAt : null;
      return { unlockedAt: ua };
    }
    return { unlockedAt: null };
  }

  function sanitizeUnlockedMap(map) {
    const out = {};
    const obj = map && typeof map === "object" ? map : {};
    Object.keys(obj).forEach((id) => {
      const key = normalizeId(id);
      if (!key) return;
      out[key] = sanitizeUnlockedPayload(obj[id]);
    });
    return out;
  }

  function getUnlockedMap() {
    const state = loadState();
    const unlocked = state.unlocked && typeof state.unlocked === "object" ? state.unlocked : {};
    // shallow clone (payloads are small)
    return Object.assign({}, unlocked);
  }

  function setUnlockedMap(unlockedMap, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const state = loadState();
    state.unlocked = sanitizeUnlockedMap(unlockedMap);
    saveState(state);
    if (!options.silent) {
      // No mass-toasts by default.
    }
    emitBadgesUpdated();
  }

  function mergeUnlockedMap(unlockedMap, opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const incoming = sanitizeUnlockedMap(unlockedMap);
    const state = loadState();
    if (!state.unlocked || typeof state.unlocked !== "object") state.unlocked = {};

    let changed = false;
    Object.keys(incoming).forEach((id) => {
      if (!state.unlocked[id]) {
        state.unlocked[id] = incoming[id];
        changed = true;
      }
    });

    if (changed) {
      saveState(state);
      if (!options.silent) {
        // No mass-toasts by default.
      }
      emitBadgesUpdated();
    }

    return changed;
  }

  function isUnlocked(id) {
    const key = normalizeId(id);
    if (!key) return false;
    const state = loadState();
    return Boolean(state.unlocked[key]);
  }

  function unlock(id, def) {
    const key = normalizeId(id);
    if (!key) return false;

    const state = loadState();
    if (state.unlocked[key]) return false;

    state.unlocked[key] = {
      unlockedAt: new Date().toISOString(),
    };
    saveState(state);

    // Notify listeners (e.g., Supabase sync)
    emitBadgeUnlocked(key, state.unlocked[key].unlockedAt, def);
    emitBadgesUpdated();

    if (def) showToast(def);
    return true;
  }

  function getUnlockedIds() {
    const state = loadState();
    return Object.keys(state.unlocked || {});
  }

  function findDef(defs, id) {
    const key = normalizeId(id);
    return (defs || []).find((d) => normalizeId(d.id) === key);
  }

  function autoUnlockFromBody(defs) {
    const body = document.body;
    if (!body) return;

    const id = body.dataset.unlockBadge;
    if (!id) return;

    const inlineDef = {
      id,
      title: body.dataset.unlockTitle || "Achievement unlocked",
      desc: body.dataset.unlockDesc || "",
      icon: body.dataset.unlockIcon || "✨",
    };

    // Prefer a definition from defs if present
    const def = findDef(defs, id) || inlineDef;
    unlock(id, def);
  }

  function renderBadges(container, defs) {
    if (!(container instanceof HTMLElement)) return;
    const unlocked = new Set(getUnlockedIds());

    const all = (defs || []).slice();

    // Sort unlocked first, then alphabetically
    all.sort((a, b) => {
      const au = unlocked.has(a.id) ? 0 : 1;
      const bu = unlocked.has(b.id) ? 0 : 1;
      if (au !== bu) return au - bu;
      return String(a.title || a.id).localeCompare(String(b.title || b.id));
    });

    container.innerHTML = "";

    all.forEach((def) => {
      const card = document.createElement("div");
      const unlockedNow = unlocked.has(def.id);
      card.className = "badgeCard" + (unlockedNow ? "" : " badgeCard--locked");

      const icon = document.createElement("div");
      icon.className = "badgeIcon";
      icon.textContent = unlockedNow ? (def.icon || "✨") : "🔒";

      const title = document.createElement("div");
      title.className = "badgeTitle";
      title.textContent = def.title || def.id;

      const desc = document.createElement("div");
      desc.className = "badgeDesc";
      desc.textContent = def.desc || "";

      card.appendChild(icon);
      card.appendChild(title);
      if (def.desc) card.appendChild(desc);

      container.appendChild(card);
    });
  }

  function updateBadgesStats(defs) {
    const countEl = document.getElementById("badgesUnlockedCount");
    const totalEl = document.getElementById("badgesTotalCount");
    if (!countEl && !totalEl) return;

    const unlocked = getUnlockedIds().length;
    const total = (defs || []).length;

    if (countEl) countEl.textContent = String(unlocked);
    if (totalEl) totalEl.textContent = String(total);
  }

  // Public API
  window.SSAchievements = {
    isUnlocked,
    unlock,
    getUnlockedIds,
    getUnlockedMap,
    setUnlockedMap,
    mergeUnlockedMap,
    autoUnlockFromBody,
    renderBadges,
    updateBadgesStats,
  };

  // Auto-run after DOM is ready if badge defs are present
  document.addEventListener("DOMContentLoaded", () => {
    const defs = window.SSA_BADGE_DEFS || [];
    autoUnlockFromBody(defs);
  });
})();
