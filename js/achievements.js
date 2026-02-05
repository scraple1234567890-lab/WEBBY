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

  // --- Optional: tiny "unlock" sound (Web Audio API, no asset needed) ---
  let __ssaAudioCtx = null;
  let __ssaUserInteracted = false;

  function __ssaGetAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!__ssaAudioCtx) __ssaAudioCtx = new Ctx();
    return __ssaAudioCtx;
  }

  function __ssaUnlockAudioOnce() {
    __ssaUserInteracted = true;
    const ctx = __ssaGetAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  // Try to unlock audio on first user gesture (required on many browsers)
  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, __ssaUnlockAudioOnce, { once: true, passive: true });
  });

  function playBadgeSound() {
    const ctx = __ssaGetAudioCtx();
    if (!ctx) return;

    // If we haven't gotten a user gesture yet, this may be blocked.
    // We'll still attempt it; worst case, it fails silently.
    if (ctx.state === "suspended" && __ssaUserInteracted) {
      ctx.resume().catch(() => {});
    }

    try {
      const now = ctx.currentTime;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      master.connect(ctx.destination);

      // A quick two-tone "sparkle" (pleasant, short, quiet)
      const o1 = ctx.createOscillator();
      o1.type = "sine";
      o1.frequency.setValueAtTime(520, now);
      o1.frequency.exponentialRampToValueAtTime(1040, now + 0.18);

      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(780, now + 0.01);
      o2.frequency.exponentialRampToValueAtTime(1560, now + 0.20);

      const g1 = ctx.createGain();
      g1.gain.setValueAtTime(0.0001, now);
      g1.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.exponentialRampToValueAtTime(0.6, now + 0.03);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      o1.connect(g1); g1.connect(master);
      o2.connect(g2); g2.connect(master);

      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.26);
      o2.stop(now + 0.26);
    } catch {
      // fail quietly
    }
  }


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

    playBadgeSound();

    // Auto-remove
    window.setTimeout(() => {
      toast.classList.add("badgeToast--out");
      window.setTimeout(() => toast.remove(), 220);
    }, 3200);
  }

  function normalizeId(id) {
    return String(id || "").trim();
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
