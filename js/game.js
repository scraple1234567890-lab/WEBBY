/**
 * Tiny Turn RPG
 * Turn-based, single-player battle loop (in-browser).
 *
 * Strategy overhaul:
 * - Two-wave battle (Wave 2 spawns after Wave 1).
 * - Expanded type system: Wind / Fire / Sight / Earth / Touch (with STAB).
 * - Removed RNG (no crits, no misses, no random status procs).
 * - Added Focus (resource) + Enemy Intent telegraphing for planning.
 */

const root = document.getElementById("rpgRoot");

if (root) {
  const els = {
    playerName: document.getElementById("playerName"),
    enemyName: document.getElementById("enemyName"),
    playerTypeText: document.getElementById("playerTypeText"),
    enemyTypeText: document.getElementById("enemyTypeText"),

    playerCard: document.getElementById("playerCard"),
    enemyCard: document.getElementById("enemyCard"),

    playerHpText: document.getElementById("playerHpText"),
    enemyHpText: document.getElementById("enemyHpText"),
    playerHpFill: document.getElementById("playerHpFill"),
    enemyHpFill: document.getElementById("enemyHpFill"),
    playerStatus: document.getElementById("playerStatus"),
    enemyStatus: document.getElementById("enemyStatus"),
    playerFocusText: document.getElementById("playerFocusText"),
    playerFocusFill: document.getElementById("playerFocusFill"),
    enemyIntentText: document.getElementById("enemyIntentText"),

    log: document.getElementById("battleLog"),
    attackBtn: document.getElementById("attackBtn"),
    healBtn: document.getElementById("healBtn"),
    guardBtn: document.getElementById("guardBtn"),
    restartBtn: document.getElementById("restartBtn"),
    magicToggle: document.getElementById("magicToggle"),
    magicMenu: document.getElementById("magicMenu"),
    windBtn: document.getElementById("windBtn"),
    fireBtn: document.getElementById("fireBtn"),
    effectPreview: document.getElementById("effectPreview"),
    hintLine: document.getElementById("rpgHint"),
    howtoDetails: document.getElementById("howtoDetails"),

    explainBtn: document.getElementById("explainBtn"),
    explainModal: document.getElementById("explainModal"),
    explainClose: document.getElementById("explainClose"),
    explainOk: document.getElementById("explainOk"),

    playerSprite: document.getElementById("playerSprite"),
    enemySprite: document.getElementById("enemySprite"),
    playerSpriteImg: document.getElementById("playerSpriteImg"),
    enemySpriteImg: document.getElementById("enemySpriteImg"),

    playerTypePills: document.getElementById("playerTypePills"),
    enemyTypePills: document.getElementById("enemyTypePills"),
    atkVsEnemyList: document.getElementById("atkVsEnemyList"),
    enemyVsYouList: document.getElementById("enemyVsYouList"),
    effectBanner: document.getElementById("effectBanner"),
    buildTag: document.getElementById("buildTag"),
  };

  /** Effect preview state (updates on hover/focus/click). */
  let previewMove = /** @type {{name:string, type: MagicType, baseCost:number}} */ ({
    name: "Attack",
    type: "Sight",
    baseCost: 0,
  });


  /**
   * Play a one-shot CSS animation class by toggling it.
   * @param {HTMLElement|null} el
   * @param {string} cls
   */
  function playAnim(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    // Force reflow so the animation restarts reliably.
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth;
    el.classList.add(cls);
    el.addEventListener(
      "animationend",
      () => {
        el.classList.remove(cls);
      },
      { once: true }
    );
    window.setTimeout(() => el.classList.remove(cls), 650);
  }

// --------------------
// SFX: Wave clear (uses the same sound as badge unlock)
// --------------------
const WAVE_CLEAR_SFX_SRC = "assets/audio/badge-unlock.mp3";
let __waveClearAudio = null;
let __waveClearPrimed = false;

function __getWaveClearAudio() {
  if (__waveClearAudio) return __waveClearAudio;
  try {
    const a = new Audio(WAVE_CLEAR_SFX_SRC);
    a.preload = "auto";
    a.volume = 0.75;
    __waveClearAudio = a;
    return a;
  } catch {
    return null;
  }
}

function __primeWaveClearAudioOnce() {
  if (__waveClearPrimed) return;
  __waveClearPrimed = true;

  const a = __getWaveClearAudio();
  if (!a) return;

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

// Prime audio on the first user gesture (needed on many browsers)
["pointerdown", "keydown", "touchstart"].forEach((evt) => {
  window.addEventListener(evt, __primeWaveClearAudioOnce, { once: true, passive: true });
});

function playWaveClearSfx() {
  const a = __getWaveClearAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
  } catch {
    // ignore
  }
  const p = a.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => {});
  }
}

  // --------------------
  // Magic menu helpers
  // --------------------

  function setMagicMenuOpen(open) {
    if (els.magicMenu instanceof HTMLElement) {
      els.magicMenu.hidden = !open;
    }
    if (els.magicToggle instanceof HTMLButtonElement) {
      els.magicToggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function toggleMagicMenu() {
    if (!(els.magicMenu instanceof HTMLElement)) return;
    setMagicMenuOpen(els.magicMenu.hidden);
  }

  function closeMagicMenu() {
    setMagicMenuOpen(false);
  }

  // Close the magic menu when clicking outside or pressing Escape.
  document.addEventListener("click", (e) => {
    if (!(els.magicMenu instanceof HTMLElement)) return;
    if (!(els.magicToggle instanceof HTMLElement)) return;

    const t = e.target;
    if (t instanceof Node) {
      const inMenu = els.magicMenu.contains(t);
      const inToggle = els.magicToggle.contains(t);
      if (!inMenu && !inToggle) closeMagicMenu();
    }
  });


const TYPE_META = /** @type {Record<MagicType, {icon: string, label: string}>} */ ({
  Wind:  { icon: "🍃", label: "Wind" },
  Fire:  { icon: "🔥", label: "Fire" },
  Earth: { icon: "🪨", label: "Earth" },
  Sight: { icon: "👁", label: "Sight" },
  Touch: { icon: "✋", label: "Touch" },
});

/** @param {MagicType} t */
function typeIcon(t) {
  return TYPE_META[t]?.icon ?? "✦";
}

/** @param {MagicType[]} types */
function formatTypesDisplay(types) {
  return types.join(" • ");
}

/** @param {MagicType[]} types */
function formatTypeLineHTML(types) {
  const pieces = types
    .map((t) => `<span class="typeInline typeInline--${t}">${typeIcon(t)} ${TYPE_META[t]?.label ?? t}</span>`)
    .join('<span class="rpgDot">•</span>');
  return `<span class="typeLabel">Type:</span> ${pieces}`;
}

/** @param {HTMLElement|null} el @param {MagicType[]} types */
function setTypeLine(el, types) {
  if (!(el instanceof HTMLElement)) return;
  el.innerHTML = formatTypeLineHTML(types);
}

/** @param {HTMLElement|null} el @param {MagicType[]} types */
function setTypeAccent(el, types) {
  if (!(el instanceof HTMLElement)) return;
  const primary = types[0] || "";
  el.dataset.primaryType = primary;
  el.dataset.types = formatTypesDisplay(types);
}

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isExplainOpen()) closeExplain();
      closeMagicMenu();
    }
  });

  // --------------------
  // Explain modal helpers
  // --------------------

  let explainLastFocus = null;

  function isExplainOpen() {
    return (els.explainModal instanceof HTMLElement) && !els.explainModal.hasAttribute("hidden");
  }

  function openExplain() {
    if (!(els.explainModal instanceof HTMLElement)) return;
    closeMagicMenu();
    els.explainModal.removeAttribute("hidden");
    document.body.classList.add("modalOpen");
    explainLastFocus = document.activeElement;
    // focus close button for keyboard users
    if (els.explainClose instanceof HTMLButtonElement) els.explainClose.focus();
  }

  function closeExplain() {
    if (!(els.explainModal instanceof HTMLElement)) return;
    els.explainModal.setAttribute("hidden", "");
    document.body.classList.remove("modalOpen");
    const prev = explainLastFocus;
    explainLastFocus = null;
    if (prev && prev instanceof HTMLElement) prev.focus();
  }

  // Open/close wiring
  if (els.explainBtn instanceof HTMLButtonElement) {
    els.explainBtn.addEventListener("click", () => openExplain());
  }
  if (els.explainClose instanceof HTMLButtonElement) {
    els.explainClose.addEventListener("click", () => closeExplain());
  }
  if (els.explainOk instanceof HTMLButtonElement) {
    els.explainOk.addEventListener("click", () => closeExplain());
  }

  // Click outside modal content closes it
  if (els.explainModal instanceof HTMLElement) {
    els.explainModal.addEventListener("click", (e) => {
      if (e.target === els.explainModal) closeExplain();
    });
  }

  /** @param {number} value @param {number} min @param {number} max */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** @param {number} n */
  function fmtMult(n) {
    const s = (Math.round(n * 100) / 100).toString();
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  }

  // --------------------
  // Type system
  // --------------------

  /** @typedef {"Wind"|"Fire"|"Sight"|"Earth"|"Touch"} MagicType */

  /**
   * Type effectiveness chart: attackType -> defenderType -> multiplier.
   * Dual types multiply.
   * NOTE: Balance is intentionally "obvious" so matchups are readable.
   */
  const TYPE_CHART = /** @type {Record<MagicType, Record<MagicType, number>>} */ ({
    Wind:  { Wind: 1.0, Fire: 1.6, Sight: 0.9, Earth: 0.8, Touch: 1.0 },
    Fire:  { Fire: 0.7, Wind: 0.8, Sight: 0.9, Earth: 1.6, Touch: 1.0 },
    Sight: { Sight: 1.0, Wind: 1.2, Fire: 1.2, Earth: 0.9, Touch: 0.8 },
    Earth: { Earth: 0.7, Wind: 1.6, Fire: 0.8, Sight: 1.0, Touch: 1.1 },
    Touch: { Touch: 1.0, Wind: 0.9, Fire: 1.0, Earth: 0.9, Sight: 1.4 },
  });

  /** @param {MagicType} attackType @param {MagicType[]} defenderTypes */
  function typeMultiplier(attackType, defenderTypes) {
    let mult = 1;
    for (const dt of defenderTypes) mult *= TYPE_CHART[attackType]?.[dt] ?? 1;
    return mult;
  }

  /** @param {number} mult */
  function effectivenessText(mult) {
    if (mult >= 1.30) return "Super effective!";
    if (mult <= 0.85) return "Not very effective…";
    return "";
  }


  /** @param {number} mult */
  function effectivenessTierLabel(mult) {
    if (mult >= 1.30) return { label: "Extra effective", tone: "good" };
    if (mult <= 0.85) return { label: "Weak", tone: "bad" };
    return { label: "Normal", tone: "neutral" };
  }

  /**
   * Render the "before you click" effectiveness preview line.
   * @param {{name:string, type: MagicType, baseCost:number}} move
   */
  function renderEffectPreview(move) {
    if (!(els.effectPreview instanceof HTMLElement)) return;

    const eff = typeMultiplier(move.type, state.enemy.types);
    const tier = effectivenessTierLabel(eff);

    els.effectPreview.classList.remove("isGood", "isBad", "isNeutral");
    if (tier.tone === "good") els.effectPreview.classList.add("isGood");
    else if (tier.tone === "bad") els.effectPreview.classList.add("isBad");
    else els.effectPreview.classList.add("isNeutral");

    // Focus cost note (only for magic)
    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = move.baseCost > 0 ? move.baseCost + extra : 0;
    const needs = cost > 0 && state.player.focus < cost;

    const needText = needs ? `Need ${cost} Focus` : (cost > 0 ? `${cost} Focus` : "+1 Focus");
    const meta = move.baseCost > 0 ? needText : "+1 Focus";

    // Keep it short and readable
    els.effectPreview.innerHTML =
      `${move.name}: <span class="rpgEffectPreviewText">${tier.label}</span> ` +
      `<span class="rpgEffectPreviewMeta">(x${fmtMult(eff)} • ${meta})</span>`;
  }

  /** @param {string} name @param {MagicType} type @param {number} baseCost */
  
  /**
   * Render a short, always-visible hint so the game explains itself while you play.
   * The goal is not to "play for you", but to make the mechanics readable.
   */
  function renderHint() {
    if (!(els.hintLine instanceof HTMLElement)) return;

    if (state.over) {
      els.hintLine.textContent = "Tip: Restart to play again. Use Explain for the full rules.";
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const healCost = 1 + extra;
    const hpRatio = state.player.hp / Math.max(1, state.player.max);

    const intent = state.enemy.intent;
    let intentHint = "";
    if (intent) {
      if (intent.id === "shatter") intentHint = "Enemy intent: Shatter (punishes Guard).";
      else if (intent.id === "quake") intentHint = "Enemy intent: Quake (hits hard even through Guard).";
      else if (intent.id === "stonebind") intentHint = "Enemy intent: Stonebind (causes Bind).";
      else if (intent.id === "ignite") intentHint = "Enemy intent: Ignite (causes Burn).";
      else if (intent.id === "ward" || intent.id === "fortify") intentHint = `Enemy intent: ${intent.name} (defense up).`;
      else if (intent.id === "heal") intentHint = "Enemy intent: Heal (they'll recover HP).";
      else intentHint = `Enemy intent: ${intent.name}.`;
    }

    // If low HP, prioritize the healing explanation.
    if (hpRatio <= 0.35 && state.player.healCharges > 0) {
      if (state.player.focus >= healCost) {
        els.hintLine.textContent = [intentHint, `Low HP: Heal now (${healCost} Focus).`].filter(Boolean).join(" ");
        return;
      }
      els.hintLine.textContent = [intentHint, `Low HP: Build Focus with Attack/Guard to Heal (need ${healCost}).`].filter(Boolean).join(" ");
      return;
    }

    // Otherwise, recommend the best affordable hit (based on type effectiveness).
    const atkPrev = computeTypedDamage("player", "enemy", 5, "Sight");
    const windPrev = computeTypedDamage("player", "enemy", 4, "Wind");
    const firePrev = computeTypedDamage("player", "enemy", 6, "Fire");

    const options = [
      { label: "Attack", type: "Sight", cost: 0, overall: atkPrev.overall },
      { label: "Wind attack", type: "Wind", cost: 2 + extra, overall: windPrev.overall },
      { label: "Fire attack", type: "Fire", cost: 3 + extra, overall: firePrev.overall },
    ];

    const affordable = options.filter((o) => state.player.focus >= o.cost);
    const best = (affordable.length ? affordable : options).slice().sort((a, b) => b.overall - a.overall)[0];

    const eff = typeMultiplier(best.type, state.enemy.types);
    const tier = effectivenessTierLabel(eff);

    let actionHint = "";
    if (best.cost > state.player.focus) {
      actionHint = `${best.label} is ${tier.label.toLowerCase()} (x${fmtMult(best.overall)}), but you need ${best.cost} Focus. Use Attack/Guard to build Focus.`;
    } else if (best.label === "Attack") {
      actionHint = "Build Focus with Attack/Guard, then spend it on Magic or Heal.";
    } else {
      actionHint = `Best hit: ${best.label} is ${tier.label.toLowerCase()} (x${fmtMult(best.overall)}).`;
    }

    const bindNote = state.player.bound > 0 ? "You are Bound: magic costs +1 Focus. Guard breaks Bind." : "";

    els.hintLine.textContent = [intentHint, actionHint, bindNote].filter(Boolean).join(" ");
  }

function setPreviewMove(name, type, baseCost) {
    previewMove = { name, type, baseCost };
    renderEffectPreview(previewMove);
  }

  /** @param {MagicType[]} types */
  function formatTypes(types) {
    return `Type: ${formatTypesDisplay(types)}`;
  }

  /** @param {HTMLElement|null} el @param {MagicType[]} types */
  function renderTypePills(el, types) {
    if (!(el instanceof HTMLElement)) return;
    el.innerHTML = "";
    for (const t of types) {
      const span = document.createElement("span");
      span.className = `typePill typePill--${t}`;
      span.textContent = `${typeIcon(t)} ${t}`;
      el.appendChild(span);
    }
  }

  
  /** @param {number} mult */
  function matchupLabel(mult) {
    if (mult >= 1.30) return { text: "Strong", cls: "isStrong" };
    if (mult <= 0.90) return { text: "Weak", cls: "isWeak" };
    return { text: "Even", cls: "isNeutral" };
  }

  /**
   * Render a single matchup row.
   * @param {HTMLElement|null} listEl
   * @param {{type: MagicType, label: string, mult: number}} item
   */
  function appendMatchupRow(listEl, item) {
    if (!(listEl instanceof HTMLElement)) return;
    const li = document.createElement("li");
    const tone = matchupLabel(item.mult);
    li.className = `rpgTypeRow ${tone.cls}`;

    const left = document.createElement("span");
    left.className = "rpgTypeLeft";

    const pill = document.createElement("span");
    pill.className = `typePill typePill--${item.type}`;
    pill.textContent = item.type;

    const name = document.createElement("span");
    name.className = "rpgTypeName";
    name.textContent = item.label;

    left.appendChild(pill);
    left.appendChild(name);

    const meta = document.createElement("span");
    meta.className = "rpgTypeMeta";

    const mult = document.createElement("span");
    mult.className = "rpgMult";
    mult.textContent = `x${fmtMult(item.mult)}`;

    const tag = document.createElement("span");
    tag.className = "rpgTag";
    tag.textContent = tone.text;

    meta.appendChild(mult);
    meta.appendChild(tag);

    li.appendChild(left);
    li.appendChild(meta);

    listEl.appendChild(li);
  }

  /**
   * Render the simple matchup lists (no giant chart required).
   */
  function renderMatchupLists() {
    // Clear
    if (els.atkVsEnemyList instanceof HTMLElement) els.atkVsEnemyList.innerHTML = "";
    if (els.enemyVsYouList instanceof HTMLElement) els.enemyVsYouList.innerHTML = "";

    // Player moves (what the UI actually offers)
    const atkPrev = computeTypedDamage("player", "enemy", 5, "Sight");
    const windPrev = computeTypedDamage("player", "enemy", 4, "Wind");
    const firePrev = computeTypedDamage("player", "enemy", 6, "Fire");

    appendMatchupRow(els.atkVsEnemyList, { type: "Sight", label: "Attack", mult: atkPrev.overall });
    appendMatchupRow(els.atkVsEnemyList, { type: "Wind", label: "Wind spell", mult: windPrev.overall });

    const offType = !state.player.types.includes("Fire");
    appendMatchupRow(els.atkVsEnemyList, { type: "Fire", label: offType ? "Fire spell (off-type)" : "Fire spell", mult: firePrev.overall });

    // Enemy core move types (based on their types)
    const seen = new Set();
    for (const t of state.enemy.types) {
      if (seen.has(t)) continue;
      seen.add(t);
      const prev = computeTypedDamage("enemy", "player", 5, t);
      appendMatchupRow(els.enemyVsYouList, { type: t, label: `${t} move`, mult: prev.overall });
    }
  }

/** @param {string} text @param {"super"|"not"|"neutral"} tone */
  function setEffectBanner(text, tone) {
    if (!(els.effectBanner instanceof HTMLElement)) return;
    els.effectBanner.classList.remove("isSuper", "isNot", "isNeutral");
    if (tone === "super") els.effectBanner.classList.add("isSuper");
    else if (tone === "not") els.effectBanner.classList.add("isNot");
    else els.effectBanner.classList.add("isNeutral");
    els.effectBanner.textContent = text || "—";
  }

  /** @param {number} overall */
  function toneFromMultiplier(overall) {
    if (overall >= 1.30) return "super";
    if (overall <= 0.90) return "not";
    return "neutral";
  }

  /**
   * Compute typed damage with STAB + effectiveness (defenses applied later).
   * @param {"player"|"enemy"} attackerKey
   * @param {"player"|"enemy"} defenderKey
   * @param {number} base
   * @param {MagicType} moveType
   */
  function computeTypedDamage(attackerKey, defenderKey, base, moveType) {
    const attacker = state[attackerKey];
    const defender = state[defenderKey];
    const stab = attacker.types.includes(moveType) ? 1.2 : 1.0;
    const eff = typeMultiplier(moveType, defender.types);
    const scaled = Math.max(1, Math.round(base * stab * eff));
    return {
      scaled,
      stab,
      eff,
      overall: stab * eff,
      note: effectivenessText(stab * eff),
    };
  }

  // --------------------
  // Combatants + waves
  // --------------------

  const PLAYER_TEMPLATE = {
    name: "Player",
    types: /** @type {MagicType[]} */ (["Wind", "Sight"]),
    maxHp: 20,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
  };

  const ENEMIES = [
    {
      name: "Rival Mage",
      types: /** @type {MagicType[]} */ (["Fire", "Sight"]),
      maxHp: 22,
      healCharges: 2,
      profile: "fireSight",
      sprite: "./assets/images/enemy-blue.png",
    },
    {
      name: "Stonebound Seer",
      types: /** @type {MagicType[]} */ (["Earth", "Touch"]),
      maxHp: 28,
      healCharges: 2,
      profile: "earthTouch",
      sprite: "./assets/images/enemy-blonde.png",
    },
  ];

  /**
   * Create a fresh enemy state from template.
   * @param {number} waveIndex
   */
  function makeEnemy(waveIndex) {
    const t = ENEMIES[waveIndex] ?? ENEMIES[0];
    return {
      name: t.name,
      types: t.types,
      hp: t.maxHp,
      max: t.maxHp,
      healCharges: t.healCharges,

      // statuses
      guarding: false,     // brace (50% next hit)
      ward: 0,             // mirror ward: 40% reduction + reflect
      fortified: 0,        // earth fortify: 30% reduction
      gusted: false,       // next damage -2
      burn: 0,             // ticks 2 at start of turn
      enraged: false,

      // AI
      profile: t.profile,
      aiStep: 0,
      intent: null,        // filled at start of player's turn
      sprite: t.sprite,
    };
  }

  function makeInitialState() {
    return {
      turn: 1,
      wave: 0,
      player: {
        name: PLAYER_TEMPLATE.name,
        types: PLAYER_TEMPLATE.types,
        hp: PLAYER_TEMPLATE.maxHp,
        max: PLAYER_TEMPLATE.maxHp,

        // statuses
        guarding: false,
        evading: false,   // next hit reduced
        burn: 0,
        bound: 0,         // touch bind: next attack weakened + magic costs +1 focus

        // resources
        healCharges: PLAYER_TEMPLATE.healCharges,
        focus: PLAYER_TEMPLATE.focusStart,
        focusMax: PLAYER_TEMPLATE.focusMax,
      },
      enemy: makeEnemy(0),
      over: false,
      log: [
        `Wave 1: ${ENEMIES[0].name} steps into view.`,
        "Your turn.",
      ],
    };
  }

  const GAME_BUILD = "2026-02-14p";

  /** @type {ReturnType<typeof makeInitialState>} */
  let state = makeInitialState();

  if (els.buildTag instanceof HTMLElement) els.buildTag.textContent = `Build: ${GAME_BUILD}`;

  // "How to play" helper: open by default on first visit, remember your choice.
  try {
    const KEY = "dragonstone_rpg_howto_open";
    if (els.howtoDetails instanceof HTMLDetailsElement) {
      const saved = window.localStorage.getItem(KEY);
      if (saved === null) els.howtoDetails.open = true;
      else els.howtoDetails.open = saved === "1";
      els.howtoDetails.addEventListener("toggle", () => {
        window.localStorage.setItem(KEY, els.howtoDetails.open ? "1" : "0");
      });
    }
  } catch (e) {
    // localStorage may be blocked (private mode). Ignore.
  }


  /** @param {string} message */
  function addLog(message) {
    state.log.unshift(message);
    if (state.log.length > 18) state.log = state.log.slice(0, 18);
  }

  function isGameOver() {
    return state.over || state.player.hp <= 0;
  }

  /** @param {HTMLElement|null} el @param {string} text */
  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  /** @param {HTMLElement|null} el @param {number} ratio */
  function setBar(el, ratio) {
    if (!el) return;
    const safe = clamp(ratio, 0, 1);
    el.style.width = `${Math.round(safe * 100)}%`;
  }

  function statusLineForPlayer() {
    const parts = [];
    if (!state.over && state.player.guarding) parts.push("Guarding (next hit −50%)");
    if (!state.over && state.player.evading) parts.push("Evasive veil (next hit softened)");
    if (!state.over && state.player.bound > 0) parts.push("Bound (next move weakened)");
    if (!state.over && state.player.burn > 0) parts.push(`Burning (${state.player.burn})`);
    return parts.length ? parts.join(" • ") : "Ready";
  }

  function statusLineForEnemy() {
    const parts = [];
    if (!state.over && state.enemy.enraged) parts.push("Enraged");
    if (!state.over && state.enemy.ward > 0) parts.push("Mirror ward (reflect)");
    if (!state.over && state.enemy.fortified > 0) parts.push("Fortified (next hit −30%)");
    if (!state.over && state.enemy.guarding) parts.push("Bracing (next hit −50%)");
    if (!state.over && state.enemy.gusted) parts.push("Gusted (next hit weakened)");
    if (!state.over && state.enemy.burn > 0) parts.push(`Burning (${state.enemy.burn})`);
    return parts.length ? parts.join(" • ") : "Channeling";
  }

  function setEnemyVisuals() {
    if (!(els.enemySprite instanceof HTMLElement)) return;
    els.enemySprite.classList.toggle("is-phase2", state.wave >= 1);
  }

  // --------------------
  // Intent (telegraph)
  // --------------------

  /**
   * @typedef {object} Intent
   * @property {string} id
   * @property {string} name
   * @property {MagicType|null} type
   * @property {number} base
   * @property {string} note
   */

  /**
   * Decide what the enemy will do next (deterministic, readable).
   * Runs at the start of the player's turn so you can plan.
   * @returns {Intent}
   */
  function computeEnemyIntent() {
    const e = state.enemy;
    const p = state.player;

    // Emergency heal takes priority (still deterministic).
    if (e.hp <= Math.ceil(e.max * 0.35) && e.healCharges > 0) {
      return { id: "heal", name: "Mend", type: null, base: 0, note: "Heals 6 HP" };
    }

    // Wave 1: Fire/Sight pattern.
    if (e.profile === "fireSight") {
      const pattern = ["ignite", "lance", "ward", "siphon", "attack"];
      let next = pattern[e.aiStep % pattern.length];

      // If you're already burning, they don't waste a turn re-igniting.
      if (next === "ignite" && p.burn > 0) next = "lance";

      if (next === "ignite") return { id: "ignite", name: "Ignite", type: "Fire", base: 4, note: "Applies Burn (2)" };
      if (next === "lance") return { id: "lance", name: "Arcane Lance", type: "Sight", base: 6, note: "" };
      if (next === "ward") return { id: "ward", name: "Mirror Ward", type: null, base: 0, note: "Next hit reduced + reflects" };
      if (next === "siphon") return { id: "siphon", name: "Siphon", type: "Sight", base: 4, note: "Heals enemy for 3" };
      return { id: "attack", name: "Strike", type: "Sight", base: 4, note: "" };
    }

    // Wave 2: Earth/Touch pattern.
    const pattern = ["stonebind", "quake", "fortify", "shatter", "quake"];
    let next = pattern[e.aiStep % pattern.length];

    // If you're already bound, they pivot to damage.
    if (next === "stonebind" && p.bound > 0) next = "quake";

    if (next === "stonebind") return { id: "stonebind", name: "Stonebind", type: "Touch", base: 3, note: "Applies Bind" };
    if (next === "quake") return { id: "quake", name: "Quake", type: "Earth", base: 6, note: "Shakes through guard" };
    if (next === "fortify") return { id: "fortify", name: "Fortify", type: null, base: 0, note: "Next hit reduced" };
    return { id: "shatter", name: "Shatter", type: "Earth", base: 5, note: "Punishes Guard" };
  }

  /** @param {Intent|null} intent */
  function renderIntent(intent) {
    if (!(els.enemyIntentText instanceof HTMLElement)) return;
    if (!intent) {
      els.enemyIntentText.textContent = "Intent: —";
      return;
    }

    if (!intent.type) {
      els.enemyIntentText.textContent = `Intent: ${intent.name} (${intent.note || "—"})`;
      return;
    }

    const typed = computeTypedDamage("enemy", "player", intent.base, intent.type);
    const badge = typed.note ? `, ${typed.note}` : "";
    els.enemyIntentText.textContent = `Intent: ${intent.name} (${intent.type} x${fmtMult(typed.overall)}${badge})`;
  }

  // --------------------
  // Defenses + statuses
  // --------------------

  /**
   * Apply enemy defenses. Returns {final, reflected}.
   * @param {number} incoming
   */
  function applyEnemyDefenses(incoming) {
    let final = incoming;
    let reflected = 0;

    // Mirror ward: 40% reduction + reflect 25% of pre-ward
    if (state.enemy.ward > 0) {
      const before = final;
      final = Math.ceil(final * 0.6);
      reflected = Math.max(1, Math.floor(before * 0.25));
      state.enemy.ward = 0;
      addLog(`A mirror ward bends the strike (${before} → ${final}) and bites back (${reflected}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    // Fortify: 30% reduction
    if (state.enemy.fortified > 0) {
      const before = final;
      final = Math.ceil(final * 0.7);
      state.enemy.fortified = 0;
      addLog(`${state.enemy.name} is fortified (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    // Brace: 50% reduction
    if (state.enemy.guarding) {
      const before = final;
      final = Math.floor(final / 2);
      state.enemy.guarding = false;
      addLog(`${state.enemy.name} braces (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    return { final, reflected };
  }

  /**
   * Apply player defenses. Returns final.
   * @param {number} incoming
   * @param {{quake?: boolean, shatter?: boolean}} flags
   */
  function applyPlayerDefenses(incoming, flags = {}) {
    let final = incoming;

    // Evasion veil: reduce next hit by 60%
    if (state.player.evading) {
      const before = final;
      final = Math.ceil(final * 0.4);
      state.player.evading = false;
      addLog(`You slip in an evasive veil (${before} → ${final}).`);
      playAnim(els.playerSprite, "rpgAnim-guard");
    }

    // Guard: usually halves next hit, but Quake pushes through.
    if (state.player.guarding) {
      const before = final;
      if (flags.quake) {
        final = Math.ceil(final * 0.75); // only 25% reduction
        addLog(`The quake pushes through your guard (${before} → ${final}).`);
      } else if (flags.shatter) {
        // Shatter breaks guard and adds pressure.
        final = final + 2;
        addLog(`Shatter cracks your guard (${before} → ${final}).`);
      } else {
        final = Math.floor(final / 2);
        addLog(`You guard and soften the blow (${before} → ${final}).`);
      }
      state.player.guarding = false;
      playAnim(els.playerSprite, "rpgAnim-guard");
    }

    return final;
  }

  /**
   * Burn ticks at start of unit's turn: -2 HP, burn-1.
   * @param {"player"|"enemy"} who
   */
  function tickBurn(who) {
    const unit = state[who];
    if (!unit || unit.burn <= 0) return;

    const dmg = 2;
    unit.hp = clamp(unit.hp - dmg, 0, unit.max);
    unit.burn = Math.max(0, unit.burn - 1);

    const label = who === "player" ? "You" : state.enemy.name;
    addLog(`${label} take${who === "player" ? "" : "s"} ${dmg} burn damage.`);
    if (who === "player") playAnim(els.playerSprite, "rpgAnim-hit");
    if (who === "enemy") playAnim(els.enemySprite, "rpgAnim-hit");
  }

  // --------------------
  // Render
  // --------------------

  function render() {
    const playerHp = clamp(state.player.hp, 0, state.player.max);
    const enemyHp = clamp(state.enemy.hp, 0, state.enemy.max);

    // Resource helpers (used throughout render)
    const focus = state.player.focus;
    const boundExtra = state.player.bound > 0 ? 1 : 0;
    const healCost = 1 + boundExtra;

    // Names + types
    setText(els.playerName, state.player.name);
    setText(els.enemyName, `${state.enemy.name} (Wave ${state.wave + 1}/${ENEMIES.length})`);
    setTypeLine(els.playerTypeText, state.player.types);
    setTypeLine(els.enemyTypeText, state.enemy.types);

    // Focus + intent
    if (els.playerFocusText instanceof HTMLElement) {
      els.playerFocusText.textContent = `Focus: ${focus} / ${state.player.focusMax}`;
    }
    // Focus bar (visual) + keep the hover preview accurate as focus changes.
    setBar(els.playerFocusFill, focus / state.player.focusMax);
    renderIntent(state.enemy.intent);
    renderEffectPreview(previewMove);
    renderHint();

    // Sprite swap (wave-based enemies)
    if (els.enemySpriteImg instanceof HTMLImageElement && state.enemy.sprite) {
      if (els.enemySpriteImg.getAttribute("src") !== state.enemy.sprite) {
        els.enemySpriteImg.setAttribute("src", state.enemy.sprite);
      }
    }

    // Type pills
    renderTypePills(els.playerTypePills, state.player.types);
    renderTypePills(els.enemyTypePills, state.enemy.types);

    // Accent cues: make types visually obvious on cards and sprites
    setTypeAccent(els.playerCard, state.player.types);
    setTypeAccent(els.enemyCard, state.enemy.types);
    setTypeAccent(els.playerSprite, state.player.types);
    setTypeAccent(els.enemySprite, state.enemy.types);

    // Simple matchup lists
    renderMatchupLists();

    // Button labels show multiplier + cost (so choices are readable)
    const atkPrev = computeTypedDamage("player", "enemy", 5, "Sight");
    const windPrev = computeTypedDamage("player", "enemy", 4, "Wind");
    const firePrev = computeTypedDamage("player", "enemy", 6, "Fire");

    if (els.attackBtn instanceof HTMLButtonElement) {
      els.attackBtn.textContent = `Attack (Sight x${fmtMult(atkPrev.overall)} | +1 Focus)`;
    }
    if (els.windBtn instanceof HTMLButtonElement) {
      els.windBtn.textContent = `Wind attack (2 Focus, x${fmtMult(windPrev.overall)})`;
    }
    if (els.fireBtn instanceof HTMLButtonElement) {
      const offType = !state.player.types.includes("Fire");
      const label = offType ? "Fire attack (off-type)" : "Fire attack";
      els.fireBtn.textContent = `${label} (3 Focus, x${fmtMult(firePrev.overall)})`;
    }

    if (els.healBtn instanceof HTMLButtonElement) {
      els.healBtn.textContent = `Heal (${healCost} Focus, ${state.player.healCharges})`;
    }

    // HP
    setText(els.playerHpText, `HP ${playerHp} / ${state.player.max}`);
    setText(els.enemyHpText, `HP ${enemyHp} / ${state.enemy.max}`);
    setBar(els.playerHpFill, playerHp / state.player.max);
    setBar(els.enemyHpFill, enemyHp / state.enemy.max);

    // Status
    if (state.over) {
      setText(els.playerStatus, playerHp <= 0 ? "Defeated" : "Victorious");
      setText(els.enemyStatus, enemyHp <= 0 ? "Defeated" : "Silent");
    } else {
      setText(els.playerStatus, statusLineForPlayer());
      setText(els.enemyStatus, statusLineForEnemy());
    }

    // Sprite states
    if (els.playerSprite) {
      els.playerSprite.classList.toggle("is-guarding", !state.over && state.player.guarding);
    }
    if (els.enemySprite) {
      els.enemySprite.classList.toggle("is-guarding", !state.over && state.enemy.guarding);
    }
    setEnemyVisuals();

    // Log
    if (els.log) {
      els.log.innerHTML = "";
      state.log.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        els.log.appendChild(li);
      });
    }

    // Enable/disable actions
    const disableActions = state.over;
    if (disableActions) closeMagicMenu();

    const canWind = !state.over && focus >= (2 + boundExtra);
    const canFire = !state.over && focus >= (3 + boundExtra);
    const canHeal = !state.over && state.player.healCharges > 0 && focus >= healCost;

    if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.disabled = disableActions;
    if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.disabled = disableActions;
    if (els.magicToggle instanceof HTMLButtonElement) els.magicToggle.disabled = disableActions;
    if (els.windBtn instanceof HTMLButtonElement) els.windBtn.disabled = !canWind;
    if (els.fireBtn instanceof HTMLButtonElement) els.fireBtn.disabled = !canFire;
    if (els.healBtn instanceof HTMLButtonElement) els.healBtn.disabled = !canHeal;
    if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.disabled = false;
  }

  function endGame(message) {
    state.over = true;
    addLog(message);
    if (state.enemy.hp <= 0) playAnim(els.enemySprite, "rpgAnim-faint");
    if (state.player.hp <= 0) playAnim(els.playerSprite, "rpgAnim-faint");
    render();
  }

  /**
   * Transition to next wave if available.
   */
  function advanceWave(defeatMessage) {
    addLog(defeatMessage);

    // Play the badge-unlock SFX when you clear Wave 1.
    if (state.wave === 0) playWaveClearSfx();

    playAnim(els.enemySprite, "rpgAnim-faint");

    const nextIndex = state.wave + 1;
    if (nextIndex >= ENEMIES.length) {
      endGame("The duel ends. You win!");
      return;
    }

    // Between-wave breather (fixed, not random)
    const bonus = 3;
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + bonus, 0, state.player.max);
    const actual = state.player.hp - before;
    if (actual > 0) addLog(`You catch a second wind (+${actual} HP).`);

    // Clear tactical one-turn states.
    state.player.guarding = false;
    state.player.evading = false;

    // Spawn next enemy.
    state.wave = nextIndex;
    state.enemy = makeEnemy(state.wave);

    addLog(`Wave ${state.wave + 1}: ${state.enemy.name} arrives.`);
    addLog("Your turn.");

    // Set new intent for readability.
    state.enemy.intent = computeEnemyIntent();
    renderIntent(state.enemy.intent);

    setEffectBanner("—", "neutral");
    render();
  }

  // --------------------
  // Turn flow
  // --------------------

  function beginPlayerTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    // Start-of-turn effects on player
    tickBurn("player");
    if (state.player.hp <= 0) {
      endGame("The burn finishes you. Game over.");
      return;
    }

    // Telegraph the next enemy move now (strategy).
    state.enemy.intent = computeEnemyIntent();
    renderIntent(state.enemy.intent);

    addLog("Your turn.");
    render();
  }

  function enemyTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    // Start-of-turn effects on enemy
    tickBurn("enemy");
    if (state.enemy.hp <= 0) {
      advanceWave(`${state.enemy.name} collapses from lingering flame.`);
      return;
    }

    // Enrage phase (deterministic)
    if (!state.enemy.enraged && state.enemy.hp <= Math.ceil(state.enemy.max * 0.4)) {
      state.enemy.enraged = true;
      addLog(`${state.enemy.name} hardens their stance (enraged).`);
    }

    const e = state.enemy;
    const p = state.player;

    /** @type {Intent} */
    const intent = e.intent || computeEnemyIntent();

    // Consume the step after deciding the intent (keeps the pattern stable)
    e.aiStep += 1;

    // Execute intent
    if (intent.id === "heal") {
      const heal = 6;
      const before = e.hp;
      e.hp = clamp(e.hp + heal, 0, e.max);
      const actual = e.hp - before;
      e.healCharges = Math.max(0, e.healCharges - 1);
      addLog(actual > 0 ? `${e.name} mends for ${actual} HP.` : `${e.name} tries to mend, but is already at full HP.`);
      playAnim(els.enemySprite, "rpgAnim-heal");
      beginPlayerTurn();
      return;
    }

    if (intent.id === "ward") {
      e.ward = 1;
      addLog(`${e.name} conjures a mirror ward.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      beginPlayerTurn();
      return;
    }

    if (intent.id === "fortify") {
      e.fortified = 1;
      addLog(`${e.name} fortifies their stance.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      beginPlayerTurn();
      return;
    }

    // Damage moves
    playAnim(els.enemySprite, "rpgAnim-attack");

    let base = intent.base + (e.enraged ? 1 : 0);

    // Gusted: deterministic -2 on next hit
    if (e.gusted) {
      base = Math.max(1, base - 2);
      e.gusted = false;
      addLog("A lingering gust throws off their focus (−2 damage).");
    }

    const moveType = /** @type {MagicType} */ (intent.type || "Sight");
    const typed = computeTypedDamage("enemy", "player", base, moveType);

    // Special flags for certain moves
    const flags = {
      quake: intent.id === "quake",
      shatter: intent.id === "shatter",
    };

    // Apply player defenses
    const afterDef = applyPlayerDefenses(typed.scaled, flags);
    p.hp = clamp(p.hp - afterDef, 0, p.max);

    addLog(`${e.name} uses ${intent.name} for ${afterDef} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.playerSprite, "rpgAnim-hit");

    // Apply deterministic status effects
    if (intent.id === "ignite") {
      p.burn = Math.max(p.burn, 2);
      addLog("Flame clings to you (burn).");
    }
    if (intent.id === "stonebind") {
      p.bound = 1;
      addLog("Stonebind locks your movement (bind).");
    }
    if (intent.id === "siphon") {
      const heal = 3;
      e.hp = clamp(e.hp + heal, 0, e.max);
      addLog(`${e.name} siphons power and heals for ${heal}.`);
    }

    if (p.hp <= 0) {
      endGame("You collapse. Game over.");
      return;
    }

    beginPlayerTurn();
  }

  // --------------------
  // Player actions (deterministic)
  // --------------------

  function onEnemyDown(message) {
    closeMagicMenu();
    if (state.enemy.hp > 0) return;
    advanceWave(message);
  }

  function spendFocus(cost) {
    state.player.focus = clamp(state.player.focus - cost, 0, state.player.focusMax);
  }

  function gainFocus(amount) {
    state.player.focus = clamp(state.player.focus + amount, 0, state.player.focusMax);
  }

  function clearBindIfAny() {
    if (state.player.bound > 0) {
      state.player.bound = 0;
      addLog("You shake off the bind.");
    }
  }

  function playerAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    playAnim(els.playerSprite, "rpgAnim-attack");

    // Attack: fixed base, generates Focus
    let base = 5;

    // Bind weakens next move
    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind dulls your strike (−2).");
    }

    const typed = computeTypedDamage("player", "enemy", base, "Sight");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You strike ${state.enemy.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");

    // Mirror reflect
    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    gainFocus(1);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerWindAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 2 + extra;
    if (state.player.focus < cost) {
      addLog("Not enough Focus.");
      render();
      return;
    }

    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = 4;

    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind drags your wind blade (−2).");
    }

    const typed = computeTypedDamage("player", "enemy", base, "Wind");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You send a wind blade for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");

    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    // Deterministic tactical effects
    state.enemy.gusted = true;       // next enemy hit -2
    state.player.evading = true;     // next hit reduced
    addLog("Gust rattles their aim (next enemy hit −2).");
    addLog("An evasive veil surrounds you (next hit softened).");

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerFireAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 3 + extra;
    if (state.player.focus < cost) {
      addLog("Not enough Focus.");
      render();
      return;
    }

    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = 6;

    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind makes your flame falter (−2).");
    }

    const typed = computeTypedDamage("player", "enemy", base, "Fire");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You hurl flame for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");

    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    // Always applies burn (no RNG)
    state.enemy.burn = Math.max(state.enemy.burn, 2);
    addLog(`${state.enemy.name} catches flame (burn).`);

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerHeal() {
    if (isGameOver()) return;
    closeMagicMenu();

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 1 + extra;

    if (state.player.healCharges <= 0) {
      addLog("Your healing focus is spent.");
      render();
      return;
    }
    if (state.player.focus < cost) {
      addLog("Not enough Focus.");
      render();
      return;
    }

    playAnim(els.playerSprite, "rpgAnim-heal");

    const heal = 5;
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.max);
    const actual = state.player.hp - before;

    state.player.healCharges = Math.max(0, state.player.healCharges - 1);
    spendFocus(cost);

    // Cleanse one negative (strategy lever)
    if (state.player.burn > 0) {
      state.player.burn = 0;
      addLog("You cleanse the burn.");
    }
    clearBindIfAny();

    addLog(actual > 0 ? `You heal for ${actual} HP.` : "You try to heal, but you're already at full HP.");

    enemyTurn();
  }

  function playerGuard() {
    if (isGameOver()) return;
    closeMagicMenu();

    if (!state.player.guarding) {
      state.player.guarding = true;
      addLog("You raise your guard (+1 Focus).");
      playAnim(els.playerSprite, "rpgAnim-guard");
      gainFocus(1);

      // Guarding breaks bind immediately (a clear decision).
      clearBindIfAny();
    } else {
      addLog("You're already guarding.");
    }

    enemyTurn();
  }

  function restart() {
    closeMagicMenu();
    state = makeInitialState();

    const clear = [
      "rpgAnim-attack",
      "rpgAnim-hit",
      "rpgAnim-heal",
      "rpgAnim-guard",
      "rpgAnim-faint",
    ];

    if (els.enemySprite instanceof HTMLElement) {
      clear.forEach((c) => els.enemySprite.classList.remove(c));
      els.enemySprite.classList.remove("is-guarding");
      els.enemySprite.classList.remove("is-phase2");
    }
    if (els.playerSprite instanceof HTMLElement) {
      clear.forEach((c) => els.playerSprite.classList.remove(c));
      els.playerSprite.classList.remove("is-guarding");
    }

    // Set initial intent so the first turn is readable.
    state.enemy.intent = computeEnemyIntent();
    renderIntent(state.enemy.intent);

    setEffectBanner("—", "neutral");
    render();
  }

  // --------------------
  // Wire up events
  // --------------------

  if (els.magicToggle instanceof HTMLButtonElement) {
    els.magicToggle.addEventListener("click", toggleMagicMenu);
  }
  if (els.windBtn instanceof HTMLButtonElement) els.windBtn.addEventListener("click", playerWindAttack);
  if (els.fireBtn instanceof HTMLButtonElement) els.fireBtn.addEventListener("click", playerFireAttack);

  if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.addEventListener("click", playerAttack);
  if (els.healBtn instanceof HTMLButtonElement) els.healBtn.addEventListener("click", playerHeal);
  if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.addEventListener("click", playerGuard);
  if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.addEventListener("click", restart);

  
  // Effectiveness preview (hover/focus shows Extra/Normal/Weak before you click)
  const wirePreview = (btn, name, type, baseCost) => {
    if (!(btn instanceof HTMLElement)) return;
    btn.addEventListener("mouseenter", () => setPreviewMove(name, type, baseCost));
    btn.addEventListener("focus", () => setPreviewMove(name, type, baseCost));
    // Also update on click, since some users go straight to clicking.
    btn.addEventListener("click", () => setPreviewMove(name, type, baseCost));
  };
  wirePreview(els.attackBtn, "Attack", "Sight", 0);
  wirePreview(els.windBtn, "Wind attack", "Wind", 2);
  wirePreview(els.fireBtn, "Fire attack", "Fire", 3);

// Initialize
  state.enemy.intent = computeEnemyIntent();
  renderIntent(state.enemy.intent);
  setEffectBanner("—", "neutral");
  render();
}
