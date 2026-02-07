/*
  Dragonstone: lightweight client-side achievements/badges
  - No backend required
  - Stores unlocks in localStorage
  - Auto-unlocks based on <body data-unlock-badge="..."></body>
  - Renders a badges grid on badges.html
*/

(function () {
  const STORAGE_KEY = "ssa:badges:v1";
  const TOAST_HOST_ID = "badgeToastHost";

  // --- Optional: "unlock" sound ---
  // Uses an audio file if present; falls back to a tiny procedural spell sound.
  const BADGE_SFX_SRC = "assets/audio/badge-unlock.mp3";

  let __ssaBadgeAudio = null;
  let __ssaAudioCtx = null;
  let __ssaUserInteracted = false;

  function __ssaGetBadgeAudio() {
    if (__ssaBadgeAudio) return __ssaBadgeAudio;
    try {
      const a = new Audio(BADGE_SFX_SRC);
      a.preload = "auto";
      a.volume = 0.75;
      __ssaBadgeAudio = a;
      return a;
    } catch {
      return null;
    }
  }

  function __ssaGetAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!__ssaAudioCtx) __ssaAudioCtx = new Ctx();
    return __ssaAudioCtx;
  }

  function __ssaUnlockAudioOnce() {
    __ssaUserInteracted = true;

    // Prime HTMLAudio (some browsers require a gesture)
    const a = __ssaGetBadgeAudio();
    if (a) {
      try {
        const prevMuted = a.muted;
        a.muted = true;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = prevMuted;
          }).catch(() => {
            a.muted = prevMuted;
          });
        } else {
          a.pause();
          a.currentTime = 0;
          a.muted = prevMuted;
        }
      } catch {
        // ignore
      }
    }

    // Prime WebAudio fallback
    const ctx = __ssaGetAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  }

  // Try to unlock audio on first user gesture (required on many browsers)
  ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, __ssaUnlockAudioOnce, { once: true, passive: true });
  });

  function playBadgeSound() {
    const a = __ssaGetBadgeAudio();
    if (a) {
      try {
        // restart from the beginning each time
        a.currentTime = 0;
      } catch {
        // ignore
      }
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => playProceduralBadgeSound());
      }
      return;
    }
    playProceduralBadgeSound();
  }

  function playProceduralBadgeSound() {
    const ctx = __ssaGetAudioCtx();
    if (!ctx) return;

    // If we haven't gotten a user gesture yet, this may be blocked.
    // We'll still attempt it; worst case, it fails silently.
    if (ctx.state === "suspended" && __ssaUserInteracted) {
      ctx.resume().catch(() => {});
    }

    try {
      const now = ctx.currentTime;

      // --- master + a tiny "glimmer" delay (pseudo-reverb) ---
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(0.22, now);
      const dry = ctx.createGain();
      dry.gain.setValueAtTime(1.0, now);

      const delay = ctx.createDelay();
      delay.delayTime.setValueAtTime(0.085, now);
      const fb = ctx.createGain();
      fb.gain.setValueAtTime(0.28, now);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(1800, now);

      master.connect(dry);
      master.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(wet);

      const out = ctx.destination;
      dry.connect(out);
      wet.connect(out);

      // --- airy "spell whoosh" (filtered noise sweep) ---
      const noiseLen = Math.floor(ctx.sampleRate * 0.22);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        // slightly softened white noise
        data[i] = (Math.random() * 2 - 1) * 0.65;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.setValueAtTime(0.9, now);
      bp.frequency.setValueAtTime(520, now);
      bp.frequency.exponentialRampToValueAtTime(2100, now + 0.18);

      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(0.65, now + 0.025);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

      noise.connect(bp);
      bp.connect(ng);
      ng.connect(master);

      // --- chimey micro-arpeggio ("short spell") ---
      // F#-A#-C# with a quick top sparkle
      const notes = [740.0, 932.3, 1108.7, 1480.0];
      const offsets = [0.00, 0.045, 0.09, 0.135];

      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(6.5, now); // gentle vibrato
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(10, now); // cents-ish, routed to detune
      lfo.connect(lfoGain);

      const madeOsc = [];
      notes.forEach((f, idx) => {
        const t0 = now + offsets[idx];
        const o = ctx.createOscillator();
        o.type = idx === 0 ? "triangle" : "sine";
        o.frequency.setValueAtTime(f, t0);
        o.detune.setValueAtTime((Math.random() * 12 - 6), t0);

        // connect vibrato to detune
        lfoGain.connect(o.detune);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.75, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.20);

        // slight "lift" on the first tone so it feels cast-y
        if (idx === 0) {
          o.frequency.exponentialRampToValueAtTime(f * 1.18, t0 + 0.11);
        }

        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + 0.22);
        madeOsc.push(o, g);

        // a tiny octave sparkle on the last note
        if (idx === 3) {
          const o2 = ctx.createOscillator();
          o2.type = "sine";
          o2.frequency.setValueAtTime(f * 2, t0);
          o2.detune.setValueAtTime((Math.random() * 14 - 7), t0);
          lfoGain.connect(o2.detune);

          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.0001, t0);
          g2.gain.exponentialRampToValueAtTime(0.35, t0 + 0.008);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);

          o2.connect(g2);
          g2.connect(master);
          o2.start(t0);
          o2.stop(t0 + 0.16);
          madeOsc.push(o2, g2);
        }
      });

      // Start/stop shared nodes
      lfo.start(now);
      lfo.stop(now + 0.50);

      noise.start(now);
      noise.stop(now + 0.25);
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
    }, 5000);
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
