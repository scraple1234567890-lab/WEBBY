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
    playerLevelText: document.getElementById("playerLevelText"),
    playerXpFill: document.getElementById("playerXpFill"),
    enemyFocusText: document.getElementById("enemyFocusText"),
    enemyFocusFill: document.getElementById("enemyFocusFill"),
    enemyIntentText: document.getElementById("enemyIntentText"),

    log: document.getElementById("battleLog"),
    turnBanner: document.getElementById("turnBanner"),
    actionsWrap: document.querySelector(".rpgActions"),
    attackBtn: document.getElementById("attackBtn"),
    healBtn: document.getElementById("healBtn"),
    guardBtn: document.getElementById("guardBtn"),
    restartBtn: document.getElementById("restartBtn"),
    heroBtn: document.getElementById("heroBtn"),
    magicToggle: document.getElementById("magicToggle"),
    magicMenu: document.getElementById("magicMenu"),
    windBtn: document.getElementById("windBtn"),
    secondaryTypeBtn: document.getElementById("secondaryTypeBtn"),
    waterBtn: document.getElementById("waterBtn"),
    soundBtn: document.getElementById("soundBtn"),
    smellTasteBtn: document.getElementById("smellTasteBtn"),
    fireBtn: document.getElementById("fireBtn"),
    effectPreview: document.getElementById("effectPreview"),
    hintLine: document.getElementById("rpgHint"),
    howtoDetails: document.getElementById("howtoDetails"),

    explainBtn: document.getElementById("explainBtn"),
    explainModal: document.getElementById("explainModal"),
    explainClose: document.getElementById("explainClose"),
    explainOk: document.getElementById("explainOk"),

    // Location picker (pre-combat)
    locationModal: document.getElementById("locationModal"),
    locationChoices: document.getElementById("locationChoices"),

    // Character picker (pre-combat)
    characterModal: document.getElementById("characterModal"),
    characterChoices: document.getElementById("characterChoices"),
    characterClose: document.getElementById("characterClose"),
    characterOk: document.getElementById("characterOk"),
    resetProgressBtn: document.getElementById("resetProgressBtn"),

    playerSprite: document.getElementById("playerSprite"),
    enemySprite: document.getElementById("enemySprite"),
    playerSpriteImg: document.getElementById("playerSpriteImg"),
    enemySpriteImg: document.getElementById("enemySpriteImg"),

    // FX layer (type-based visuals)
    stageInner: document.querySelector(".rpgStageInner"),
    fxLayer: document.getElementById("fxLayer"),

    playerTypePills: document.getElementById("playerTypePills"),
    enemyTypePills: document.getElementById("enemyTypePills"),
    atkVsEnemyList: document.getElementById("atkVsEnemyList"),
    enemyVsYouList: document.getElementById("enemyVsYouList"),
    typeMatrix: document.getElementById("typeMatrix"),
    effectBanner: document.getElementById("effectBanner"),
    moveBanner: document.getElementById("moveBanner"),
    moveBannerText: document.getElementById("moveBannerText"),
    buildTag: document.getElementById("buildTag"),
  };

  const prefersReducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

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

  /**
   * Spawn a one-shot type FX overlay.
   * @param {"wind"|"water"|"fire"|"earth"|"earthCenter"|"sight"|"touch"|"sound"|"smell"|"heal"|"guard"} kind
   * @param {"player"|"enemy"|"center"} side
   */
  function spawnFx(kind, side) {
    if (prefersReducedMotion) return;
    if (!(els.fxLayer instanceof HTMLElement)) return;
    const fx = document.createElement("div");
    fx.className = `rpgFx rpgFx--${kind} rpgFx--${side}`;
    els.fxLayer.appendChild(fx);
    const kill = () => {
      fx.removeEventListener("animationend", kill);
      if (fx.parentElement) fx.parentElement.removeChild(fx);
    };
    // In case no animationend fires (rare), remove anyway.
    fx.addEventListener("animationend", kill, { once: true });
    window.setTimeout(kill, 900);
  }

  /**
   * Floating text pop (damage/heal).
   * @param {string} text
   * @param {"player"|"enemy"} side
   * @param {"dmg"|"heal"} variant
   * @param {number|null} overallMult
   */
  function spawnFloat(text, side, variant = "dmg", overallMult = null) {
    if (prefersReducedMotion) return;
    if (!(els.fxLayer instanceof HTMLElement)) return;
    const f = document.createElement("div");
    f.className = `rpgFloat rpgFloat--${side} rpgFloat--${variant}`;
    if (typeof overallMult === "number") {
      if (overallMult >= 1.30) f.classList.add("rpgFloat--super");
      else if (overallMult <= 0.90) f.classList.add("rpgFloat--weak");
    }
    f.textContent = text;
    els.fxLayer.appendChild(f);
    const kill = () => {
      f.removeEventListener("animationend", kill);
      if (f.parentElement) f.parentElement.removeChild(f);
    };
    f.addEventListener("animationend", kill, { once: true });
    window.setTimeout(kill, 950);
  }

  // Center banner: show the move/action name on the battlefield, then fade away.
  let moveBannerTimer = 0;

  /**
   * @param {string} name
   * @param {MagicType} type
   */
  function showMoveBanner(name, type) {
    if (prefersReducedMotion) return;
    const banner = els.moveBanner;
    const textEl = els.moveBannerText;
    if (!(banner instanceof HTMLElement) || !(textEl instanceof HTMLElement)) return;

    textEl.textContent = name || "";
    banner.setAttribute("data-type", String(type || "Sight"));
    banner.classList.remove("isShow");
    // Force reflow to restart the animation reliably.
    // eslint-disable-next-line no-unused-expressions
    banner.offsetWidth;
    banner.classList.add("isShow");

    if (moveBannerTimer) window.clearTimeout(moveBannerTimer);
    moveBannerTimer = window.setTimeout(() => banner.classList.remove("isShow"), 560);
  }



  function stageShake() {
    if (prefersReducedMotion) return;
    if (!(els.stageInner instanceof HTMLElement)) return;
    els.stageInner.classList.remove("isShaking");
    // eslint-disable-next-line no-unused-expressions
    els.stageInner.offsetWidth;
    els.stageInner.classList.add("isShaking");
    window.setTimeout(() => els.stageInner && els.stageInner.classList.remove("isShaking"), 260);
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
  Water: { icon: "💧", label: "Water" },
  Fire:  { icon: "🔥", label: "Fire" },
  Earth: { icon: "🪨", label: "Earth" },
  Sight: { icon: "👁", label: "Sight" },
  Sound: { icon: "🔊", label: "Sound" },
  SmellTaste: { icon: "👃🍯", label: "Smell/Taste" },
  Touch: { icon: "✋", label: "Touch" },
});

/** @param {MagicType} t */
function typeIcon(t) {
  return TYPE_META[t]?.icon ?? "✦";
}

/** @param {MagicType} t */
function fxKindForType(t) {
  /** @type {Record<MagicType, "wind"|"water"|"fire"|"earth"|"sight"|"touch"|"sound"|"smell">} */
  const m = { Wind: "wind", Water: "water", Fire: "fire", Earth: "earth", Sight: "sight", Sound: "sound", SmellTaste: "smell", Touch: "touch" };
  return m[t] || "sight";
}

/**
 * Player "basic" attack type.
 * Rule: Attack matches your hero's primary type so your baseline move always correlates with your hero.
 * @returns {MagicType}
 */
function playerPrimaryType() {
  const t = state && state.player && Array.isArray(state.player.types) ? state.player.types[0] : null;
  return /** @type {MagicType} */ (t || "Sight");
}

/** @param {MagicType} t */
function playerHasType(t) {
  return !!(state && state.player && Array.isArray(state.player.types) && state.player.types.includes(t));
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
  explainLastFocus = document.activeElement;
  updateBodyModalOpen();

  // focus close button for keyboard users
  if (els.explainClose instanceof HTMLButtonElement) els.explainClose.focus();
}


  function closeExplain() {
  if (!(els.explainModal instanceof HTMLElement)) return;
  els.explainModal.setAttribute("hidden", "");
  const prev = explainLastFocus;
  explainLastFocus = null;
  updateBodyModalOpen();
  if (prev && prev instanceof HTMLElement) prev.focus();
}
  function isHeroOpen() {
  return (els.characterModal instanceof HTMLElement) && !els.characterModal.hasAttribute("hidden");
}

function updateBodyModalOpen() {
  const any = isExplainOpen() || isHeroOpen() || isLocationOpen();
  document.body.classList.toggle("modalOpen", any);
}

function renderHeroChoices() {
  if (!(els.characterChoices instanceof HTMLElement)) return;

  const active = pendingHeroId || activeHeroId;

  els.characterChoices.innerHTML = PLAYABLE_HEROES.map((h) => {
    const types = h.typesLabel || formatTypesDisplay(h.types);
    const prog = loadHeroProgress(h.id);
    const scaled = applyLevelToHero(h, prog.level);
    const xpNeed = xpToNext(prog.level);
    return `
      <button type="button" class="btn ghost rpgCharChoice ${h.id === active ? "isSelected" : ""}" data-hero="${h.id}">
        <div class="rpgCharSprite"><img src="${h.sprite}" alt="" /></div>
        <div>
          <div class="rpgCharTitle">${h.name}</div>
          <div class="rpgCharMeta muted small"><span class="pill">${types}</span></div>
          <div class="rpgCharStats muted">Lv ${prog.level} • XP ${prog.xp}/${xpNeed}</div>
          <div class="rpgCharStats muted">HP ${scaled.maxHp} • Mana ${scaled.focusStart}/${scaled.focusMax} • Heals ${h.healCharges}</div>
        </div>
      </button>
    `;
  }).join("");
}

function openHeroPicker() {
  if (!(els.characterModal instanceof HTMLElement)) return;
  closeMagicMenu();

  pendingHeroId = activeHeroId;
  renderHeroChoices();

  els.characterModal.removeAttribute("hidden");
  heroLastFocus = document.activeElement;
  updateBodyModalOpen();

  setPhase("hero");
  renderIntent(null);
  setEffectBanner("—", "neutral");
  render();

  const first = els.characterModal.querySelector("button[data-hero]");
  if (first instanceof HTMLButtonElement) first.focus();
}

function closeHeroPicker() {
  if (!(els.characterModal instanceof HTMLElement)) return;
  els.characterModal.setAttribute("hidden", "");
  const prev = heroLastFocus;
  heroLastFocus = null;
  updateBodyModalOpen();
  if (prev && prev instanceof HTMLElement) prev.focus();
}

function confirmHeroSelection() {
  const id = pendingHeroId || activeHeroId;
  setActiveHero(id);
  pendingHeroId = null;
  closeHeroPicker();

  closeMagicMenu();
  resetVisuals();
  state = makeLobbyState();
  renderIntent(null);
  setEffectBanner("—", "neutral");
  render();
  openLocationPicker();
}

// --------------------
// Location picker (pre-combat)
// --------------------
let locationLastFocus = null;

function isLocationOpen() {
  return (els.locationModal instanceof HTMLElement) && !els.locationModal.hasAttribute("hidden");
}


function renderLocationChoices() {
  if (!(els.locationChoices instanceof HTMLElement)) return;

  els.locationChoices.innerHTML = LOCATIONS.map((loc) => {
    const set = loc.enemySet.map((i) => ENEMIES[i]);
    const w1 = set[0];
    const w2 = set[1];

    return `
      <button type="button" class="btn ghost rpgLocChoice" data-loc="${loc.id}">
        <div class="rpgLocTitle">${loc.name}</div>
        <div class="muted small">${loc.subtitle}</div>
        <div class="rpgLocMeta muted small">Wave 1: <strong>${w1.name}</strong> <span class="rpgTypeInline">(${formatTypesDisplay(w1.types)})</span></div>
        <div class="rpgLocMeta muted small">Wave 2: <strong>${w2.name}</strong> <span class="rpgTypeInline">(${formatTypesDisplay(w2.types)})</span></div>
      </button>
    `;
  }).join("");
}

function openLocationPicker() {
  if (!(els.locationModal instanceof HTMLElement)) return;
  closeMagicMenu();

  renderLocationChoices();
  els.locationModal.removeAttribute("hidden");
  locationLastFocus = document.activeElement;
  updateBodyModalOpen();

  setPhase("select");
  renderIntent(null);
  setEffectBanner("—", "neutral");
  render();

  // Focus the first choice for keyboard users.
  const first = els.locationModal.querySelector("button[data-loc]");
  if (first instanceof HTMLButtonElement) first.focus();
}

function closeLocationPicker() {
  if (!(els.locationModal instanceof HTMLElement)) return;
  els.locationModal.setAttribute("hidden", "");
  const prev = locationLastFocus;
  locationLastFocus = null;
  updateBodyModalOpen();
  if (prev && prev instanceof HTMLElement) prev.focus();
}

function resetVisuals() {
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
}

function startBattleWithLocation(locId) {
  const loc = setActiveLocation(locId);

  closeMagicMenu();
  closeLocationPicker();

  resetVisuals();

  state = makeInitialState(activeEnemySet, loc.id);
  state.enemy.intent = computeEnemyIntent();
  renderIntent(state.enemy.intent);

  setEffectBanner("—", "neutral");
  setPhase("player");
  render();
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

  /** @typedef {"Wind"|"Water"|"Fire"|"Sight"|"Earth"|"Touch"|"Sound"|"SmellTaste"} MagicType */

  /**
   * Type effectiveness chart: attackType -> defenderType -> multiplier.
   * Dual types multiply.
   * NOTE: Balance is intentionally "obvious" so matchups are readable.
   */
  const TYPE_CHART = /** @type {Record<MagicType, Record<MagicType, number>>} */ ({
Wind: { Wind: 1.0, Water: 1.0, Fire: 0.8, Sight: 1.6, Earth: 0.8, Touch: 1.0, Sound: 1.0, SmellTaste: 1.6 },
Water: { Wind: 1.0, Water: 1.0, Fire: 1.6, Sight: 1.0, Earth: 1.6, Touch: 0.8, Sound: 0.8, SmellTaste: 1.0 },
Fire: { Wind: 1.6, Water: 0.8, Fire: 1.0, Sight: 1.0, Earth: 1.6, Touch: 1.0, Sound: 0.8, SmellTaste: 1.0 },
Sight: { Wind: 0.8, Water: 1.0, Fire: 1.0, Sight: 1.0, Earth: 0.8, Touch: 1.6, Sound: 1.0, SmellTaste: 1.6 },
Earth: { Wind: 1.6, Water: 0.8, Fire: 0.8, Sight: 1.6, Earth: 1.0, Touch: 1.0, Sound: 1.0, SmellTaste: 1.0 },
Touch: { Wind: 1.0, Water: 1.6, Fire: 1.0, Sight: 0.8, Earth: 1.0, Touch: 1.0, Sound: 1.6, SmellTaste: 0.8 },
Sound: { Wind: 1.0, Water: 1.6, Fire: 1.6, Sight: 1.0, Earth: 1.0, Touch: 0.8, Sound: 1.0, SmellTaste: 0.8 },
SmellTaste: { Wind: 0.8, Water: 1.0, Fire: 1.0, Sight: 0.8, Earth: 1.0, Touch: 1.6, Sound: 1.6, SmellTaste: 1.0 },
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

    // Mana cost note (only for magic)
    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = move.baseCost > 0 ? move.baseCost + extra : 0;
    const needs = cost > 0 && state.player.focus < cost;

    const needText = needs ? `Need ${cost} Mana` : (cost > 0 ? `${cost} Mana` : "+1 Mana");
    const meta = move.baseCost > 0 ? needText : "+1 Mana";

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
      els.hintLine.textContent = "Tip: Restart to play again. Use Explain if you want the full rules.";
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const healCost = 1 + extra;
    const hpRatio = state.player.hp / Math.max(1, state.player.max);

    // If low HP, prioritize the healing explanation.
    if (hpRatio <= 0.35 && state.player.healCharges > 0) {
      if (state.player.focus >= healCost) {
        els.hintLine.textContent = `Low HP: Heal now (${healCost} Mana).`;
        return;
      }
      els.hintLine.textContent = `Low HP: Build Mana with Attack/Guard to Heal (need ${healCost}).`;
      return;
    }

    // Otherwise keep the advice generic (no enemy intent / no "best hit" coaching).
    const bindNote = state.player.bound > 0 ? "You are Bound: magic costs +1 Mana. Guard breaks Bind." : "";
    const baseTip = "";
    els.hintLine.textContent = [baseTip, bindNote].filter(Boolean).join(" ");
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
      span.textContent = `${typeIcon(t)} ${TYPE_META[t]?.label ?? t}`;
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
    const waterPrev = computeTypedDamage("player", "enemy", 5, "Water");
    const soundPrev = computeTypedDamage("player", "enemy", 5, "Sound");
    const smellPrev = computeTypedDamage("player", "enemy", 4, "SmellTaste");
    const firePrev = computeTypedDamage("player", "enemy", 6, "Fire");

    appendMatchupRow(els.atkVsEnemyList, { type: "Sight", label: "Attack", mult: atkPrev.overall });
    appendMatchupRow(els.atkVsEnemyList, { type: "Wind", label: "Wind spell", mult: windPrev.overall });
    appendMatchupRow(els.atkVsEnemyList, { type: "Water", label: "Water spell", mult: waterPrev.overall });

    const offSound = !state.player.types.includes("Sound");
    appendMatchupRow(els.atkVsEnemyList, { type: "Sound", label: offSound ? "Sound spell (off-type)" : "Sound spell", mult: soundPrev.overall });

    const offSmell = !state.player.types.includes("SmellTaste");
    appendMatchupRow(els.atkVsEnemyList, { type: "SmellTaste", label: offSmell ? "Smell/Taste spell (off-type)" : "Smell/Taste spell", mult: smellPrev.overall });

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

  /**
   * Render a full type chart as an easy-to-scan grid.
   * Rows = attacker type, columns = defender type.
   */
  function renderTypeMatrix() {
    if (!(els.typeMatrix instanceof HTMLElement)) return;
    if (els.typeMatrix.dataset.ready === "1") return;

    /** @type {MagicType[]} */
    const order = ["Wind", "Water", "Fire", "Earth", "Sight", "Sound", "Touch", "SmellTaste"];

    const table = els.typeMatrix;
    table.innerHTML = "";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const corner = document.createElement("th");
    corner.className = "rpgCorner";
    corner.innerHTML = '<span class="muted tiny">Atk\\Def</span>';
    headRow.appendChild(corner);

    for (const def of order) {
      const th = document.createElement("th");
      th.className = "rpgColHead";
      const chip = document.createElement("span");
      chip.className = `typeInline typeInline--${def}`;
      chip.textContent = `${typeIcon(def)} ${TYPE_META[def]?.label ?? def}`;
      th.appendChild(chip);
      headRow.appendChild(th);
    }

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const atk of order) {
      const tr = document.createElement("tr");

      const rowHead = document.createElement("th");
      rowHead.className = "rpgRowHead";
      const chip = document.createElement("span");
      chip.className = `typeInline typeInline--${atk}`;
      chip.textContent = `${typeIcon(atk)} ${TYPE_META[atk]?.label ?? atk}`;
      rowHead.appendChild(chip);
      tr.appendChild(rowHead);

      for (const def of order) {
        const mult = TYPE_CHART[atk]?.[def] ?? 1;
        const td = document.createElement("td");
        td.className = "rpgTypeCell";

        // Reuse the same thresholds used elsewhere in the UI.
        if (mult >= 1.30) td.classList.add("isStrong");
        else if (mult <= 0.90) td.classList.add("isWeak");
        else td.classList.add("isNeutral");

        td.textContent = `x${fmtMult(mult)}`;
        td.title = `${TYPE_META[atk]?.label ?? atk} → ${TYPE_META[def]?.label ?? def}: x${fmtMult(mult)}`;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    table.dataset.ready = "1";
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

const HERO_STORAGE_KEY = "dragonstone_rpg_hero";

// --------------------
// Leveling + XP (saved per-hero)
// --------------------

const PROGRESS_KEY_PREFIX = "dragonstone_rpg_progress_";

/** @param {any} n @param {number} fallback */
function toSafeInt(n, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}

/** @param {number} level */
function xpToNext(level) {
  const L = Math.max(1, toSafeInt(level, 1));
  const t = L - 1;
  // Smooth curve: early levels are quick, later levels take longer.
  return Math.max(12, Math.round(20 + t * 12 + t * t * 4));
}

/** @param {string} heroId */
function loadHeroProgress(heroId) {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY_PREFIX + heroId);
    if (!raw) return { level: 1, xp: 0 };
    const obj = JSON.parse(raw);
    const level = Math.max(1, toSafeInt(obj?.level, 1));
    const xp = Math.max(0, toSafeInt(obj?.xp, 0));
    return { level, xp };
  } catch (e) {
    return { level: 1, xp: 0 };
  }
}

/** @param {string} heroId @param {{level:number,xp:number}} prog */
function saveHeroProgress(heroId, prog) {
  try {
    window.localStorage.setItem(
      PROGRESS_KEY_PREFIX + heroId,
      JSON.stringify({ level: Math.max(1, toSafeInt(prog.level, 1)), xp: Math.max(0, toSafeInt(prog.xp, 0)) })
    );
  } catch (e) {
    // localStorage may be blocked (private mode). Ignore.
  }
}

/** @param {number} level */
function levelBonuses(level) {
  const L = Math.max(1, toSafeInt(level, 1));
  const t = L - 1;
  return {
    hpBonus: t * 2,
    focusBonus: Math.floor(t / 4),
    powerMult: 1 + t * 0.04,
    healMult: 1 + t * 0.03,
  };
}

/** @param {{maxHp:number, focusMax:number, focusStart:number}} hero @param {number} level */
function applyLevelToHero(hero, level) {
  const b = levelBonuses(level);
  const maxHp = Math.max(1, toSafeInt(hero.maxHp, 18) + b.hpBonus);
  const focusMax = Math.max(1, toSafeInt(hero.focusMax, 6) + b.focusBonus);
  const focusStart = clamp(toSafeInt(hero.focusStart, 2), 0, focusMax);
  return { maxHp, focusMax, focusStart, ...b };
}

/** @type {MagicType[]} */
const __KNOWN_TYPES = ["Wind","Water","Fire","Sight","Earth","Touch","Sound","SmellTaste"];

/** Normalize a type label from site data into the game's MagicType strings. */
function normalizeMagicType(raw) {
  if (!raw) return null;

  const s = String(raw).trim();
  if (!s) return null;

  // Light normalization for common variants.
  const key = s
    .replace(/\+/g, " ")
    .replace(/\s*&\s*/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  const map = {
    "Air": "Wind",
    "Wind": "Wind",
    "Water": "Water",
    "Fire": "Fire",
    "Earth": "Earth",
    "Touch": "Touch",
    "Sight": "Sight",
    "Sound": "Sound",
    "Smell/Taste": "SmellTaste",
    "SmellTaste": "SmellTaste",
    "Smell Taste": "SmellTaste",
    "Smell+Taste": "SmellTaste",
  };

  const mapLower = {
    "air": "Wind",
    "wind": "Wind",
    "water": "Water",
    "fire": "Fire",
    "earth": "Earth",
    "touch": "Touch",
    "sight": "Sight",
    "sound": "Sound",
    "smell/taste": "SmellTaste",
    "smell taste": "SmellTaste",
    "smelltaste": "SmellTaste",
  };

  const normalized = map[key] || mapLower[key.toLowerCase()] || null;
  if (normalized && __KNOWN_TYPES.includes(normalized)) return /** @type {MagicType} */ (normalized);
  return null;
}

/** @param {any} c */
function heroFromCharacterData(c) {
  const rawPrimary = String(c?.school ?? "").trim();
  const rawSecondary = String(c?.element ?? "").trim();

  const t1 = normalizeMagicType(rawPrimary);
  const t2 = normalizeMagicType(rawSecondary);

  /** @type {MagicType[]} */
  const types = [];
  if (t1) types.push(t1);
  if (t2 && t2 !== t1) types.push(t2);

  /** @type {MagicType[]} */
  const safeTypes = (types.length ? types : /** @type {MagicType[]} */ (["Sight"]));

  const hasUnknownSecondary =
    !!rawSecondary &&
    !t2 &&
    rawSecondary.toLowerCase() !== "none" &&
    rawSecondary.toLowerCase() !== "n/a" &&
    rawSecondary.toLowerCase() !== "na";

  const typesLabel =
    safeTypes.map((t) => TYPE_META[t]?.label ?? t).join(" • ") +
    (hasUnknownSecondary ? " • TBD" : "");

  // Mild per-hero tuning (kept close to the old roster).
  const preset = {
    relen: { maxHp: 20, focusStart: 2 },
    axel: { maxHp: 22, focusStart: 2 },
    mira: { maxHp: 21, focusStart: 2 },
    devante: { maxHp: 19, focusStart: 2 },
    elroy: { maxHp: 23, focusStart: 2 },
  }[String(c?.id || "").toLowerCase()] || { maxHp: 20, focusStart: 2 };

  return {
    id: String(c?.id || "hero"),
    name: String(c?.name || "Hero"),
    types: safeTypes,
    typesLabel,
    maxHp: preset.maxHp,
    healCharges: 3,
    focusMax: 6,
    focusStart: preset.focusStart,
    sprite: String(c?.image || "./assets/images/characters/relen.png"),
    blurb: String(c?.summary || c?.hook || "").trim() || "A battle-ready mage.",
  };
}

/** Prefer building the playable roster from the same dataset used by the Characters/Search pages. */
function buildPlayableHeroes() {
  try {
    const db = window.CHARACTERS_DATA?.characters;
    if (!Array.isArray(db)) return null;

    // Use explicit flags first (so you can control who becomes playable).
    const flagged = db.filter((c) => c && c.playable === true);
    const picked = flagged.length ? flagged : db.filter((c) => ["axel","devante","elroy","relen","mira"].includes(String(c?.id || "")));

    if (!picked.length) return null;

    return picked.map(heroFromCharacterData);
  } catch {
    return null;
  }
}

const PLAYABLE_HEROES = buildPlayableHeroes() || [
  // Fallback roster if character data isn't available for any reason.
  {
    id: "relen",
    name: "Relen",
    types: /** @type {MagicType[]} */ (["Wind", "Sight"]),
    maxHp: 20,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
    sprite: "./assets/images/characters/relen.png",
    blurb: "Wind + Sight. A young prodigy with light-built precision.",
  },
  {
    id: "axel",
    name: "Axel",
    types: /** @type {MagicType[]} */ (["Touch", "Earth"]),
    maxHp: 22,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
    sprite: "./assets/images/characters/axel.png",
    blurb: "Touch + Earth. Steel-nerved grip with stone grit.",
  },
  {
    id: "mira",
    name: "Mira",
    types: /** @type {MagicType[]} */ (["SmellTaste", "Fire"]),
    maxHp: 21,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
    sprite: "./assets/images/characters/mira.png",
    blurb: "Smell/Taste + Fire. Sealed record, sharp scent, hotter sparks.",
  },
  {
    id: "devante",
    name: "Devante",
    types: /** @type {MagicType[]} */ (["Water", "Sound"]),
    maxHp: 19,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
    sprite: "./assets/images/characters/devante.png",
    blurb: "Water + Sound. Calm resonance with a tide-tuned pulse.",
  },
];


/** @type {string} */
let activeHeroId = PLAYABLE_HEROES[0].id;

/** Rehydrate the last-picked hero if it's still playable. */
try {
  const saved = localStorage.getItem(HERO_STORAGE_KEY);
  if (saved && PLAYABLE_HEROES.some((h) => h.id === saved)) activeHeroId = saved;
} catch {
  // ignore
}


function getHeroById(id) {
  return PLAYABLE_HEROES.find((h) => h.id === id) || PLAYABLE_HEROES[0];
}

function loadSavedHero() {
  try {
    const saved = window.localStorage.getItem(HERO_STORAGE_KEY);
    if (saved) activeHeroId = getHeroById(saved).id;
  } catch (e) {
    // localStorage may be blocked.
  }
}

function saveHero(id) {
  try { window.localStorage.setItem(HERO_STORAGE_KEY, id); } catch (e) {}
}

function setActiveHero(id) {
  const h = getHeroById(id);
  activeHeroId = h.id;
  saveHero(activeHeroId);
  return h;
}

function getActiveHero() {
  return getHeroById(activeHeroId);
}


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
  {
    name: "Skyline Duelist",
    types: /** @type {MagicType[]} */ (["Wind", "Sight"]),
    maxHp: 24,
    healCharges: 1,
    profile: "windSight",
    sprite: "./assets/images/enemy-green.png",
  },
  {
    name: "Mirrorbind Adept",
    types: /** @type {MagicType[]} */ (["Touch", "Sight"]),
    maxHp: 26,
    healCharges: 1,
    profile: "mirrorTouch",
    sprite: "./assets/images/enemy-red.png",
  },
  {
    name: "Resonance Cantor",
    types: /** @type {MagicType[]} */ (["Sound", "Touch"]),
    maxHp: 25,
    healCharges: 1,
    profile: "soundTouch",
    sprite: "./assets/images/enemy-blue.png",
  },
];

const FALLBACK_LOCATIONS = [
  { id: "ember_plaza", name: "Ember Plaza", subtitle: "Warm stones. Hot tempers.", enemySet: [0, 1] },
  { id: "quartz_library", name: "Quartz Library", subtitle: "Quiet halls. Heavy secrets.", enemySet: [1, 2] },
  { id: "gale_rooftops", name: "Gale Rooftops", subtitle: "Open sky. Unstable footing.", enemySet: [2, 3] },
  { id: "mirror_tunnels", name: "Mirror Tunnels", subtitle: "Dim lights. Echoing steps.", enemySet: [3, 4] },
];

// Locations in-game are sourced from the Map dataset (data/map-locations.js) when available.
// This keeps the RPG in sync with the site's world map.
const GAME_LOCATION_IDS = ["arena", "market-central", "fey-forest", "gutterglass"];
const LOCATION_ENEMY_SETS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
];

function buildLocationsFromMap() {
  const data = window.MAP_LOCATIONS_DATA;
  if (!data || !Array.isArray(data.locations)) return null;

  const byId = new Map(data.locations.map((l) => [l.id, l]));
  const picks = GAME_LOCATION_IDS.map((id) => byId.get(id)).filter(Boolean);

  // If any IDs are missing, fall back to the first few map locations to avoid an empty picker.
  const finalPicks = picks.length ? picks : data.locations.slice(0, GAME_LOCATION_IDS.length);
  if (!finalPicks.length) return null;

  return finalPicks.slice(0, LOCATION_ENEMY_SETS.length).map((l, idx) => ({
    id: l.id,
    name: l.title || l.id,
    subtitle: l.blurb || "",
    href: l.href || "",
    enemySet: LOCATION_ENEMY_SETS[idx] || LOCATION_ENEMY_SETS[0],
  }));
}

const LOCATIONS = buildLocationsFromMap() || FALLBACK_LOCATIONS;

/** @type {string|null} */
let activeLocationId = null;

/** @type {typeof ENEMIES} */
let activeEnemySet = [ENEMIES[0], ENEMIES[1]];

function getLocationById(id) {
  return LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];
}

function setActiveLocation(id) {
  const loc = getLocationById(id);
  activeLocationId = loc.id;
  activeEnemySet = loc.enemySet.map((i) => ENEMIES[i]);
  return loc;
}


  /**
   * Create a fresh enemy state from template.
   * @param {number} waveIndex
   */
  function makeEnemy(waveIndex, enemySet, playerLevel = 1) {
  const set = enemySet || activeEnemySet || ENEMIES;
  const t = set[waveIndex] ?? set[0] ?? ENEMIES[0];

  const lvl = Math.max(1, toSafeInt(playerLevel, 1) + Math.max(0, toSafeInt(waveIndex, 0)));
  // Enemies scale gently with your level so battles stay interesting.
  const hpScale = 1 + (lvl - 1) * 0.06;
  const powScale = 1 + (lvl - 1) * 0.04;
  const scaledMaxHp = Math.max(1, Math.round(toSafeInt(t.maxHp, 18) * hpScale));

  const focusMax = typeof t.focusMax === "number" ? t.focusMax : 6;
  const focusStart = typeof t.focusStart === "number" ? t.focusStart : 2;

  return {
    name: t.name,
    types: t.types,
    level: lvl,
    powerMult: powScale,
    hp: scaledMaxHp,
    max: scaledMaxHp,
    healCharges: t.healCharges,

    // resources (Mana)
    focus: clamp(focusStart, 0, focusMax),
    focusMax: focusMax,

    // statuses
    guarding: false,     // brace (50% next hit)
    ward: 0,             // mirror ward: 40% reduction + reflect
    fortified: 0,        // earth fortify: 30% reduction
    gusted: false,       // next damage -2
    scented: 0,          // next attacks -1 (Smell/Taste)
    burn: 0,             // ticks 2 at start of turn
    enraged: false,

    // AI
    profile: t.profile,
    aiStep: 0,
    intent: null,        // filled at start of player's turn
    sprite: t.sprite,
  };
}

  /** @param {ReturnType<typeof getHeroById>} pt */
  function makePlayerFromHero(pt) {
    const prog = loadHeroProgress(pt.id);
    const scaled = applyLevelToHero(pt, prog.level);
    return {
      id: pt.id,
      name: pt.name,
      types: pt.types,
      sprite: pt.sprite,

      // progression
      level: prog.level,
      xp: prog.xp,
      xpToNext: xpToNext(prog.level),
      powerMult: scaled.powerMult,
      healMult: scaled.healMult,
      baseMaxHp: pt.maxHp,
      baseFocusMax: pt.focusMax,

      // vitals
      hp: scaled.maxHp,
      max: scaled.maxHp,

      // statuses
      guarding: false,
      evading: false,
      burn: 0,
      bound: 0,

      // resources
      healCharges: pt.healCharges,
      focus: scaled.focusStart,
      focusMax: scaled.focusMax,
    };
  }


  function makeInitialState(enemySet = activeEnemySet, locationId = activeLocationId) {
  const set = enemySet || activeEnemySet || [ENEMIES[0], ENEMIES[1]];
  const loc = locationId ? getLocationById(locationId) : null;
  const pt = getActiveHero();
  const player = makePlayerFromHero(pt);

  return {
    turn: 1,
    phase: "player",
    wave: 0,
    locationId: loc ? loc.id : null,
    enemySet: set,
    player,
    enemy: makeEnemy(0, set, player.level),
    over: false,
    log: [
      `Location: ${loc ? loc.name : "—"}.`,
      `Wave 1: ${set[0].name} steps into view.`,
      "Your turn.",
    ],
  };
}

function makeLobbyState() {
  const loc = LOCATIONS[0];
  const set = loc.enemySet.map((i) => ENEMIES[i]);
  const pt = getActiveHero();
  const player = makePlayerFromHero(pt);

  return {
    turn: 1,
    phase: "select",
    wave: 0,
    locationId: null,
    enemySet: set,
    player,
    enemy: makeEnemy(0, set, player.level),
    over: false,
    log: [
      "Choose a hero, then a location to begin.",
      "Your hero changes stats and type bonuses (STAB).",
    ],
  };
}


  const GAME_BUILD = "2026-02-15-type-locked";


  // Load saved hero choice (if any)
  loadSavedHero();

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

  function persistPlayerProgress() {
    const heroId = state?.player?.id || activeHeroId;
    if (!heroId) return;
    saveHeroProgress(heroId, {
      level: Math.max(1, toSafeInt(state.player.level, 1)),
      xp: Math.max(0, toSafeInt(state.player.xp, 0)),
    });
  }

  /** Recompute scaled stats/multipliers for the current level.
   *  @param {boolean} onLevelUp
   */
  function syncPlayerLevel(onLevelUp = false) {
    const hero = getHeroById(state?.player?.id || activeHeroId);
    const lvl = Math.max(1, toSafeInt(state.player.level, 1));
    const scaled = applyLevelToHero(hero, lvl);

    const oldMax = toSafeInt(state.player.max, scaled.maxHp);
    const oldFocusMax = toSafeInt(state.player.focusMax, scaled.focusMax);

    state.player.max = scaled.maxHp;
    state.player.focusMax = scaled.focusMax;
    state.player.powerMult = scaled.powerMult;
    state.player.healMult = scaled.healMult;
    state.player.xpToNext = xpToNext(lvl);
    state.player.baseMaxHp = hero.maxHp;
    state.player.baseFocusMax = hero.focusMax;

    // Preserve current HP/Mana, but allow a small "level-up refresh".
    const gainedMax = state.player.max - oldMax;
    state.player.hp = clamp(toSafeInt(state.player.hp, state.player.max) + gainedMax, 0, state.player.max);
    state.player.focus = clamp(toSafeInt(state.player.focus, 0) + (state.player.focusMax - oldFocusMax), 0, state.player.focusMax);

    if (onLevelUp) {
      state.player.hp = clamp(state.player.hp + 2, 0, state.player.max);
      state.player.focus = clamp(state.player.focus + 1, 0, state.player.focusMax);
    }
  }

  /** @param {any} enemy */
  function xpForEnemy(enemy) {
    const lvl = Math.max(1, toSafeInt(enemy?.level, 1));
    const maxHp = Math.max(1, toSafeInt(enemy?.max, 18));
    // Simple readable reward: tougher enemies give more XP.
    return Math.max(6, Math.round(8 + lvl * 4 + maxHp / 6));
  }

  /** @param {number} amount */
  function gainXp(amount) {
    const add = Math.max(0, toSafeInt(amount, 0));
    if (add <= 0) return;

    state.player.xp = Math.max(0, toSafeInt(state.player.xp, 0) + add);
    addLog(`✨ You gain ${add} XP.`);

    let leveled = false;
    while (state.player.xp >= state.player.xpToNext) {
      state.player.xp -= state.player.xpToNext;
      state.player.level = Math.max(1, toSafeInt(state.player.level, 1) + 1);
      state.player.xpToNext = xpToNext(state.player.level);
      syncPlayerLevel(true);
      leveled = true;
      addLog(`🌟 Level up! You are now Lv ${state.player.level}.`);
    }

    if (leveled) {
      // A little celebration without interrupting flow.
      showMoveBanner("Level Up", "Sight");
    }

    persistPlayerProgress();
  }

  /** @param {number} base */
  function scaledPlayerBase(base) {
    const mult = typeof state.player.powerMult === "number" ? state.player.powerMult : 1;
    return Math.max(1, Math.round(toSafeInt(base, 1) * mult));
  }

  /** @param {number} base */
  function scaledEnemyBase(base) {
    const mult = typeof state.enemy.powerMult === "number" ? state.enemy.powerMult : 1;
    return Math.max(1, Math.round(toSafeInt(base, 1) * mult));
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
    if (!state.over && state.enemy.scented > 0) parts.push(`Scented (${state.enemy.scented})`);
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

  const ENEMY_MANA_COST = {
    // 0-cost moves build Mana
    attack: 0,
    ward: 0,
    fortify: 0,

    // spending moves
    heal: 2,
    arcane: 2,
    glare: 2,
    squall: 2,
    resonant: 2,
    quake: 2,
    shatter: 2,
    mirrorbind: 2,
    stonebind: 2,
    hushbind: 2,
    ignite: 3,
    siphon: 3,
  };

  function enemyManaCost(id) {
    return ENEMY_MANA_COST[id] ?? 0;
  }

  function computeEnemyIntent() {
  const p = state.player;
  const e = state.enemy;

  // Emergency heal if low.
  if (e.hp > 0 && e.hp < e.max && e.healCharges > 0) {
    const ratio = e.hp / e.max;
    if (ratio <= 0.32) return { id: "heal", name: "Heal", type: null, base: 0, note: "Heals for 8" };
  }

  // Profiles (deterministic patterns)
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

  if (e.profile === "windSight") {
    const pattern = ["squall", "lance", "ward", "squall", "attack"];
    const next = pattern[e.aiStep % pattern.length];

    if (next === "squall") return { id: "squall", name: "Squall", type: "Wind", base: 5, note: "" };
    if (next === "lance") return { id: "lance", name: "Arcane Lance", type: "Sight", base: 6, note: "" };
    if (next === "ward") return { id: "ward", name: "Mirror Ward", type: null, base: 0, note: "Next hit reduced + reflects" };
    return { id: "attack", name: "Strike", type: "Sight", base: 4, note: "" };
  }

  if (e.profile === "mirrorTouch") {
    const pattern = ["mirrorbind", "glare", "fortify", "glare", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    // If you're already bound, they pivot to damage.
    if (next === "mirrorbind" && p.bound > 0) next = "glare";

    if (next === "mirrorbind") return { id: "mirrorbind", name: "Mirrorbind", type: "Touch", base: 3, note: "Applies Bind" };
    if (next === "glare") return { id: "glare", name: "Glare", type: "Sight", base: 5, note: "" };
    if (next === "fortify") return { id: "fortify", name: "Fortify", type: null, base: 0, note: "Next hit reduced" };
    return { id: "attack", name: "Strike", type: "Sight", base: 4, note: "" };
  }

  
  if (e.profile === "soundTouch") {
    const pattern = ["hushbind", "resonate", "ward", "resonate", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    if (next === "hushbind" && p.bound > 0) next = "resonate";

    if (next === "hushbind") return { id: "hushbind", name: "Hushbind", type: "Touch", base: 3, note: "Applies Bind" };
    if (next === "resonate") return { id: "resonate", name: "Resonant Blast", type: "Sound", base: 5, note: "" };
    if (next === "ward") return { id: "ward", name: "Mirror Ward", type: null, base: 0, note: "Next hit reduced + reflects" };
    return { id: "attack", name: "Strike", type: "Sight", base: 4, note: "" };
  }

// Default: Earth/Touch pattern.
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
      spawnFx("guard", "enemy");
    }

    // Fortify: 30% reduction
    if (state.enemy.fortified > 0) {
      const before = final;
      final = Math.ceil(final * 0.7);
      state.enemy.fortified = 0;
      addLog(`${state.enemy.name} is fortified (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
    }

    // Brace: 50% reduction
    if (state.enemy.guarding) {
      const before = final;
      final = Math.floor(final / 2);
      state.enemy.guarding = false;
      addLog(`${state.enemy.name} braces (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
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
    if (!unit || unit.burn <= 0) return false;

    const dmg = 2;
    unit.hp = clamp(unit.hp - dmg, 0, unit.max);
    unit.burn = Math.max(0, unit.burn - 1);

    // Show burn as a center-screen "move" so it reads like an event.
    showMoveBanner("Burn", "Fire");

    const label = who === "player" ? "You" : state.enemy.name;
    // Make it visually obvious this is a status tick, not a second attack.
    addLog(`🔥 Burn ticks: ${label} take${who === "player" ? "" : "s"} ${dmg} damage.`);
    if (who === "player") {
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("fire", "player");
      spawnFloat(`-${dmg}`, "player", "dmg", null);
    }
    if (who === "enemy") {
      playAnim(els.enemySprite, "rpgAnim-hit");
      spawnFx("fire", "enemy");
      spawnFloat(`-${dmg}`, "enemy", "dmg", null);
    }

    return true;
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
    const enemyLv = typeof state.enemy.level === "number" ? state.enemy.level : 1;
    setText(els.enemyName, `${state.enemy.name} Lv ${enemyLv} (Wave ${state.wave + 1}/${state.enemySet.length})`);
    setTypeLine(els.playerTypeText, state.player.types);
    setTypeLine(els.enemyTypeText, state.enemy.types);

    // Focus + intent
    if (els.playerFocusText instanceof HTMLElement) {
      els.playerFocusText.textContent = `Mana: ${focus} / ${state.player.focusMax}`;
    }
    // Focus bar (visual) + keep the hover preview accurate as focus changes.
    setBar(els.playerFocusFill, focus / state.player.focusMax);

    // Level + XP
    if (els.playerLevelText instanceof HTMLElement) {
      const lvl = typeof state.player.level === "number" ? state.player.level : 1;
      const xp = typeof state.player.xp === "number" ? state.player.xp : 0;
      const need = typeof state.player.xpToNext === "number" ? state.player.xpToNext : xpToNext(lvl);
      els.playerLevelText.textContent = `Lv ${lvl} • XP ${xp} / ${need}`;
      setBar(els.playerXpFill, need > 0 ? (xp / need) : 0);
    }

    // Enemy Mana
    if (els.enemyFocusText instanceof HTMLElement) {
      const eMana = typeof state.enemy.focus === "number" ? state.enemy.focus : 0;
      const eMax = typeof state.enemy.focusMax === "number" ? state.enemy.focusMax : 6;
      els.enemyFocusText.textContent = `Mana: ${eMana} / ${eMax}`;
      setBar(els.enemyFocusFill, eMax > 0 ? (eMana / eMax) : 0);
    }

    renderIntent(state.enemy.intent);
    // Keep hover preview consistent when you swap heroes (Attack type changes with hero).
    if (previewMove && previewMove.name === "Attack") {
      previewMove.type = playerPrimaryType();
    }
    renderEffectPreview(previewMove);
    renderHint();

    // Sprite swap (wave-based enemies)
    if (els.enemySpriteImg instanceof HTMLImageElement && state.enemy.sprite) {
      if (els.enemySpriteImg.getAttribute("src") !== state.enemy.sprite) {
        els.enemySpriteImg.setAttribute("src", state.enemy.sprite);
      }
      // Enemy art is pixel sprites.
      els.enemySpriteImg.classList.add("isPixel");
    }

    // Player sprite swap (hero selection)
    if (els.playerSpriteImg instanceof HTMLImageElement && state.player.sprite) {
      if (els.playerSpriteImg.getAttribute("src") !== state.player.sprite) {
        els.playerSpriteImg.setAttribute("src", state.player.sprite);
      }

      // Use crisp pixel rendering for pixel sprites, but keep portraits smooth.
      const isPortrait = String(state.player.sprite).includes("/assets/images/characters/") ||
        String(state.player.sprite).includes("./assets/images/characters/");
      els.playerSpriteImg.classList.toggle("isPixel", !isPortrait);
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

    // Full chart (static grid)
    renderTypeMatrix();

    // Button labels show multiplier + cost (so choices are readable)
    const atkType = playerPrimaryType();
    const atkPrev = computeTypedDamage("player", "enemy", 5, atkType);
    const windPrev = computeTypedDamage("player", "enemy", 4, "Wind");
    const waterPrev = computeTypedDamage("player", "enemy", 5, "Water");
    const soundPrev = computeTypedDamage("player", "enemy", 5, "Sound");
    const smellPrev = computeTypedDamage("player", "enemy", 4, "SmellTaste");
    const firePrev = computeTypedDamage("player", "enemy", 6, "Fire");

    if (els.attackBtn instanceof HTMLButtonElement) {
      const atkLabel = TYPE_META[atkType]?.label ?? atkType;
      els.attackBtn.textContent = `Attack (${atkLabel} x${fmtMult(atkPrev.overall)} | +1 Mana)`;
      els.attackBtn.dataset.type = atkType;
    }
    const hasWind = playerHasType("Wind");
    const hasWater = playerHasType("Water");
    const hasSound = playerHasType("Sound");
    const hasSmell = playerHasType("SmellTaste");
    const hasFire = playerHasType("Fire");

    const secondaryType = Array.isArray(state.player.types) && state.player.types.length > 1 ? state.player.types[1] : null;
    const hasSecondaryGeneric = !!secondaryType && !["Wind", "Water", "Sound", "SmellTaste", "Fire"].includes(secondaryType);

    // Only show spells that match your hero's types.
    if (els.windBtn instanceof HTMLButtonElement) {
      els.windBtn.toggleAttribute("hidden", !hasWind);
      els.windBtn.dataset.type = "Wind";
      els.windBtn.textContent = `Wind attack (2 Mana, x${fmtMult(windPrev.overall)})`;
    }
    if (els.waterBtn instanceof HTMLButtonElement) {
      els.waterBtn.toggleAttribute("hidden", !hasWater);
      els.waterBtn.dataset.type = "Water";
      els.waterBtn.textContent = `Water attack (2 Mana, x${fmtMult(waterPrev.overall)})`;
    }
    if (els.soundBtn instanceof HTMLButtonElement) {
      els.soundBtn.toggleAttribute("hidden", !hasSound);
      els.soundBtn.dataset.type = "Sound";
      els.soundBtn.textContent = `Sound attack (2 Mana, x${fmtMult(soundPrev.overall)})`;
    }
    if (els.smellTasteBtn instanceof HTMLButtonElement) {
      els.smellTasteBtn.toggleAttribute("hidden", !hasSmell);
      els.smellTasteBtn.dataset.type = "SmellTaste";
      els.smellTasteBtn.textContent = `Smell/Taste attack (2 Mana, x${fmtMult(smellPrev.overall)})`;
    }
    if (els.fireBtn instanceof HTMLButtonElement) {
      els.fireBtn.toggleAttribute("hidden", !hasFire);
      els.fireBtn.dataset.type = "Fire";
      els.fireBtn.textContent = `Fire attack (3 Mana, x${fmtMult(firePrev.overall)})`;
    }

    // Secondary-type spell (only when your secondary type isn't already one of the dedicated spell buttons).
    if (els.secondaryTypeBtn instanceof HTMLButtonElement) {
      els.secondaryTypeBtn.toggleAttribute("hidden", !hasSecondaryGeneric);
      if (hasSecondaryGeneric && secondaryType) {
        const secPrev = computeTypedDamage("player", "enemy", magicBaseDamage(secondaryType), secondaryType);
        const secLabel = TYPE_META[secondaryType]?.label ?? secondaryType;
        const secCost = magicBaseCost(secondaryType);
        els.secondaryTypeBtn.textContent = `${secLabel} attack (${secCost} Mana, x${fmtMult(secPrev.overall)})`;
        els.secondaryTypeBtn.dataset.type = secondaryType;
      }
    }

    if (els.healBtn instanceof HTMLButtonElement) {
      els.healBtn.textContent = `Heal (${healCost} Mana, ${state.player.healCharges})`;
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
    const isPlayerTurn = !state.over && state.phase === "player";
    const disableActions = !isPlayerTurn;
    if (disableActions) closeMagicMenu();

    const canWind = isPlayerTurn && hasWind && focus >= (2 + boundExtra);
    const canWater = isPlayerTurn && hasWater && focus >= (2 + boundExtra);
    const canSound = isPlayerTurn && hasSound && focus >= (2 + boundExtra);
    const canSmellTaste = isPlayerTurn && hasSmell && focus >= (2 + boundExtra);
    const canFire = isPlayerTurn && hasFire && focus >= (3 + boundExtra);
    const canSecondary = isPlayerTurn && hasSecondaryGeneric && !!secondaryType && focus >= (magicBaseCost(secondaryType) + boundExtra);
    const canHeal = isPlayerTurn && state.player.healCharges > 0 && focus >= healCost;

    if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.disabled = disableActions;
    if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.disabled = disableActions;
    const hasAnySpell = hasWind || hasWater || hasSound || hasSmell || hasFire || hasSecondaryGeneric;
    if (els.magicToggle instanceof HTMLButtonElement) els.magicToggle.disabled = disableActions || !hasAnySpell;
    if (els.windBtn instanceof HTMLButtonElement) els.windBtn.disabled = !canWind;
    if (els.waterBtn instanceof HTMLButtonElement) els.waterBtn.disabled = !canWater;
    if (els.soundBtn instanceof HTMLButtonElement) els.soundBtn.disabled = !canSound;
    if (els.smellTasteBtn instanceof HTMLButtonElement) els.smellTasteBtn.disabled = !canSmellTaste;
    if (els.fireBtn instanceof HTMLButtonElement) els.fireBtn.disabled = !canFire;
    if (els.secondaryTypeBtn instanceof HTMLButtonElement) els.secondaryTypeBtn.disabled = !canSecondary;
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
    if (state.over) return;

    addLog(defeatMessage);
    // Award XP for the defeated enemy (before swapping to the next wave).
    gainXp(xpForEnemy(state.enemy));

    // Play the badge-unlock SFX when you clear Wave 1.
    if (state.wave === 0) playWaveClearSfx();

    playAnim(els.enemySprite, "rpgAnim-faint");

    const nextIndex = state.wave + 1;
    if (nextIndex >= state.enemySet.length) {
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
    state.enemy = makeEnemy(state.wave, state.enemySet, state.player.level);

    addLog(`Wave ${state.wave + 1}: ${state.enemy.name} arrives.`);
    addLog("Your turn.");

    setPhase("player");

    // Set new intent for readability.
    state.enemy.intent = computeEnemyIntent();
    renderIntent(state.enemy.intent);

    setEffectBanner("—", "neutral");
    render();
  }

  // --------------------
  // Turn flow
  // --------------------

  // Turn pacing: slow enough to read, fast enough to feel snappy.
  // NOTE: A short "status window" makes it clearer that burn/bind ticks are not
  // a second enemy attack.
  const TURN_DELAY_MS = prefersReducedMotion ? 120 : 650;      // after you act, before enemy acts
  const BETWEEN_TURN_MS = prefersReducedMotion ? 120 : 520;    // after enemy acts, before your turn begins
  const STATUS_WINDOW_MS = prefersReducedMotion ? 0 : 520;     // show status resolution before "Your turn"

  function setTurnBanner(text, who) {
    if (!(els.turnBanner instanceof HTMLElement)) return;
    els.turnBanner.textContent = text;
    els.turnBanner.classList.toggle("isPlayer", who === "player");
    els.turnBanner.classList.toggle("isEnemy", who === "enemy");
  }

  function setPhase(phase) {
    state.phase = phase;
    const locked = phase !== "player" && !state.over;

    if (els.actionsWrap instanceof HTMLElement) {
      els.actionsWrap.classList.toggle("isLocked", locked);
    }

    // Lock/unlock action controls (Restart stays available).
    const lockBtn = (b, on) => {
      if (b instanceof HTMLButtonElement && b.id !== "restartBtn" && b.id !== "heroBtn") b.disabled = on;
    };
    lockBtn(els.attackBtn, locked);
    lockBtn(els.healBtn, locked);
    lockBtn(els.guardBtn, locked);
    lockBtn(els.magicToggle, locked);
    lockBtn(els.windBtn, locked);
    lockBtn(els.waterBtn, locked);
    lockBtn(els.soundBtn, locked);
    lockBtn(els.smellTasteBtn, locked);
    lockBtn(els.fireBtn, locked);
    lockBtn(els.explainBtn, locked);

    if (locked) closeMagicMenu();

    if (phase === "player") setTurnBanner("Your turn", "player");
    else if (phase === "enemy") setTurnBanner("Enemy turn", "enemy");
    else if (phase === "hero") setTurnBanner("Choose a hero", null);
    else if (phase === "select") setTurnBanner("Choose a location", null);
    else setTurnBanner("Resolving…", "enemy");
  }

  function queueEnemyTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    setPhase("enemy");
    addLog("Enemy turn.");
    render();
    // This tiny pause is the whole point: it visually separates turns.
    window.setTimeout(() => {
      enemyTurn();
    }, TURN_DELAY_MS);
  }

  function queuePlayerTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    // Brief "in-between" phase so the next status tick doesn't look like
    // the enemy attacked twice.
    setPhase("resolving");
    render();
    window.setTimeout(() => {
      beginPlayerTurn();
    }, BETWEEN_TURN_MS);
  }


  function beginPlayerTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    const finishStart = () => {
      // Telegraph the next enemy move now (strategy).
      state.enemy.intent = computeEnemyIntent();
      renderIntent(state.enemy.intent);

      addLog("Your turn.");
      setPhase("player");
      render();
    };

    // Start-of-turn effects on player (shown as a separate mini-phase).
    if (state.player.burn > 0 && STATUS_WINDOW_MS > 0) {
      setPhase("resolving");
      setTurnBanner("Status effects", "player");
      addLog("Status effects resolve.");
      render();
      window.setTimeout(() => {
        tickBurn("player");
        if (state.player.hp <= 0) {
          endGame("The burn finishes you. Game over.");
          return;
        }
        finishStart();
      }, STATUS_WINDOW_MS);
      return;
    }

    tickBurn("player");
    if (state.player.hp <= 0) {
      endGame("The burn finishes you. Game over.");
      return;
    }
    finishStart();
  }

  function enemyTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    // Start-of-turn effects on enemy
    const didBurnTick = tickBurn("enemy");
    if (didBurnTick) render();
    if (state.enemy.hp <= 0) {
      advanceWave(`${state.enemy.name} collapses from lingering flame.`);
      return;
    }

    // If a burn tick happened, give it a brief moment to read before
    // the enemy's action banner appears (otherwise it gets overwritten).
    const continueEnemyTurn = () => {

    // Enrage phase (deterministic)
    if (!state.enemy.enraged && state.enemy.hp <= Math.ceil(state.enemy.max * 0.4)) {
      state.enemy.enraged = true;
      addLog(`${state.enemy.name} hardens their stance (enraged).`);
    }

    const e = state.enemy;
    const p = state.player;

    /** @type {Intent} */
    let intent = e.intent || computeEnemyIntent();

    // Mana gating: if the planned move costs more Mana than the enemy has,
    // the enemy performs a basic Strike to build Mana and tries the same step next turn.
    const plannedCost = enemyManaCost(intent.id);
    const holdStep = plannedCost > 0 && e.focus < plannedCost;
    if (holdStep) {
      intent = { id: "attack", name: "Strike", type: "Sight", base: 4, note: "Builds Mana" };
    }

    // Show the enemy move name in the center (clear turn readability)
    // NOTE: Impact FX for elemental/types should appear on the *target* getting hit,
    // not on the caster. Wind impacts are spawned during damage resolution below,
    // so we intentionally avoid spawning Wind FX here.
    showMoveBanner(intent.name || "Enemy action", /** @type {MagicType} */ (intent.type || "Sight"));


    // Consume the step only if the intended move was executed
    if (!holdStep) e.aiStep += 1;

    // Pay or build Mana
    const cost = enemyManaCost(intent.id);
    if (cost > 0) spendEnemyFocus(cost);
    else gainEnemyFocus(1);

    // Execute intent
    if (intent.id === "heal") {
      const heal = scaledEnemyBase(6);
      const before = e.hp;
      e.hp = clamp(e.hp + heal, 0, e.max);
      const actual = e.hp - before;
      e.healCharges = Math.max(0, e.healCharges - 1);
      addLog(actual > 0 ? `${e.name} mends for ${actual} HP.` : `${e.name} tries to mend, but is already at full HP.`);
      playAnim(els.enemySprite, "rpgAnim-heal");
      spawnFx("heal", "enemy");
      if (actual > 0) spawnFloat(`+${actual}`, "enemy", "heal", null);
      render();
      queuePlayerTurn();
      return;
    }

    if (intent.id === "ward") {
      e.ward = 1;
      addLog(`${e.name} conjures a mirror ward.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
      render();
      queuePlayerTurn();
      return;
    }

    if (intent.id === "fortify") {
      e.fortified = 1;
      addLog(`${e.name} fortifies their stance.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
      render();
      queuePlayerTurn();
      return;
    }

    // Damage moves
    playAnim(els.enemySprite, "rpgAnim-attack");

    // Type FX telegraph (visual, not random)
    if (intent.id === "quake" || intent.id === "shatter") {
      stageShake();
      spawnFx("earthCenter", "center");
    }

    let base = scaledEnemyBase(intent.base + (e.enraged ? 1 : 0));

    // Gusted: deterministic -2 on next hit
    if (e.gusted) {
      base = Math.max(1, base - 2);
      e.gusted = false;
      addLog("A lingering gust throws off their focus (−2 damage).");
    }

    // Scented: deterministic -1 on next attacks
    if (e.scented > 0) {
      base = Math.max(1, base - 1);
      e.scented = Math.max(0, e.scented - 1);
      addLog("A clinging aroma dulls their strike (−1 damage).");
    }

    const moveType = /** @type {MagicType} */ (intent.type || "Sight");
    const typed = computeTypedDamage("enemy", "player", base, moveType);

    // Visual: show the type of what hits you.
    spawnFx(fxKindForType(moveType), "player");

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
    spawnFloat(`-${afterDef}`, "player", "dmg", typed.overall);

    // Apply deterministic status effects
    if (intent.id === "ignite") {
      p.burn = Math.max(p.burn, 2);
      addLog("Flame clings to you (burn).");
    }
    if (intent.id === "stonebind" || intent.id === "mirrorbind" || intent.id === "hushbind") {
  p.bound = 1;
  addLog(
    intent.id === "stonebind"
      ? "Stonebind locks your movement (bind)."
      : intent.id === "hushbind"
        ? "Hushbind seals your motion (bind)."
        : "Mirrorbind locks your movement (bind)."
  );
}
    if (intent.id === "siphon") {
      const heal = 3;
      e.hp = clamp(e.hp + heal, 0, e.max);
      addLog(`${e.name} siphons power and heals for ${heal}.`);
      spawnFx("heal", "enemy");
      spawnFloat(`+${heal}`, "enemy", "heal", null);
    }

    if (p.hp <= 0) {
      endGame("You collapse. Game over.");
      return;
    }

    render();
    queuePlayerTurn();
  }

    if (didBurnTick && STATUS_WINDOW_MS > 0) {
      window.setTimeout(continueEnemyTurn, STATUS_WINDOW_MS);
      return;
    }
    continueEnemyTurn();
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

  function spendEnemyFocus(cost) {
    if (cost <= 0) return;
    state.enemy.focus = clamp(state.enemy.focus - cost, 0, state.enemy.focusMax);
  }

  function gainEnemyFocus(amount) {
    if (amount <= 0) return;
    state.enemy.focus = clamp(state.enemy.focus + amount, 0, state.enemy.focusMax);
  }

  function clearBindIfAny() {
    if (state.player.bound > 0) {
      state.player.bound = 0;
      addLog("You shake off the bind.");
    }
  }

  function playerAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    const atkType = playerPrimaryType();
    showMoveBanner("Attack", atkType);
    playAnim(els.playerSprite, "rpgAnim-attack");

    // Attack: fixed base, generates Mana (scaled by level)
    let base = scaledPlayerBase(5);

    // Bind weakens next move
    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind dulls your strike (−2).");
    }

    const typed = computeTypedDamage("player", "enemy", base, atkType);
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You strike ${state.enemy.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx(fxKindForType(atkType), "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

    // Mirror reflect
    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
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

    render();

    queueEnemyTurn();
  }

  function playerWindAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    if (!playerHasType("Wind")) {
      addLog("Your hero can't use Wind magic.");
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 2 + extra;
    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    showMoveBanner("Wind attack", "Wind");
    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = scaledPlayerBase(4);

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

    spawnFx("wind", "enemy");
    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
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
    // The wind icon FX is reserved for the character being *hit* by a wind attack.
    // Use a neutral defensive shimmer to indicate your self-buff.
    spawnFx("guard", "player");

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    render();

    queueEnemyTurn();
  }

  function playerWaterAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    if (!playerHasType("Water")) {
      addLog("Your hero can't use Water magic.");
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 2 + extra;

    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    showMoveBanner("Water attack", "Water");
    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = scaledPlayerBase(5);

    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind dulls your water lash (−2).");
    }

    const typed = computeTypedDamage("player", "enemy", base, "Water");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You crash water onto ${state.enemy.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx("water", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

    // Mirror reflect (if any ward remained)
    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    // Water utility: douse burns (yours and theirs).
    if (state.enemy.burn > 0) {
      state.enemy.burn = 0;
      addLog("Water douses the flames.");
    }
    if (state.player.burn > 0) {
      state.player.burn = 0;
      addLog("You douse your burn.");
    }

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    render();
    queueEnemyTurn();
  }

  function playerSoundAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    if (!playerHasType("Sound")) {
      addLog("Your hero can't use Sound magic.");
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 2 + extra;

    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    showMoveBanner("Sound attack", "Sound");
    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = scaledPlayerBase(5);

    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind muddies your rhythm (−2).");
    }

    // Resonance disrupts defensive wards and braces before the hit lands.
    const had = state.enemy.ward > 0 || state.enemy.fortified > 0 || state.enemy.guarding;
    state.enemy.ward = 0;
    state.enemy.fortified = 0;
    state.enemy.guarding = false;
    if (had) addLog("Resonance shatters their defenses.");

    const typed = computeTypedDamage("player", "enemy", base, "Sound");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You unleash a sonic burst for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx("sound", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    render();
    queueEnemyTurn();
  }

  
function playerSmellTasteAttack() {
  if (isGameOver()) return;
  if (state.phase !== "player") return;
  closeMagicMenu();

  if (!playerHasType("SmellTaste")) {
    addLog("Your hero can't use Smell/Taste magic.");
    render();
    return;
  }

  const extra = state.player.bound > 0 ? 1 : 0;
  const cost = 2 + extra;

  if (state.player.focus < cost) {
    addLog("Not enough Mana.");
    render();
    return;
  }

  showMoveBanner("Smell/Taste attack", "SmellTaste");
  playAnim(els.playerSprite, "rpgAnim-attack");

  let base = scaledPlayerBase(4);

  if (state.player.bound > 0) {
    base = Math.max(1, base - 2);
    state.player.bound = 0;
    addLog("Bind muddles your senses (−2).");
  }

  const typed = computeTypedDamage("player", "enemy", base, "SmellTaste");
  const def = applyEnemyDefenses(typed.scaled);

  state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
  addLog(`You release an aroma hex for ${def.final} damage.`);
  if (typed.note) addLog(typed.note);
  setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
  playAnim(els.enemySprite, "rpgAnim-hit");
  spawnFx("smell", "enemy");
  spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

  // Mirror reflect (if any ward remained)
  if (def.reflected > 0) {
    state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
    addLog(`Reflected magic nicks you for ${def.reflected}.`);
    playAnim(els.playerSprite, "rpgAnim-hit");
    spawnFx("sight", "player");
    spawnFloat(`-${def.reflected}`, "player", "dmg", null);
    if (state.player.hp <= 0) {
      endGame("Reflected magic drops you. Game over.");
      return;
    }
  }

  // Smell/Taste utility: dampen their next strikes (deterministic).
  state.enemy.scented = Math.max(state.enemy.scented || 0, 2);
  addLog("A clinging scent dulls their next strikes (scented).");

  spendFocus(cost);

  if (state.enemy.hp <= 0) {
    onEnemyDown(`${state.enemy.name} falls.`);
    return;
  }

  render();
  queueEnemyTurn();
}
function playerFireAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    if (!playerHasType("Fire")) {
      addLog("Your hero can't use Fire magic.");
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 3 + extra;
    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    showMoveBanner("Fire attack", "Fire");
    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = scaledPlayerBase(6);

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
    spawnFx("fire", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
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

    render();

    queueEnemyTurn();
  }

  /** @param {MagicType} t */
  function magicBaseCost(t) {
    return t === "Fire" ? 3 : 2;
  }

  /** @param {MagicType} t */
  function magicBaseDamage(t) {
    if (t === "Fire") return 6;
    if (t === "Wind") return 4;
    if (t === "SmellTaste") return 4;
    if (t === "Touch") return 4;
    return 5;
  }

  /**
   * Secondary-type magic attack: only shown for secondary types that don't already
   * have a dedicated spell button (currently Sight/Earth/Touch).
   */
  function playerSecondaryTypeAttack() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    const t = Array.isArray(state.player.types) ? state.player.types[1] : null;
    if (!t) {
      addLog("No secondary type equipped.");
      render();
      return;
    }

    // If a dedicated spell exists, route to it (safety).
    if (t === "Wind") return playerWindAttack();
    if (t === "Water") return playerWaterAttack();
    if (t === "Sound") return playerSoundAttack();
    if (t === "SmellTaste") return playerSmellTasteAttack();
    if (t === "Fire") return playerFireAttack();

    if (!playerHasType(t)) {
      addLog(`Your hero can't use ${TYPE_META[t]?.label ?? t} magic.`);
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = magicBaseCost(t) + extra;
    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    const label = TYPE_META[t]?.label ?? t;
    showMoveBanner(`${label} attack`, t);
    playAnim(els.playerSprite, "rpgAnim-attack");

    let base = scaledPlayerBase(magicBaseDamage(t));
    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind blurs your casting (−2). ");
    }

    const typed = computeTypedDamage("player", "enemy", base, t);
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You channel ${label} magic for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx(fxKindForType(t), "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.overall);

    if (def.reflected > 0) {
      state.player.hp = clamp(state.player.hp - def.reflected, 0, state.player.max);
      addLog(`Reflected magic nicks you for ${def.reflected}.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      spawnFx("sight", "player");
      spawnFloat(`-${def.reflected}`, "player", "dmg", null);
      if (state.player.hp <= 0) {
        endGame("Reflected magic drops you. Game over.");
        return;
      }
    }

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    render();
    queueEnemyTurn();
  }

  function playerHeal() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = 1 + extra;

    if (state.player.healCharges <= 0) {
      addLog("Your healing focus is spent.");
      render();
      return;
    }
    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }    showMoveBanner("Heal", "Touch");
playAnim(els.playerSprite, "rpgAnim-heal");
    spawnFx("heal", "player");

    const healMult = typeof state.player.healMult === "number" ? state.player.healMult : 1;
    const heal = Math.max(1, Math.round(5 * healMult));
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.max);
    const actual = state.player.hp - before;

    if (actual > 0) spawnFloat(`+${actual}`, "player", "heal", null);

    state.player.healCharges = Math.max(0, state.player.healCharges - 1);
    spendFocus(cost);

    // Cleanse one negative (strategy lever)
    if (state.player.burn > 0) {
      state.player.burn = 0;
      addLog("You cleanse the burn.");
    }
    clearBindIfAny();

    addLog(actual > 0 ? `You heal for ${actual} HP.` : "You try to heal, but you're already at full HP.");

    render();

    queueEnemyTurn();
  }

  function playerGuard() {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();

    if (!state.player.guarding) {
      state.player.guarding = true;
      showMoveBanner("Guard", "Wind");
      addLog("You raise your guard (+1 Mana).");
      playAnim(els.playerSprite, "rpgAnim-guard");
      spawnFx("guard", "player");
      gainFocus(1);

      // Guarding breaks bind immediately (a clear decision).
      clearBindIfAny();
    } else {
      addLog("You're already guarding.");
    }

    render();

    queueEnemyTurn();
  }
  function restart() {
    closeMagicMenu();
    closeHeroPicker();
    closeLocationPicker();
    resetVisuals();
    state = makeLobbyState();
    renderIntent(null);
    setEffectBanner("—", "neutral");
    setPhase("select");
    render();
    openLocationPicker();
  }


  // --------------------
  // Wire up events
  // --------------------

  if (els.magicToggle instanceof HTMLButtonElement) {
    els.magicToggle.addEventListener("click", toggleMagicMenu);
  }
  if (els.windBtn instanceof HTMLButtonElement) els.windBtn.addEventListener("click", playerWindAttack);
  if (els.secondaryTypeBtn instanceof HTMLButtonElement) els.secondaryTypeBtn.addEventListener("click", playerSecondaryTypeAttack);
  if (els.waterBtn instanceof HTMLButtonElement) els.waterBtn.addEventListener("click", playerWaterAttack);
  if (els.soundBtn instanceof HTMLButtonElement) els.soundBtn.addEventListener("click", playerSoundAttack);
  if (els.smellTasteBtn instanceof HTMLButtonElement) els.smellTasteBtn.addEventListener("click", playerSmellTasteAttack);
  if (els.fireBtn instanceof HTMLButtonElement) els.fireBtn.addEventListener("click", playerFireAttack);

  if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.addEventListener("click", playerAttack);
  if (els.healBtn instanceof HTMLButtonElement) els.healBtn.addEventListener("click", playerHeal);
  if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.addEventListener("click", playerGuard);
  if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.addEventListener("click", restart);


  if (els.heroBtn instanceof HTMLButtonElement) {
    els.heroBtn.addEventListener("click", () => {
      closeMagicMenu();
      closeLocationPicker();
      resetVisuals();
      state = makeLobbyState();
      renderIntent(null);
      setEffectBanner("—", "neutral");
      render();
      openHeroPicker();
    });
  }

  if (els.characterChoices instanceof HTMLElement) {
    els.characterChoices.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-hero]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const id = btn.getAttribute("data-hero");
      if (!id) return;
      pendingHeroId = id;
      renderHeroChoices();
    });
  }
  if (els.characterOk instanceof HTMLButtonElement) els.characterOk.addEventListener("click", confirmHeroSelection);
  if (els.characterClose instanceof HTMLButtonElement) els.characterClose.addEventListener("click", confirmHeroSelection);

  if (els.resetProgressBtn instanceof HTMLButtonElement) {
    els.resetProgressBtn.addEventListener("click", () => {
      const id = pendingHeroId || activeHeroId;
      if (!id) return;
      const hero = getHeroById(id);
      saveHeroProgress(id, { level: 1, xp: 0 });
      addLog(`Progress reset for ${hero.name}.`);

      if (state?.player?.id === id) {
        state.player.level = 1;
        state.player.xp = 0;
        state.player.xpToNext = xpToNext(1);
        syncPlayerLevel(false);
      }

      renderHeroChoices();
      setEffectBanner("Hero progress reset.", "neutral");
      render();
    });
  }


  if (els.locationChoices instanceof HTMLElement) {
    els.locationChoices.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-loc]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const locId = btn.getAttribute("data-loc");
      if (!locId) return;
      startBattleWithLocation(locId);
    });
  }

  
  // Effectiveness preview (hover/focus shows Extra/Normal/Weak before you click)
  /**
   * @param {HTMLElement|null} btn
   * @param {string | (() => string)} nameOrFn
   * @param {MagicType | (() => MagicType)} typeOrFn
   * @param {number | (() => number)} baseCostOrFn
   */
  const wirePreview = (btn, nameOrFn, typeOrFn, baseCostOrFn) => {
    if (!(btn instanceof HTMLElement)) return;
    const resolveName = () => (typeof nameOrFn === "function" ? nameOrFn() : nameOrFn);
    const resolveType = () => (typeof typeOrFn === "function" ? typeOrFn() : typeOrFn);
    const resolveCost = () => (typeof baseCostOrFn === "function" ? baseCostOrFn() : baseCostOrFn);
    btn.addEventListener("mouseenter", () => setPreviewMove(resolveName(), resolveType(), resolveCost()));
    btn.addEventListener("focus", () => setPreviewMove(resolveName(), resolveType(), resolveCost()));
    // Also update on click, since some users go straight to clicking.
    btn.addEventListener("click", () => setPreviewMove(resolveName(), resolveType(), resolveCost()));
  };
  wirePreview(els.attackBtn, "Attack", () => playerPrimaryType(), 0);
  wirePreview(els.windBtn, "Wind attack", "Wind", 2);
  wirePreview(
    els.secondaryTypeBtn,
    () => {
      const t = Array.isArray(state.player.types) ? state.player.types[1] : null;
      const label = t ? (TYPE_META[t]?.label ?? t) : "Secondary";
      return `${label} attack`;
    },
    () => {
      const t = Array.isArray(state.player.types) ? state.player.types[1] : null;
      return t || playerPrimaryType();
    },
    () => {
      const t = Array.isArray(state.player.types) ? state.player.types[1] : null;
      return t ? magicBaseCost(t) : 2;
    }
  );
  wirePreview(els.waterBtn, "Water attack", "Water", 2);
  wirePreview(els.soundBtn, "Sound attack", "Sound", 2);
  wirePreview(els.smellTasteBtn, "Smell/Taste attack", "SmellTaste", 2);
  wirePreview(els.fireBtn, "Fire attack", "Fire", 3);

// Initialize (hero → location)
  state = makeLobbyState();
  renderIntent(null);
  setEffectBanner("—", "neutral");
  setPhase("hero");
  render();
  openHeroPicker();
}
