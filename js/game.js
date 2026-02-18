/**
 * Tiny Turn RPG
 * Turn-based, single-player battle loop (in-browser).
 *
 * Strategy overhaul:
 * - Three-wave battle (Wave 3 is a boss).
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
    playerEquipText: document.getElementById("playerEquipText"),
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
    inventoryToggle: document.getElementById("inventoryToggle"),
    inventoryItemsShortcut: document.getElementById("inventoryItemsShortcut"),
    inventoryMenu: document.getElementById("inventoryMenu"),
    inventoryItemsPane: document.getElementById("inventoryItemsPane"),
    inventoryGearPane: document.getElementById("inventoryGearPane"),
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

    // Compendium (codex)
    codexBtn: document.getElementById("codexBtn"),
    codexModal: document.getElementById("codexModal"),
    codexClose: document.getElementById("codexClose"),
    codexOk: document.getElementById("codexOk"),
    codexEnemiesCount: document.getElementById("codexEnemiesCount"),
    codexItemsCount: document.getElementById("codexItemsCount"),
    codexGearCount: document.getElementById("codexGearCount"),
    codexEnemies: document.getElementById("codexEnemies"),
    codexItems: document.getElementById("codexItems"),
    codexGear: document.getElementById("codexGear"),

    // Spell picker (level-up)
    spellPickBtn: document.getElementById("spellPickBtn"),
    spellPickModal: document.getElementById("spellPickModal"),
    spellPickChoices: document.getElementById("spellPickChoices"),
    spellPickClose: document.getElementById("spellPickClose"),
    spellPickLater: document.getElementById("spellPickLater"),
    spellPickHint: document.getElementById("spellPickHint"),

    // Location picker (pre-combat)
    locationModal: document.getElementById("locationModal"),
    locationChoices: document.getElementById("locationChoices"),
    overworldHint: document.getElementById("overworldHint"),
    overworldBattleBtn: document.getElementById("overworldBattleBtn"),
    overworldBackBtn: document.getElementById("overworldBackBtn"),
    overworldPos: document.getElementById("overworldPos"),
    owUp: document.getElementById("owUp"),
    owDown: document.getElementById("owDown"),
    owLeft: document.getElementById("owLeft"),
    owRight: document.getElementById("owRight"),

    // Loot / Victory screen (auto after wave clear)
    lootModal: document.getElementById("lootModal"),
    lootTitle: document.getElementById("lootTitle"),
    lootSubtitle: document.getElementById("lootSubtitle"),
    lootLine: document.getElementById("lootLine"),
    lootAutoNote: document.getElementById("lootAutoNote"),

    // Defeat screen (when player HP hits 0)
    defeatModal: document.getElementById("defeatModal"),
    defeatTitle: document.getElementById("defeatTitle"),
    defeatSubtitle: document.getElementById("defeatSubtitle"),
    defeatRestartBtn: document.getElementById("defeatRestartBtn"),

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

  // --------------------
  // Sprite sizing normalizer
  // --------------------
  // Goal: make sprites *look* similarly sized even when:
  // - the image has lots of transparent padding, and/or
  // - the image is landscape in a portrait container (object-fit: contain makes it look short).
  //
  // We compute a per-image scale factor and store it in CSS var --spriteScale on the <img>.
  // The CSS already uses: transform: scale(var(--spriteScale, 1));

  /** @type {Map<string, {ratioW:number, ratioH:number, areaFill:number}>} */
  const SPRITE_BOUNDS_CACHE = new Map();

  /**
   * Compute how "filled" an image appears inside its current box with object-fit: contain.
   * @param {number} boxW
   * @param {number} boxH
   * @param {number} iw
   * @param {number} ih
   * @returns {{heightFill:number, widthFill:number}}
   */
  function containFill(boxW, boxH, iw, ih) {
    if (!(boxW > 0 && boxH > 0 && iw > 0 && ih > 0)) return { heightFill: 0, widthFill: 0 };
    const s = Math.min(boxW / iw, boxH / ih);
    const drawW = iw * s;
    const drawH = ih * s;
    return {
      widthFill: clamp(drawW / boxW, 0.01, 1),
      heightFill: clamp(drawH / boxH, 0.01, 1),
    };
  }

  /**
   * Auto-scale a sprite to reduce perceived size differences.
   *
   * @param {HTMLImageElement} img
   * @param {{ target?: number, min?: number, max?: number, fillH?: number }=} opts
   */
  function autoScaleSprite(img, opts) {
    if (!(img instanceof HTMLImageElement)) return;

    // Target area-fill (helps padding-heavy sprites).
    const target = clamp(Number(opts?.target ?? 0.93), 0.70, 0.98);

    // We generally only scale up. Shrinking tends to make "big" sprites feel worse.
    const minScale = clamp(Number(opts?.min ?? 1.0), 0.70, 1.2);

    // Allow higher max so landscape sprites can actually fill a tall battle box.
    const maxScale = clamp(Number(opts?.max ?? 2.85), 1.0, 3.25);

    // Optional: ensure the *visible sprite* reaches at least this fraction of its box height.
    // This is the key fix for "wide sprites look short" cases.
    const fillH = (typeof opts?.fillH === "number" && isFinite(opts.fillH))
      ? clamp(Number(opts.fillH), 0.55, 0.98)
      : null;

    const src = String(img.currentSrc || img.src || img.getAttribute("src") || "").trim();
    if (!src) return;

    /**
     * Apply scaling using any cached bounds info we have.
     * @param {{ratioW:number, ratioH:number, areaFill:number}|null} meta
     */
    const apply = (meta) => {
      // Important: measure the *container* box, not the image itself.
      // getBoundingClientRect() includes transforms, so measuring the image would create feedback
      // (scale changes the rect, which changes the next computed scale).
      const boxEl = img.parentElement || img;
      const rect = boxEl.getBoundingClientRect ? boxEl.getBoundingClientRect() : img.getBoundingClientRect();
      const boxW = rect?.width || boxEl.clientWidth || 0;
      const boxH = rect?.height || boxEl.clientHeight || 0;
      const iw = img.naturalWidth || 0;
      const ih = img.naturalHeight || 0;

      // 1) Padding compensation (if we have bounds; otherwise assume 1).
      const areaFill = meta?.areaFill ?? 1;
      let scaleArea = target / clamp(areaFill, 0.01, 1);
      if (!isFinite(scaleArea)) scaleArea = 1;

      // 2) Landscape compensation (fillH). Works even without bounds info.
      let scaleHeight = 1;
      if (fillH != null && boxW > 0 && boxH > 0 && iw > 0 && ih > 0) {
        const fill = containFill(boxW, boxH, iw, ih);
        // If we have bounds, multiply by how much of the bitmap is "real" vertically.
        const visH = fill.heightFill * clamp(meta?.ratioH ?? 1, 0.01, 1);
        if (visH > 0) {
          scaleHeight = fillH / visH;
        }
      }

      let scale = Math.max(minScale, 1, scaleArea, scaleHeight);
      scale = clamp(scale, minScale, maxScale);

      // Avoid micro-jitter when values are near 1.
      if (Math.abs(scale - 1) < 0.03) scale = 1;

      img.style.setProperty("--spriteScale", String(Number(scale.toFixed(3))));
    };

    // If we already computed bounds, apply immediately and then again on the next frame
    // (ensures layout is settled for getBoundingClientRect).
    const cached = SPRITE_BOUNDS_CACHE.get(src) || null;
    if (cached) {
      apply(cached);
      requestAnimationFrame(() => apply(cached));
      return;
    }

    // Fallback: apply without bounds first (still fixes landscape sprites),
    // then try to compute bounds for padding compensation.
    apply(null);
    requestAnimationFrame(() => apply(null));

    const run = () => {
      try {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        if (!(nw > 0 && nh > 0)) return;

        // Downscale for analysis to keep this lightweight.
        const maxDim = 256;
        const s = Math.min(1, maxDim / nw, maxDim / nh);
        const cw = Math.max(1, Math.round(nw * s));
        const ch = Math.max(1, Math.round(nh * s));

        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);

        const { data } = ctx.getImageData(0, 0, cw, ch);
        let minX = cw, minY = ch, maxX = -1, maxY = -1;
        const alphaThresh = 10;

        for (let y = 0; y < ch; y++) {
          const row = y * cw * 4;
          for (let x = 0; x < cw; x++) {
            const a = data[row + x * 4 + 3];
            if (a > alphaThresh) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX < 0 || maxY < 0) return;

        const boxW = (maxX - minX + 1);
        const boxH = (maxY - minY + 1);
        const ratioW = clamp(boxW / cw, 0.01, 1);
        const ratioH = clamp(boxH / ch, 0.01, 1);

        // Area-fill metric so wide sprites do not get penalized as harshly.
        const areaFill = clamp(Math.sqrt(ratioW * ratioH), 0.01, 1);

        const meta = { ratioW, ratioH, areaFill };
        SPRITE_BOUNDS_CACHE.set(src, meta);

        apply(meta);
        requestAnimationFrame(() => apply(meta));
      } catch {
        // Bounds compute failed (e.g., rare canvas/CORS issues).
        // Landscape boost still applies from the earlier fallback.
      }
    };

    if (img.complete && img.naturalWidth) run();
    else img.addEventListener("load", run, { once: true });
  }

  function autoScaleSpritesIn(scope) {
    if (!scope) return;
    const imgs = scope.querySelectorAll("img");
    imgs.forEach((im) => {
      if (!(im instanceof HTMLImageElement)) return;

      // RPG battle sprites
      if (im.classList.contains("rpgSpriteImg")) {
        autoScaleSprite(im, { target: 0.93, max: 2.85, fillH: 0.86 });
        return;
      }

      // Compendium sprites
      if (im.classList.contains("rpgCodexSprite")) {
        autoScaleSprite(im, { target: 0.92, max: 2.15, fillH: 0.92 });
        return;
      }

      // Hero picker portraits
      if (im.closest(".rpgCharSprite")) {
        autoScaleSprite(im, { target: 0.92, max: 2.15, fillH: 0.92 });
      }
    });
  }
  // --------------------
  // Overworld (very simple traversable map)
  // Now rendered on top of the same map image used on the Map page.
  // --------------------
  const OVERWORLD = {
    xPct: 46,
    yPct: 52,
    stepPct: 3.5,
    snapRadiusPct: 4.25,
  };

  // Battle locations used by the RPG.
  const OVERWORLD_BATTLE_IDS = ["arena", "market-central", "fey-forest", "gutterglass"];

  const OVERWORLD_LOC_ICONS = {
    "arena": "🏟️",
    "market-central": "🏙️",
    "fey-forest": "🌿",
    "gutterglass": "🪞",
  };

  function getMapLocationData(id) {
    const data = window.MAP_LOCATIONS_DATA;
    if (!data || !Array.isArray(data.locations)) return null;
    return data.locations.find((l) => l && l.id === id) || null;
  }

  function resetOverworld() {
    // Start roughly in the city center.
    OVERWORLD.xPct = 46;
    OVERWORLD.yPct = 52;
  }

  function nearestBattleLocation() {
    let bestId = null;
    let bestDist = Infinity;

    for (const id of OVERWORLD_BATTLE_IDS) {
      const m = getMapLocationData(id);
      if (!m) continue;
      const dx = (OVERWORLD.xPct - toSafeNum(m.leftPct, 0));
      const dy = (OVERWORLD.yPct - toSafeNum(m.topPct, 0));
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    }

    if (bestId && bestDist <= OVERWORLD.snapRadiusPct) return bestId;
    return null;
  }

  function currentLocId() {
    return nearestBattleLocation();
  }

  function getBattleableOverworldLocation() {
    const locId = nearestBattleLocation();
    if (!locId) return null;
    // Only consider it battle-ready if the RPG location picker actually includes it.
    // (Avoids falling back to LOCATIONS[0] when an ID is missing.)
    const loc = (typeof LOCATIONS !== 'undefined' && Array.isArray(LOCATIONS))
      ? (LOCATIONS.find((l) => l && l.id === locId) || null)
      : null;
    return loc;
  }

  function setOwPos(leftPct, topPct) {
    OVERWORLD.xPct = clamp(toSafeNum(leftPct, OVERWORLD.xPct), 0, 100);
    OVERWORLD.yPct = clamp(toSafeNum(topPct, OVERWORLD.yPct), 0, 100);
  }

  function renderOverworldPositions() {
    if (!(els.locationChoices instanceof HTMLElement)) return;
    const playerEl = els.locationChoices.querySelector('.rpgOverworldPlayer');
    if (playerEl instanceof HTMLElement) {
      playerEl.style.left = `${OVERWORLD.xPct}%`;
      playerEl.style.top = `${OVERWORLD.yPct}%`;
    }

    const nearLoc = getBattleableOverworldLocation();
    const nearId = nearLoc ? nearLoc.id : null;
    const pins = els.locationChoices.querySelectorAll('button.rpgOverworldPin[data-ow-loc]');
    pins.forEach((pin) => {
      if (!(pin instanceof HTMLElement)) return;
      const id = pin.getAttribute('data-ow-loc');
      if (!id) return;
      pin.classList.toggle('isNearby', id === nearId);
    });

    if (playerEl instanceof HTMLElement) {
      playerEl.classList.toggle('isNearLocation', !!nearId);
    }
  }

  function updateOverworldUI() {
    const loc = getBattleableOverworldLocation();

    if (els.overworldPos instanceof HTMLElement) {
      els.overworldPos.textContent = `Position: ${OVERWORLD.xPct.toFixed(1)}%, ${OVERWORLD.yPct.toFixed(1)}%`;
    }

    if (els.overworldHint instanceof HTMLElement) {
      els.overworldHint.textContent = loc
        ? `You arrive at ${loc.name}. Press Battle (or Enter).`
        : "You wander the city. No battle marker nearby.";
    }

    if (els.overworldBattleBtn instanceof HTMLButtonElement) {
      // Only show the battle button when you're actually at a battle-ready location.
      // (Otherwise it clutters the UI and implies you can fight anywhere.)
      const actionRow = els.overworldBattleBtn.closest('.rpgOverworldActionRow');
      if (actionRow instanceof HTMLElement) {
        actionRow.toggleAttribute('hidden', !loc);
      }
      els.overworldBattleBtn.toggleAttribute('hidden', !loc);
      els.overworldBattleBtn.disabled = !loc;
      els.overworldBattleBtn.textContent = loc ? `Battle: ${loc.name || loc.id}` : "Battle here";
    }
  }

  function moveOverworld(dx, dy) {
    if (!isLocationOpen()) return;
    const nx = clamp(OVERWORLD.xPct + dx * OVERWORLD.stepPct, 0, 100);
    const ny = clamp(OVERWORLD.yPct + dy * OVERWORLD.stepPct, 0, 100);
    if (nx === OVERWORLD.xPct && ny === OVERWORLD.yPct) return;
    OVERWORLD.xPct = nx;
    OVERWORLD.yPct = ny;
    renderOverworldPositions();
    updateOverworldUI();
  }


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
    // Keep only one dropdown open at a time.
    if (isInventoryOpen()) closeInventoryMenu();
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

  // --------------------
  // Inventory menu helpers (combined Items + Gear)
  // --------------------

  /** @param {"gear"|"items"} which */
  function setInventoryTab(which) {
    if (!(els.inventoryMenu instanceof HTMLElement)) return;
    const tab = which === "items" ? "items" : "gear";
    els.inventoryMenu.dataset.invTab = tab;

    // Panes
    if (els.inventoryGearPane instanceof HTMLElement) {
      els.inventoryGearPane.hidden = tab !== "gear";
    }
    if (els.inventoryItemsPane instanceof HTMLElement) {
      els.inventoryItemsPane.hidden = tab !== "items";
    }

    // Tab buttons
    els.inventoryMenu.querySelectorAll('button[data-inv-tab]').forEach((b) => {
      if (!(b instanceof HTMLButtonElement)) return;
      const t = b.getAttribute('data-inv-tab');
      const active = t === tab;
      b.classList.toggle('isActive', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function isInventoryOpen() {
    return (els.inventoryMenu instanceof HTMLElement) && !els.inventoryMenu.hidden;
  }

  function setInventoryMenuOpen(open) {
    if (els.inventoryMenu instanceof HTMLElement) {
      els.inventoryMenu.hidden = !open;
      if (!open) {
        delete els.inventoryMenu.dataset.invFocus;
      }
    }
    const exp = open ? "true" : "false";
    if (els.inventoryToggle instanceof HTMLButtonElement) {
      els.inventoryToggle.setAttribute("aria-expanded", exp);
    }
    if (els.inventoryItemsShortcut instanceof HTMLButtonElement) {
      els.inventoryItemsShortcut.setAttribute("aria-expanded", exp);
    }
  }

  function flashInvFocus(which) {
    if (!(els.inventoryMenu instanceof HTMLElement)) return;
    if (!which) return;
    els.inventoryMenu.dataset.invFocus = which;
    window.setTimeout(() => {
      if (els.inventoryMenu instanceof HTMLElement) delete els.inventoryMenu.dataset.invFocus;
    }, prefersReducedMotion ? 0 : 900);
  }

  /** @param {"gear"|"items"|null=} focus */
  function openInventoryMenu(focus = null) {
    if (!(els.inventoryMenu instanceof HTMLElement)) return;
    // Keep only one dropdown open at a time.
    if (els.magicMenu instanceof HTMLElement && !els.magicMenu.hidden) closeMagicMenu();
    setInventoryMenuOpen(true);

    const tab = focus === "items" ? "items" : "gear";
    setInventoryTab(tab);

    // Reset scroll + focus first available action.
    if (tab === "items" && (els.inventoryItemsPane instanceof HTMLElement)) {
      els.inventoryItemsPane.scrollTop = 0;
      window.setTimeout(() => {
        const b = els.inventoryItemsPane.querySelector('button:not([disabled])');
        if (b instanceof HTMLButtonElement) b.focus({ preventScroll: true });
      }, 0);
      flashInvFocus("items");
    }
    if (tab === "gear" && (els.inventoryGearPane instanceof HTMLElement)) {
      els.inventoryGearPane.scrollTop = 0;
      window.setTimeout(() => {
        const b = els.inventoryGearPane.querySelector('button:not([disabled])');
        if (b instanceof HTMLButtonElement) b.focus({ preventScroll: true });
      }, 0);
      flashInvFocus("gear");
    }
  }

  function toggleInventoryMenu() {
    if (!(els.inventoryMenu instanceof HTMLElement)) return;
    if (isInventoryOpen()) {
      setInventoryMenuOpen(false);
      return;
    }
    openInventoryMenu("gear");
  }

  function closeInventoryMenu() {
    setInventoryMenuOpen(false);
  }

  // Close inventory menu when clicking outside.
  document.addEventListener("click", (e) => {
    if (!(els.inventoryMenu instanceof HTMLElement)) return;

    const toggles = [els.inventoryToggle, els.inventoryItemsShortcut].filter((x) => x instanceof HTMLElement);
    if (toggles.length === 0) return;

    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    const t = e.target;

    const inMenu = (Array.isArray(path) && path.includes(els.inventoryMenu)) || (t instanceof Node && els.inventoryMenu.contains(t));
    const inToggle = toggles.some((el) => (Array.isArray(path) && path.includes(el)) || (t instanceof Node && el.contains(t)));
    if (!inMenu && !inToggle) closeInventoryMenu();
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

// --------------------
// Spells (unlock on level-up)
// --------------------

/**
 * @typedef {Object} Spell
 * @property {string} id
 * @property {string} name
 * @property {MagicType} type
 * @property {number} unlock   // level requirement
 * @property {number} baseCost // Mana (before Bind +1)
 * @property {number} baseDamage
 * @property {string[]} [hooksBefore]
 * @property {string[]} [hooksAfter]
 * @property {number} [piercePct]   // 0..1, reduces the effectiveness of enemy defenses
 * @property {boolean} [noReflect]  // ward reflects 0 if true
 */

/** @type {Spell[]} */
const SPELLBOOK = [
  // Wind
  { id: "wind_gust", name: "Gust", type: "Wind", unlock: 1, baseCost: 2, baseDamage: 4, hooksAfter: ["gusted", "evade"] },
  { id: "wind_razor", name: "Razorwind", type: "Wind", unlock: 3, baseCost: 2, baseDamage: 5, hooksAfter: ["gusted"] },
  { id: "wind_slip", name: "Slipstream", type: "Wind", unlock: 6, baseCost: 2, baseDamage: 3, hooksAfter: ["evade", "mana+1"] },

  // Water
  { id: "water_lash", name: "Tidal Lash", type: "Water", unlock: 1, baseCost: 2, baseDamage: 5, hooksAfter: ["douse"] },
  { id: "water_rain", name: "Soothing Rain", type: "Water", unlock: 3, baseCost: 2, baseDamage: 3, hooksAfter: ["heal+2", "douse"] },
  { id: "water_undertow", name: "Undertow", type: "Water", unlock: 6, baseCost: 3, baseDamage: 6, hooksAfter: ["douse", "drainEnemyMana+1"] },

  // Fire
  { id: "fire_ignite", name: "Ignite", type: "Fire", unlock: 1, baseCost: 3, baseDamage: 6, hooksAfter: ["burn2"] },
  { id: "fire_cinder", name: "Cinder Shot", type: "Fire", unlock: 3, baseCost: 2, baseDamage: 4, hooksAfter: ["burn1"] },
  { id: "fire_inferno", name: "Inferno Spiral", type: "Fire", unlock: 6, baseCost: 4, baseDamage: 8, hooksAfter: ["burn2"] },

  // Sound
  { id: "sound_burst", name: "Resonant Burst", type: "Sound", unlock: 1, baseCost: 2, baseDamage: 5, hooksBefore: ["breakDefenses"] },
  { id: "sound_disson", name: "Dissonance", type: "Sound", unlock: 3, baseCost: 2, baseDamage: 4, hooksBefore: ["breakDefenses"], hooksAfter: ["drainEnemyMana+1"] },
  { id: "sound_cresc", name: "Crescendo", type: "Sound", unlock: 6, baseCost: 3, baseDamage: 7, hooksBefore: ["breakDefenses"] },

  // Smell/Taste
  { id: "smell_hex", name: "Aroma Hex", type: "SmellTaste", unlock: 1, baseCost: 2, baseDamage: 4, hooksAfter: ["scent2"] },
  { id: "smell_bloom", name: "Bitter Bloom", type: "SmellTaste", unlock: 3, baseCost: 2, baseDamage: 5, hooksAfter: ["scent3"] },
  { id: "smell_savor", name: "Savor Siphon", type: "SmellTaste", unlock: 6, baseCost: 3, baseDamage: 6, hooksAfter: ["scent2", "heal+3"] },

  // Sight
  { id: "sight_lance", name: "Arcane Lance", type: "Sight", unlock: 1, baseCost: 2, baseDamage: 5, noReflect: true },
  { id: "sight_glare", name: "Piercing Glare", type: "Sight", unlock: 3, baseCost: 2, baseDamage: 4, piercePct: 0.45 },
  { id: "sight_prism", name: "Prism Ray", type: "Sight", unlock: 6, baseCost: 3, baseDamage: 7, piercePct: 0.6, noReflect: true },

  // Earth
  { id: "earth_quake", name: "Quake", type: "Earth", unlock: 1, baseCost: 2, baseDamage: 5, piercePct: 0.35 },
  { id: "earth_shatter", name: "Shatterstone", type: "Earth", unlock: 3, baseCost: 3, baseDamage: 6, piercePct: 0.6 },
  { id: "earth_spikes", name: "Crystal Spikes", type: "Earth", unlock: 6, baseCost: 3, baseDamage: 7, piercePct: 0.25 },

  // Touch
  { id: "touch_grasp", name: "Grasp", type: "Touch", unlock: 1, baseCost: 2, baseDamage: 4, hooksAfter: ["drainEnemyMana+1"] },
  { id: "touch_press", name: "Pressure Point", type: "Touch", unlock: 3, baseCost: 2, baseDamage: 5, piercePct: 0.35 },
  { id: "touch_surge", name: "Vital Surge", type: "Touch", unlock: 6, baseCost: 3, baseDamage: 4, hooksAfter: ["heal+4"] },
];

/** @type {Record<string, Spell>} */
const SPELLS_BY_ID = Object.fromEntries(SPELLBOOK.map((s) => [s.id, s]));

/**
 * Compute spells known for a hero at a given level.
 * @param {MagicType[]} types
 * @param {number} level
 */
function knownSpellIdsFor(types, level) {
  const L = Math.max(1, toSafeInt(level, 1));
  const has = new Set(types || []);
  return SPELLBOOK
    .filter((s) => has.has(s.type) && L >= s.unlock)
    .sort((a, b) => (a.unlock - b.unlock) || (a.type.localeCompare(b.type)) || (a.baseCost - b.baseCost))
    .map((s) => s.id);
}

/** @param {MagicType[]} types */
function startingSpellIdsFor(types) {
  const has = new Set(types || []);
  return SPELLBOOK.filter((s) => has.has(s.type) && s.unlock === 1).map((s) => s.id);
}

/**
 * Sanitize spell ids to those valid for hero (types) and unlocked by level.
 * @param {string[]} ids
 * @param {MagicType[]} types
 * @param {number} level
 * @returns {string[]}
 */
function sanitizeKnownSpellIds(ids, types, level) {
  const L = Math.max(1, toSafeInt(level, 1));
  const hasType = new Set(types || []);
  const out = [];
  const seen = new Set();
  for (const id of Array.isArray(ids) ? ids : []) {
    if (seen.has(id)) continue;
    const sp = SPELLS_BY_ID[id];
    if (!sp) continue;
    if (!hasType.has(sp.type)) continue;
    if (L < toSafeInt(sp.unlock, 1)) continue;
    seen.add(id);
    out.push(id);
  }
  // Keep the menu stable/readable.
  out.sort((a, b) => {
    const A = SPELLS_BY_ID[a];
    const B = SPELLS_BY_ID[b];
    if (!A || !B) return 0;
    return (toSafeInt(A.unlock, 1) - toSafeInt(B.unlock, 1))
      || String(A.type).localeCompare(String(B.type))
      || (toSafeInt(A.baseCost, 0) - toSafeInt(B.baseCost, 0))
      || String(A.name).localeCompare(String(B.name));
  });
  return out;
}

/**
 * Compute pending spell-pick pools (one pool per unlock level > 1).
 * A pool is "resolved" when the player learns ANY spell from that unlock level.
 * @param {MagicType[]} types
 * @param {number} level
 * @param {string[]} learnedIds
 * @returns {string[][]}
 */
function computePendingSpellPools(types, level, learnedIds) {
  const L = Math.max(1, toSafeInt(level, 1));
  const hasType = new Set(types || []);
  const learned = new Set(Array.isArray(learnedIds) ? learnedIds : []);
  const unlockLevels = Array.from(
    new Set(
      SPELLBOOK
        .filter((s) => hasType.has(s.type) && toSafeInt(s.unlock, 1) > 1 && toSafeInt(s.unlock, 1) <= L)
        .map((s) => toSafeInt(s.unlock, 1))
    )
  ).sort((a, b) => a - b);

  const pools = [];
  for (const u of unlockLevels) {
    const pool = SPELLBOOK
      .filter((s) => hasType.has(s.type) && toSafeInt(s.unlock, 1) === u)
      .map((s) => s.id);

    if (!pool.length) continue;

    const resolved = pool.some((id) => learned.has(id));
    if (!resolved) pools.push(pool);
  }
  return pools;
}

/**
 * Sync the player's spell list without auto-learning level-up spells.
 * - Ensures starting spells (unlock 1) are present.
 * - Recomputes pending spell choices (one choice per unlock level).
 * Returns {addedBase, pendingAdded}.
 * @param {boolean} announce
 */
function syncKnownSpells(announce = false) {
  const types = Array.isArray(state?.player?.types) ? state.player.types : [];
  const lvl = Math.max(1, toSafeInt(state?.player?.level, 1));

  const before = Array.isArray(state?.player?.spells) ? state.player.spells : [];
  const beforePending = Array.isArray(state?.player?.pendingSpellQueue) ? state.player.pendingSpellQueue.length : 0;

  let ids = sanitizeKnownSpellIds(before, types, lvl);

  // Always keep the "core" (unlock 1) spells for your types.
  const base = startingSpellIdsFor(types);
  const addedBase = [];
  base.forEach((id) => {
    if (!ids.includes(id) && SPELLS_BY_ID[id]) {
      ids.push(id);
      addedBase.push(id);
    }
  });

  ids = sanitizeKnownSpellIds(ids, types, lvl);
  state.player.spells = ids;

  const pending = computePendingSpellPools(types, lvl, ids);
  state.player.pendingSpellQueue = pending;

  updateSpellPickButtonUI();

  const pendingAdded = Math.max(0, pending.length - beforePending);

  if (announce) {
    // Don't spam on initial load. This is mainly used on level-up.
    if (pendingAdded > 0) {
      addLog("📜 New spell choice available! Click “Choose spell” to learn one.");
    }
  }

  return { addedBase, pendingAdded };
}

/** @returns {Spell[]} */
function getKnownSpells() {
  const ids = Array.isArray(state?.player?.spells) ? state.player.spells : [];
  return ids.map((id) => SPELLS_BY_ID[id]).filter(Boolean);
}

/**
 * Render the dynamic spell list inside the Magic menu.
 * @param {Spell[]} spells
 * @param {boolean} isPlayerTurn
 * @param {number} focus
 * @param {number} boundExtra
 */
function renderSpellMenu(spells, isPlayerTurn, focus, boundExtra) {
  if (!(els.magicMenu instanceof HTMLElement)) return;
  els.magicMenu.replaceChildren();

  if (!Array.isArray(spells) || spells.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rpgMagicEmpty";
    empty.textContent = "No spells yet.";
    els.magicMenu.appendChild(empty);
    return;
  }

  spells.forEach((spell) => {
    const typed = computeTypedDamage("player", "enemy", spell.baseDamage, spell.type);
    const cost = Math.max(0, toSafeInt(spell.baseCost, 0) + boundExtra);

    // Surface extra spell properties in the menu label (e.g., pierce, no-reflect, burns, etc.)
    // We avoid the default filler text to keep the menu readable.
    const extra = (() => {
      const s = spellHookSummary(spell);
      if (!s || s === "A direct damage spell.") return "";
      return s;
    })();

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary rpgMagicItem";
    btn.setAttribute("role", "menuitem");
    btn.dataset.spellId = spell.id;
    btn.dataset.type = spell.type;

    // Show the spell type icon next to the spell name in the menu.
    // Details (cost, effectiveness, extra effects) are surfaced via tooltip + hover/focus preview line.
    const iconSpan = document.createElement("span");
    iconSpan.className = "btnTypeIcon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.textContent = typeIcon(spell.type);

    const textSpan = document.createElement("span");
    textSpan.className = "btnTypeText";
    textSpan.textContent = spell.name;

    btn.replaceChildren(iconSpan, textSpan);

    const tipBits = [];
    tipBits.push(String(cost) + " Mana");
    tipBits.push("x" + fmtMult(typed.eff));
    if (extra) tipBits.push(extra);
    btn.title = tipBits.join(" • ");
    btn.disabled = !isPlayerTurn || focus < cost;
    els.magicMenu.appendChild(btn);
  });
}

// --------------------
// Items UI (simple)
// --------------------

/** @param {string} itemId */
function itemCanUse(itemId) {
  if (!state || !state.player || !state.enemy) return false;

  if (itemId === "potion") return state.player.hp < state.player.max;
  if (itemId === "ether") return state.player.focus < state.player.focusMax;
  if (itemId === "cleanse") return (state.player.burn > 0) || (state.player.bound > 0);

  // Offense / tactics
  if (itemId === "bomb") return state.enemy.hp > 0;
  if (itemId === "ember") return state.enemy.hp > 0 && (state.enemy.burn ?? 0) < 2;
  if (itemId === "stun") return state.enemy.hp > 0 && (state.enemy.stunned ?? 0) <= 0;

  // Setups (best used before your action)
  if (itemId === "rune") return state.enemy.hp > 0 && !(state.player.damageBoost > 1);
  if (itemId === "barrier") return !(state.player.barrier > 0);

  return false;
}

/**
 * Render the Items pane inside Inventory.
 * @param {boolean} isPlayerTurn
 * @param {HTMLElement=} container
 */
function renderItemMenu(isPlayerTurn, container = els.inventoryItemsPane) {
  if (!(container instanceof HTMLElement)) return;
  container.replaceChildren();

  const usedThisTurn = !!(state?.player?.itemUsedThisTurn);

  const tip = document.createElement("div");
  tip.className = "rpgMagicEmpty";
  tip.textContent = usedThisTurn ? "One-use items. (Used 1 item this turn.)" : "One-use items. You can use 1 item per turn without ending your turn.";
  container.appendChild(tip);

  const inv = state?.player?.items && typeof state.player.items === "object" ? state.player.items : {};
  const rows = ITEM_IDS
    .map((id) => ({ id, count: Math.max(0, toSafeInt(inv[id], 0)) }))
    .filter((r) => r.count > 0);

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rpgMagicEmpty";
    empty.textContent = "No items.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "rpgInvItemsList";
  container.appendChild(list);

  rows.forEach(({ id, count }) => {
    const def = ITEM_DEFS[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost rpgInvItemRow";
    btn.setAttribute("role", "menuitem");
    btn.dataset.itemId = id;

    const label = def ? `${def.icon} ${def.name}` : id;
    const desc = def?.desc ? String(def.desc) : "";

    const main = document.createElement("span");
    main.className = "rpgInvItemMain";

    const name = document.createElement("span");
    name.className = "rpgInvItemName";
    name.textContent = label;
    main.appendChild(name);

    const meta = document.createElement("span");
    meta.className = "rpgInvItemMeta";

    const countPill = document.createElement("span");
    countPill.className = "rpgInvCountPill";
    countPill.textContent = `x${count}`;
    meta.appendChild(countPill);

    const pill = document.createElement("span");
    const rarKey = def?.rarity ? def.rarity : "common";
    pill.className = `rpgRarityPill rarity--${rarKey}`;
    pill.textContent = def?.rarity ? rarityLabel(def.rarity) : "Common";
    meta.appendChild(pill);

    const sub = document.createElement("div");
    sub.className = "rpgInvItemSub";
    sub.textContent = desc;

    btn.appendChild(main);
    btn.appendChild(meta);
    if (desc) btn.appendChild(sub);

    const usable = itemCanUse(id);
    const usableNow = usable && !usedThisTurn;
    btn.disabled = !isPlayerTurn || !usableNow;
    list.appendChild(btn);
  });
}


// --------------------
// Gear UI (equipment slots)
// --------------------

/**
 * Render the Gear pane inside Inventory.
 * @param {boolean} isPlayerTurn
 * @param {HTMLElement=} container
 */
function renderGearMenu(isPlayerTurn, container = els.inventoryGearPane) {
  if (!(container instanceof HTMLElement)) return;
  if (!state?.player) return;

  container.replaceChildren();

  // Keep player gear state sanitized.
  state.player.gear = sanitizeGearCounts(state.player.gear);
  state.player.equipSlots = sanitizeEquipSlots(state.player.equipSlots ?? state.player.equip, state.player.gear);

  const canChange = !!isPlayerTurn && state.phase === "player" && !isGameOver();


  const wrap = document.createElement("div");
  wrap.className = "rpgGearMenuWrap";
  container.appendChild(wrap);

  // Slots
  const slotsGrid = document.createElement("div");
  slotsGrid.className = "rpgGearSlots";
  wrap.appendChild(slotsGrid);

  const slots = state.player.equipSlots;

  const mkGearName = (id) => {
    const g = id && GEAR_DEFS[id] ? GEAR_DEFS[id] : null;
    return g ? `${g.icon} ${g.name}` : "—";
  };

  const highlight = (el, on) => {
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle("rpgDropHover", !!on);
  };

  const onDropEquip = (e, slot) => {
    if (!canChange) return;
    e.preventDefault();
    const id = e.dataTransfer?.getData("text/gear") || e.dataTransfer?.getData("text/plain") || "";
    const gearId = String(id || "").trim();
    if (!gearId) return;
    playerEquipGear(gearId, slot);
  };

  const onDragStartFromSlot = (e, slot, gearId) => {
    try {
      e.dataTransfer?.setData("text/plain", gearId);
      e.dataTransfer?.setData("text/gear", gearId);
      e.dataTransfer?.setData("text/gearFromSlot", slot);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    } catch { /* ignore */ }
  };

  // Drop onto inventory to unequip
  const inventoryDropZone = document.createElement("div");
  inventoryDropZone.className = "rpgGearInventoryDrop";
  inventoryDropZone.textContent = "Drop here to unequip";
  inventoryDropZone.setAttribute("aria-hidden", canChange ? "false" : "true");
  if (canChange) {
    inventoryDropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      highlight(inventoryDropZone, true);
    });
    inventoryDropZone.addEventListener("dragleave", () => highlight(inventoryDropZone, false));
    inventoryDropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      highlight(inventoryDropZone, false);
      const fromSlot = e.dataTransfer?.getData("text/gearFromSlot") || "";
      if (!fromSlot) return;
      playerUnequipGear(/** @type {"weapon"|"armor"|"trinket"} */ (fromSlot));
    });
  }

  for (const slot of EQUIP_SLOTS) {
    const curId = slots?.[slot] || null;

    const card = document.createElement("div");
    card.className = "rpgGearSlotCard";
    card.setAttribute("data-gear-slot", slot);

    // Rarity tint (visual quick-read)
    const curDefForTint = curId && GEAR_DEFS[curId] ? GEAR_DEFS[curId] : null;
    if (curDefForTint && curDefForTint.rarity) card.dataset.rarity = curDefForTint.rarity;
    slotsGrid.appendChild(card);

    const head = document.createElement("div");
    head.className = "rpgGearSlotHead";
    card.appendChild(head);

    const label = document.createElement("span");
    label.className = "rpgGearSlotLabel";
    label.textContent = EQUIP_SLOT_LABEL[slot];
    head.appendChild(label);


    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "btn ghost rpgGearSlotDrop";
    drop.dataset.gearSlot = slot;
    drop.disabled = !canChange;
    drop.textContent = mkGearName(curId);
    drop.title = canChange ? "Drop gear here to equip" : "You can change gear on your turn.";
    card.appendChild(drop);

    // Drag from slot (to unequip via inventory drop zone)
    drop.draggable = !!canChange && !!curId;
    if (canChange && curId) {
      drop.addEventListener("dragstart", (e) => onDragStartFromSlot(e, slot, curId));
    }

    // Drop onto slot to equip
    if (canChange) {
      drop.addEventListener("dragover", (e) => {
        e.preventDefault();
        highlight(drop, true);
      });
      drop.addEventListener("dragleave", () => highlight(drop, false));
      drop.addEventListener("drop", (e) => {
        highlight(drop, false);
        onDropEquip(e, slot);
      });
    }
  }

  wrap.appendChild(inventoryDropZone);

  // Inventory
  const invWrap = document.createElement("div");
  invWrap.className = "rpgGearInvWrap";
  wrap.appendChild(invWrap);

  const invTitle = document.createElement("div");
  invTitle.className = "rpgGearInvTitle";
  invTitle.textContent = "Owned gear";
  invWrap.appendChild(invTitle);

  const inv = state.player.gear && typeof state.player.gear === "object" ? state.player.gear : {};

  // Sort by slot, then name.
  const ownedIds = Object.keys(inv)
    .filter((id) => GEAR_DEFS[id] && Math.max(0, toSafeInt(inv[id], 0)) > 0)
    .sort((a, b) => {
      const A = GEAR_DEFS[a], B = GEAR_DEFS[b];
      if (!A || !B) return 0;
      if (A.slot !== B.slot) {
        const order = { weapon: 0, armor: 1, trinket: 2 };
        return (order[A.slot] ?? 99) - (order[B.slot] ?? 99);
      }
      // Higher rarity first within a slot
      const ra = rarityRank(A.rarity);
      const rb = rarityRank(B.rarity);
      if (ra !== rb) return rb - ra;
      return A.name.localeCompare(B.name);
    });

  if (!ownedIds.length) {
    const empty = document.createElement("div");
    empty.className = "rpgMagicEmpty";
    empty.textContent = "No gear yet. Win battles to find some.";
    invWrap.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "rpgGearInvList";
  invWrap.appendChild(list);

  ownedIds.forEach((id) => {
    const def = GEAR_DEFS[id];
    const have = Math.max(0, toSafeInt(inv[id], 0));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost rpgGearInvItem";
    btn.dataset.gearId = id;
    btn.dataset.gearAction = "equip";
    btn.disabled = !canChange;

    // Drag from inventory
    btn.draggable = !!canChange;
    if (canChange) {
      btn.addEventListener("dragstart", (e) => {
        try {
          e.dataTransfer?.setData("text/plain", id);
          e.dataTransfer?.setData("text/gear", id);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
        } catch { /* ignore */ }
      });
    }

    const slotPill = document.createElement("span");
    slotPill.className = "rpgGearSlotPill";
    slotPill.textContent = EQUIP_SLOT_LABEL[def.slot];
    btn.appendChild(slotPill);

    const main = document.createElement("span");
    main.className = "rpgGearInvMain";

    const nm = document.createElement("span");
    nm.className = "rpgGearInvName";
    nm.textContent = `${def.icon} ${def.name}`;
    // Help with long names (hover to see the full text).
    nm.title = def.name;
    main.appendChild(nm);

    // Put rarity on the main row so it doesn't steal space from the description.
    const rp = document.createElement("span");
    rp.className = `rpgRarityPill rpgGearInvRarity rarity--${(def.rarity || "common")}`;
    rp.textContent = rarityLabel(def.rarity || "common");
    main.appendChild(rp);

    btn.appendChild(main);

    // Compact meta row: count + (clamped) description.
    const sub = document.createElement("span");
    sub.className = "rpgGearInvSub";

    const countPill = document.createElement("span");
    countPill.className = "rpgInvCountPill";
    countPill.textContent = `x${have}`;
    sub.appendChild(countPill);

    if (def.desc) {
      const desc = document.createElement("span");
      desc.className = "rpgGearInvDesc";
      desc.textContent = String(def.desc);
      desc.title = String(def.desc);
      sub.appendChild(desc);
    }

    btn.appendChild(sub);

    // Full details on hover.
    btn.title = `${def.name} (${rarityLabel(def.rarity || "common")})${def.desc ? `\n${def.desc}` : ""}`.trim();

    // Mark as equipped in its slot
    const isEq = slots?.[def.slot] === id;
    if (isEq) btn.classList.add("isEquipped");

    list.appendChild(btn);
  });
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
      if (isSpellPickOpen()) closeSpellPicker();
      if (isExplainOpen()) closeExplain();
      if (isCodexOpen()) closeCodex();
      if (isHeroOpen()) closeHeroPicker();
      if (isLocationOpen()) closeLocationPicker();
      closeMagicMenu();
      closeInventoryMenu();
      if (isLootOpen()) { closeLootScreen(); if (lootTimer) window.clearTimeout(lootTimer); lootTimer = 0; }
      if (isDefeatOpen()) closeDefeatScreen();
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
  closeInventoryMenu();
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




  // --------------------
  // Codex / Compendium modal helpers
  // --------------------

  let codexLastFocus = null;

  function isCodexOpen() {
    return (els.codexModal instanceof HTMLElement) && !els.codexModal.hasAttribute("hidden");
  }

  function openCodex() {
    if (!(els.codexModal instanceof HTMLElement)) return;
    closeMagicMenu();
    closeInventoryMenu();
    // Build/update the lists on open so they stay in sync with defs.
    renderCodex();
    els.codexModal.removeAttribute("hidden");
    codexLastFocus = document.activeElement;
    updateBodyModalOpen();
    if (els.codexClose instanceof HTMLButtonElement) els.codexClose.focus();
  }

  function closeCodex() {
    if (!(els.codexModal instanceof HTMLElement)) return;
    els.codexModal.setAttribute("hidden", "");
    const prev = codexLastFocus;
    codexLastFocus = null;
    updateBodyModalOpen();
    if (prev && prev instanceof HTMLElement) prev.focus();
  }

// --------------------
// Spell picker modal helpers
// --------------------

let __spellPickLastFocus = null;

function isSpellPickOpen() {
  return !!(els.spellPickModal instanceof HTMLElement && !els.spellPickModal.hidden);
}

function updateSpellPickButtonUI() {
  if (!(els.spellPickBtn instanceof HTMLButtonElement)) return;
  const pending = Array.isArray(state?.player?.pendingSpellQueue) ? state.player.pendingSpellQueue.length : 0;
  els.spellPickBtn.hidden = pending <= 0;
  els.spellPickBtn.disabled = pending <= 0;
  const label = pending <= 1 ? "Choose spell" : `Choose spell (${pending})`;
  els.spellPickBtn.innerHTML = `<span aria-hidden="true" class="rpgTopBtnIcon">📜</span>${label}`;
}

/** @param {Spell} spell */
function spellHookSummary(spell) {
  const parts = [];
  const before = Array.isArray(spell.hooksBefore) ? spell.hooksBefore : [];
  const after = Array.isArray(spell.hooksAfter) ? spell.hooksAfter : [];

  if (spell.piercePct && spell.piercePct > 0) parts.push(`Pierces ${Math.round(spell.piercePct * 100)}% defenses`);
  if (spell.noReflect) parts.push("No reflect");

  if (before.includes("breakDefenses")) parts.push("Breaks Guard first");

  for (const h of after) {
    if (h === "gusted") parts.push("Gusts: enemy next hit -2");
    else if (h === "evade") parts.push("Evade: your next hit -2");
    else if (h === "douse") parts.push("Douse: clears Burn");
    else if (h === "burn1") parts.push("Burn (1)");
    else if (h === "burn2") parts.push("Burn (2)");
    else if (h.startsWith("scent")) {
      const n = Math.max(0, toSafeInt(h.replace("scent", ""), 0));
      if (n > 0) parts.push(`Scented (${n})`);
    } else if (h.startsWith("mana+")) {
      const n = Math.max(0, toSafeInt(h.replace("mana+", ""), 0));
      if (n > 0) parts.push(`Mana +${n}`);
    } else if (h.startsWith("heal+")) {
      const n = Math.max(0, toSafeInt(h.replace("heal+", ""), 0));
      if (n > 0) parts.push(`Heal +${n}`);
    } else if (h.startsWith("drainEnemyMana+")) {
      const n = Math.max(0, toSafeInt(h.replace("drainEnemyMana+", ""), 0));
      if (n > 0) parts.push(`Drain enemy Mana -${n}`);
    }
  }

  return parts.length ? parts.join(" • ") : "A direct damage spell.";
}

/** @param {string[]} poolIds */
function renderSpellPickChoices(poolIds) {
  if (!(els.spellPickChoices instanceof HTMLElement)) return;
  els.spellPickChoices.replaceChildren();

  const ids = Array.isArray(poolIds) ? poolIds : [];
  const types = new Set(Array.isArray(state?.player?.types) ? state.player.types : []);
  const lvl = Math.max(1, toSafeInt(state?.player?.level, 1));

  ids
    .map((id) => SPELLS_BY_ID[id])
    .filter((sp) => !!sp && types.has(sp.type) && lvl >= toSafeInt(sp.unlock, 1))
    .forEach((spell) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn ghost rpgSpellChoice";
      btn.dataset.spellId = spell.id;

      const top = document.createElement("div");
      top.className = "rpgSpellTop";

      const title = document.createElement("div");
      title.className = "rpgSpellTitle";
      title.textContent = spell.name;

      const lvlPill = document.createElement("span");
      lvlPill.className = "pill";
      lvlPill.textContent = `Lv ${toSafeInt(spell.unlock, 1)}`;

      top.appendChild(title);
      top.appendChild(lvlPill);

      const meta = document.createElement("div");
      meta.className = "rpgSpellMeta";

      const typeSpan = document.createElement("span");
      typeSpan.className = `typeInline typeInline--${spell.type}`;
      typeSpan.textContent = `${typeIcon(spell.type)} ${TYPE_META[spell.type]?.label ?? spell.type}`;

      const costPill = document.createElement("span");
      costPill.className = "pill";
      costPill.textContent = `Cost ${toSafeInt(spell.baseCost, 0)} Mana`;

      const dmgPill = document.createElement("span");
      dmgPill.className = "pill";
      dmgPill.textContent = `Base ${toSafeInt(spell.baseDamage, 0)} dmg`;

      meta.appendChild(typeSpan);
      meta.appendChild(costPill);
      meta.appendChild(dmgPill);

      const desc = document.createElement("div");
      desc.className = "rpgSpellDesc";
      desc.textContent = spellHookSummary(spell);

      btn.appendChild(top);
      btn.appendChild(meta);
      btn.appendChild(desc);

      btn.addEventListener("click", () => {
        learnSpell(spell.id, true);
      });

      els.spellPickChoices.appendChild(btn);
    });

  if (els.spellPickChoices.childElementCount === 0) {
    const empty = document.createElement("div");
    empty.className = "rpgMagicEmpty";
    empty.textContent = "No eligible spells right now.";
    els.spellPickChoices.appendChild(empty);
  }
}

/** Open the spell picker for the earliest unresolved unlock level. */
function openNextSpellPick() {
  const queue = Array.isArray(state?.player?.pendingSpellQueue) ? state.player.pendingSpellQueue : [];
  const pool = queue.length ? queue[0] : null;
  if (!pool || !(els.spellPickModal instanceof HTMLElement)) return;

  __spellPickLastFocus = document.activeElement;

  // Close any other transient UI.
  closeMagicMenu();

  renderSpellPickChoices(pool);
  els.spellPickModal.hidden = false;
  updateBodyModalOpen();

  // Focus the first choice for keyboard users.
  const firstBtn = els.spellPickChoices instanceof HTMLElement ? els.spellPickChoices.querySelector("button") : null;
  if (firstBtn instanceof HTMLButtonElement) firstBtn.focus();
}

function closeSpellPicker() {
  if (!(els.spellPickModal instanceof HTMLElement)) return;
  els.spellPickModal.hidden = true;
  updateBodyModalOpen();
  if (__spellPickLastFocus instanceof HTMLElement) {
    try { __spellPickLastFocus.focus(); } catch {}
  }
  __spellPickLastFocus = null;
}

/**
 * Learn a spell (if eligible), persist, and advance the pending queue.
 * @param {string} spellId
 * @param {boolean} fromPicker
 */
function learnSpell(spellId, fromPicker = false) {
  const sp = SPELLS_BY_ID[spellId];
  if (!sp) return;

  const types = Array.isArray(state?.player?.types) ? state.player.types : [];
  const hasType = new Set(types);
  const lvl = Math.max(1, toSafeInt(state?.player?.level, 1));
  if (!hasType.has(sp.type) || lvl < toSafeInt(sp.unlock, 1)) {
    addLog("That spell isn't eligible right now.");
    render();
    return;
  }

  const before = Array.isArray(state.player.spells) ? state.player.spells : [];
  if (!before.includes(spellId)) {
    state.player.spells = sanitizeKnownSpellIds([...before, spellId], types, lvl);
    addLog(`📜 Learned: ${sp.name}.`);
    if (!prefersReducedMotion) showMoveBanner(`Learned: ${sp.name}`, sp.type);
  }

  // Recompute pending picks after learning.
  syncKnownSpells(false);
  persistPlayerProgress();
  render();

  if (fromPicker) {
    // Close, then immediately open the next pending pick (if any).
    closeSpellPicker();
    if (Array.isArray(state.player.pendingSpellQueue) && state.player.pendingSpellQueue.length > 0) {
      window.setTimeout(() => openNextSpellPick(), 120);
    }
  }
}

  function isHeroOpen() {
  return (els.characterModal instanceof HTMLElement) && !els.characterModal.hasAttribute("hidden");
}

function isLootOpen() {
  return (els.lootModal instanceof HTMLElement) && !els.lootModal.hasAttribute("hidden");
}

function isDefeatOpen() {
  return (els.defeatModal instanceof HTMLElement) && !els.defeatModal.hasAttribute("hidden");
}

let lootLastFocus = null;
let lootTimer = 0;

let lootResolve = null; // {battleId:number,isFinal:boolean,nextIndex:number}
/** @param {string} title @param {string} subtitle @param {string} line */
function openLootScreen(title, subtitle, line) {
  if (!(els.lootModal instanceof HTMLElement)) return;
  closeMagicMenu();
  closeInventoryMenu();

  if (els.lootTitle instanceof HTMLElement) els.lootTitle.textContent = title || "Victory";
  if (els.lootSubtitle instanceof HTMLElement) els.lootSubtitle.textContent = subtitle || "";
  if (els.lootLine instanceof HTMLElement) els.lootLine.textContent = line || "No items.";

  els.lootModal.removeAttribute("hidden");
  lootLastFocus = document.activeElement;
  updateBodyModalOpen();

  const inner = els.lootModal.querySelector(".rpgLootInner");
  if (inner instanceof HTMLElement) inner.focus();
}

function closeLootScreen() {
  if (!(els.lootModal instanceof HTMLElement)) return;
  els.lootModal.setAttribute("hidden", "");
  const prev = lootLastFocus;
  lootLastFocus = null;
  updateBodyModalOpen();
  if (prev && prev instanceof HTMLElement) prev.focus();

  // If the loot screen was dismissed early (or auto-timed out), continue the flow.
  const lr = lootResolve;
  if (lr && state && state.battleId === lr.battleId) {
    lootResolve = null;
    resolveLootDismissal(lr);
  }
}

/**
 * Continue the battle flow after the loot screen is dismissed.
 * @param {{battleId:number,isFinal:boolean,nextIndex:number}} lr
 */
function resolveLootDismissal(lr) {
  if (!lr || !state || state.battleId !== lr.battleId) return;

  // Final wave: return to the character menu after rewards.
  if (lr.isFinal) {
    endGame("The duel ends. You win!");
    // Pop the character menu after the win is logged/rendered.
    window.setTimeout(() => {
      if (!state || state.battleId !== lr.battleId) return;
      if (isDefeatOpen()) return;
      openHeroPicker();
    }, 140);
    return;
  }

  // Between-wave breather (fixed, not random).
  const bonus = 3;
  const before = state.player.hp;
  state.player.hp = clamp(state.player.hp + bonus, 0, state.player.max);
  const actual = state.player.hp - before;
  if (actual > 0) addLog(`You catch a second wind (+${actual} HP).`);

  // Clear tactical one-turn states.
  state.player.guarding = false;
  state.player.evading = false;

  // Spawn next enemy.
  const nextIndex = lr.nextIndex;
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


let defeatLastFocus = null;

/** @param {string} subtitle */
function openDefeatScreen(subtitle) {
  if (!(els.defeatModal instanceof HTMLElement)) return;

  // Close transient UI so the defeat screen is the clear focus.
  closeMagicMenu();
  closeInventoryMenu();
  if (isSpellPickOpen()) closeSpellPicker();
  if (isExplainOpen()) closeExplain();
  if (isLocationOpen()) closeLocationPicker();
  if (isLootOpen()) { lootResolve = null; closeLootScreen(); if (lootTimer) window.clearTimeout(lootTimer); lootTimer = 0; }

  if (els.defeatTitle instanceof HTMLElement) els.defeatTitle.textContent = "Defeated";
  if (els.defeatSubtitle instanceof HTMLElement) {
    els.defeatSubtitle.textContent = subtitle || "You were defeated.";
  }

  els.defeatModal.removeAttribute("hidden");
  defeatLastFocus = document.activeElement;
  updateBodyModalOpen();

  const inner = els.defeatModal.querySelector(".rpgDefeatInner");
  if (inner instanceof HTMLElement) inner.focus();
}

function closeDefeatScreen() {
  if (!(els.defeatModal instanceof HTMLElement)) return;
  els.defeatModal.setAttribute("hidden", "");
  const prev = defeatLastFocus;
  defeatLastFocus = null;
  updateBodyModalOpen();
  if (prev && prev instanceof HTMLElement) prev.focus();
}

function updateBodyModalOpen() {
  const any = isExplainOpen() || isCodexOpen() || isHeroOpen() || isLocationOpen() || isSpellPickOpen() || isLootOpen() || isDefeatOpen();
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

  // Normalize sprite sizing inside the hero picker so all portraits feel consistent.
  autoScaleSpritesIn(els.characterChoices);
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
  syncKnownSpells(false);
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
  // Map-based overworld using the same city map art as /map.html.
  if (!(els.locationChoices instanceof HTMLElement)) return;

  // Ensure the container has the correct class for styling.
  els.locationChoices.classList.remove("rpgOverworldGrid");
  els.locationChoices.classList.add("rpgOverworldMapStage");
  els.locationChoices.style.removeProperty("--ow-cols");

  const heroLabel = (() => {
    const n = (state?.player?.name || "Hero").trim();
    return n ? n.slice(0, 1).toUpperCase() : "H";
  })();

  const hero = getActiveHero();
  const heroSpriteRaw = (hero && typeof hero.sprite === "string" && hero.sprite.trim()) ? hero.sprite.trim() : "./assets/images/characters/axel.png";
  const heroSprite = (heroSpriteRaw.startsWith(".") || heroSpriteRaw.startsWith("/")) ? heroSpriteRaw : `./${heroSpriteRaw}`;

  const data = window.MAP_LOCATIONS_DATA;
  const mapUrlRaw = (data && data.image && typeof data.image.url === "string") ? data.image.url : "assets/images/city-map.png";
  const mapUrl = (mapUrlRaw.startsWith(".") || mapUrlRaw.startsWith("/")) ? mapUrlRaw : `./${mapUrlRaw}`;

  const pinHtml = OVERWORLD_BATTLE_IDS.map((id) => {
    const m = getMapLocationData(id);
    const loc = getLocationById(id);
    const left = toSafeNum(m?.leftPct, 50);
    const top = toSafeNum(m?.topPct, 50);
    const icon = OVERWORLD_LOC_ICONS[id] || "✦";
    const title = (loc?.name || id);
    return `
      <button type="button" class="rpgOverworldPin" data-ow-loc="${id}" style="left:${left}%; top:${top}%;" title="${title}" aria-label="Battle marker: ${title}">
        <span class="srOnly">${title}</span>
        <span class="rpgOverworldPinEmoji" aria-hidden="true">${icon}</span>
      </button>
    `;
  }).join("");

  els.locationChoices.innerHTML = `
    <div class="rpgOverworldMapFrame" id="owFrame" aria-label="City map">
      <img class="rpgOverworldMapImage" src="${mapUrl}" alt="City map" loading="eager" />
      <div class="rpgOverworldMapShade" aria-hidden="true"></div>
      <div class="rpgOverworldPins" id="owPins" role="group" aria-label="Battle markers">
        ${pinHtml}
      </div>
      <div class="rpgOverworldPlayer" id="owPlayer" aria-hidden="true" data-hero="${hero?.id || "hero"}">
        <div class="rpgOverworldAvatar" aria-hidden="true">
          <img class="rpgOverworldAvatarImg" src="${heroSprite}" alt="" draggable="false" loading="eager" onerror="this.remove()" />
        </div>
        <div class="rpgOverworldFoot" aria-hidden="true"></div>
      </div>
    </div>
  `;

  // Allow click/tap/drag to move the avatar around the map.
  const frameEl = els.locationChoices.querySelector('#owFrame');
  if (frameEl instanceof HTMLElement) {
    // Prevent scroll-jank while dragging inside the modal.
    frameEl.style.touchAction = 'none';

    let dragging = false;
    let activePointerId = null;

    const eventToPct = (ev) => {
      const r = frameEl.getBoundingClientRect();
      const x = (ev.clientX - r.left) / Math.max(1, r.width);
      const y = (ev.clientY - r.top) / Math.max(1, r.height);
      return {
        xPct: clamp(x * 100, 0, 100),
        yPct: clamp(y * 100, 0, 100),
      };
    };

    const onDown = (ev) => {
      // If you clicked a pin, let the pin handler handle it.
      const t = ev.target;
      if (t && t instanceof HTMLElement && t.closest('button.rpgOverworldPin')) return;
      if (!isLocationOpen()) return;
      dragging = true;
      activePointerId = ev.pointerId;
      try { frameEl.setPointerCapture(ev.pointerId); } catch {}
      ev.preventDefault();
      const { xPct, yPct } = eventToPct(ev);
      setOwPos(xPct, yPct);
      renderOverworldPositions();
      updateOverworldUI();
    };

    const onMove = (ev) => {
      if (!dragging) return;
      if (activePointerId !== null && ev.pointerId !== activePointerId) return;
      ev.preventDefault();
      const { xPct, yPct } = eventToPct(ev);
      setOwPos(xPct, yPct);
      renderOverworldPositions();
      updateOverworldUI();
    };

    const onUp = (ev) => {
      if (activePointerId !== null && ev.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = null;
      try { frameEl.releasePointerCapture(ev.pointerId); } catch {}
    };

    frameEl.addEventListener('pointerdown', onDown);
    frameEl.addEventListener('pointermove', onMove);
    frameEl.addEventListener('pointerup', onUp);
    frameEl.addEventListener('pointercancel', onUp);
    frameEl.addEventListener('lostpointercapture', () => { dragging = false; activePointerId = null; });
  }

  // Position player + highlight nearby marker.
  renderOverworldPositions();
  updateOverworldUI();
}


function openLocationPicker() {
  if (!(els.locationModal instanceof HTMLElement)) return;
  closeMagicMenu();

  resetOverworld();
  renderLocationChoices();
  els.locationModal.removeAttribute("hidden");
  locationLastFocus = document.activeElement;
  updateBodyModalOpen();

  setPhase("select");
  renderIntent(null);
  setEffectBanner("—", "neutral");
  render();

  // Focus the first choice for keyboard users.
  const preferred = (els.overworldBattleBtn instanceof HTMLButtonElement) ? els.overworldBattleBtn : null;
  if (preferred && !preferred.hasAttribute('hidden') && !preferred.disabled) {
    preferred.focus();
  } else {
    const first = els.locationModal.querySelector("button[data-ow-loc]");
    if (first instanceof HTMLButtonElement) first.focus();
  }
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
  closeInventoryMenu();
  lootResolve = null;
  if (isLootOpen()) closeLootScreen();
  if (lootTimer) window.clearTimeout(lootTimer);
  lootTimer = 0;
  closeLocationPicker();

  resetVisuals();

  const encounterSet = buildEnemySetForBattle(getActiveHero().level);
  activeEnemySet = encounterSet;
  state = makeInitialState(encounterSet, loc.id);
  syncKnownSpells(false);
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
  if (els.codexBtn instanceof HTMLButtonElement) {
    els.codexBtn.addEventListener("click", () => openCodex());
  }
  if (els.explainClose instanceof HTMLButtonElement) {
    els.explainClose.addEventListener("click", () => closeExplain());
  }
  if (els.explainOk instanceof HTMLButtonElement) {
    els.explainOk.addEventListener("click", () => closeExplain());
  }

  if (els.codexClose instanceof HTMLButtonElement) {
    els.codexClose.addEventListener("click", () => closeCodex());
  }
  if (els.codexOk instanceof HTMLButtonElement) {
    els.codexOk.addEventListener("click", () => closeCodex());
  }

  // Spell picker wiring
  if (els.spellPickBtn instanceof HTMLButtonElement) {
    els.spellPickBtn.addEventListener("click", () => openNextSpellPick());
  }
  if (els.spellPickClose instanceof HTMLButtonElement) {
    els.spellPickClose.addEventListener("click", () => closeSpellPicker());
  }
  if (els.spellPickLater instanceof HTMLButtonElement) {
    els.spellPickLater.addEventListener("click", () => closeSpellPicker());
  }
  if (els.spellPickModal instanceof HTMLElement) {
    els.spellPickModal.addEventListener("click", (e) => {
      if (e.target === els.spellPickModal) closeSpellPicker();
    });
  }

  // Click outside modal content closes it
  if (els.explainModal instanceof HTMLElement) {
    els.explainModal.addEventListener("click", (e) => {
      if (e.target === els.explainModal) closeExplain();
    });
  }

  if (els.codexModal instanceof HTMLElement) {
    els.codexModal.addEventListener("click", (e) => {
      if (e.target === els.codexModal) closeCodex();
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
   * Base type chart (3 tiers). We'll derive a 5-tier chart from this so the "strongest" and "weakest"
   * relationships show up as Super / Extremely-not-effective even on single-type matchups.
   */
  const TYPE_ORDER = /** @type {MagicType[]} */ (["Wind", "Water", "Fire", "Earth", "Sight", "Sound", "Touch", "SmellTaste"]);

  const TYPE_CHART_BASE = /** @type {Record<MagicType, Record<MagicType, number>>} */ ({
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
  // Tier multipliers (match the chart’s strong/weak values).
  const TYPE_WEAK = 0.8;
  const TYPE_STRONG = 1.6;

  /**
   * Derive a 5-tier chart from the base chart:
   * - For each defender type, choose ONE "strongest" attacker among the strongest set (if any) => Super (1.6^2)
   * - For each defender type, choose ONE "worst" attacker among the weakest set (if any) => Extremely-not (0.8^2)
   * This makes the 5 tiers appear in the full chart while staying grounded in the base strengths.
   */
  function buildFiveTierChart(base) {
    /** @type {Record<MagicType, Record<MagicType, number>>} */
    const out = /** @type {any} */ ({});
    for (const atk of TYPE_ORDER) out[atk] = { ...(base[atk] || {}) };

    for (const def of TYPE_ORDER) {
      let max = -Infinity;
      let min = Infinity;
      for (const atk of TYPE_ORDER) {
        const m = base[atk]?.[def] ?? 1;
        if (m > max) max = m;
        if (m < min) min = m;
      }

      // Pick a single "strongest" attacker for this defender (stable order tie-break).
      if (max > 1) {
        const superAtk = TYPE_ORDER.find((atk) => (base[atk]?.[def] ?? 1) === max);
        if (superAtk) out[superAtk][def] = TYPE_STRONG * TYPE_STRONG;
      }

      // Pick a single "worst" attacker for this defender (stable order tie-break).
      if (min < 1) {
        const extremeAtk = TYPE_ORDER.find((atk) => (base[atk]?.[def] ?? 1) === min);
        if (extremeAtk) out[extremeAtk][def] = TYPE_WEAK * TYPE_WEAK;
      }
    }

    return out;
  }

  const TYPE_CHART = buildFiveTierChart(TYPE_CHART_BASE);

  /** @param {MagicType} attackType @param {MagicType[]} defenderTypes */
  function typeEffectScore(attackType, defenderTypes) {
    // Discrete scoring: each defender type contributes -2/-1/0/+1/+2 based on the 5-tier chart.
    // This keeps outcomes readable (and prevents in-between multipliers like 1.28 on mixed dual types).
    let score = 0;
    for (const dt of defenderTypes) {
      const m = TYPE_CHART[attackType]?.[dt] ?? 1;
      if (m >= (TYPE_STRONG * TYPE_STRONG) - 1e-6) score += 2;
      else if (m > 1) score += 1;
      else if (m <= (TYPE_WEAK * TYPE_WEAK) + 1e-6) score -= 2;
      else if (m < 1) score -= 1;
    }
    return clamp(score, -2, 2);
  }

  const TYPE_TIER_MULT = /** @type {Record<string, number>} */ ({
    "-2": TYPE_WEAK * TYPE_WEAK,
    "-1": TYPE_WEAK,
    "0": 1.0,
    "1": TYPE_STRONG,
    "2": TYPE_STRONG * TYPE_STRONG,
  });

  const EFFECT_TIER_CUTS = {
    extreme: (TYPE_TIER_MULT["-2"] + TYPE_TIER_MULT["-1"]) / 2,
    weak: (TYPE_TIER_MULT["-1"] + TYPE_TIER_MULT["0"]) / 2,
    strong: (TYPE_TIER_MULT["0"] + TYPE_TIER_MULT["1"]) / 2,
    super: (TYPE_TIER_MULT["1"] + TYPE_TIER_MULT["2"]) / 2,
  };

  /** @param {MagicType} attackType @param {MagicType[]} defenderTypes */
  function typeMultiplier(attackType, defenderTypes) {
    const s = typeEffectScore(attackType, defenderTypes);
    return TYPE_TIER_MULT[String(s)] ?? 1;
  }

  /** @param {number} mult */
  function effectivenessTier(mult) {
    if (mult < EFFECT_TIER_CUTS.extreme) return { score: -2, label: "Extremely not effective", tone: "bad", bannerTone: "not" };
    if (mult < EFFECT_TIER_CUTS.weak) return { score: -1, label: "Not effective", tone: "bad", bannerTone: "not" };
    if (mult < EFFECT_TIER_CUTS.strong) return { score: 0, label: "Neutral", tone: "neutral", bannerTone: "neutral" };
    if (mult < EFFECT_TIER_CUTS.super) return { score: 1, label: "Effective", tone: "good", bannerTone: "super" };
    return { score: 2, label: "Super effective", tone: "good", bannerTone: "super" };
  }

  /** @param {number} mult */
  function effectivenessText(mult) {
    const t = effectivenessTier(mult);
    if (t.score === 0) return "";
    if (t.score === 2) return "Super effective";
    if (t.score === 1) return "Effective";
    if (t.score === -1) return "Not effective";
    return "Extremely not effective";
  }

  /** @param {number} mult */
  function effectivenessTierLabel(mult) {
    const t = effectivenessTier(mult);
    if (t.score === 2) return { label: "Super effective", tone: "good" };
    if (t.score === 1) return { label: "Effective", tone: "good" };
    if (t.score === -1) return { label: "Not effective", tone: "bad" };
    if (t.score === -2) return { label: "Extremely not effective", tone: "bad" };
    return { label: "Neutral", tone: "neutral" };
  }

  /**
   * Render the "before you click" effectiveness preview line.
   * @param {{name:string, type: MagicType, baseCost:number, extra?: string}} move
   */
  function renderEffectPreview(move) {
    if (!(els.effectPreview instanceof HTMLElement)) return;

    // Custom preview (used for non-typed actions like Heal).
    if (move && typeof move.customHtml === "string" && move.customHtml.trim()) {
      const tone = move.tone === "good" || move.tone === "bad" ? move.tone : "neutral";
      els.effectPreview.classList.remove("isGood", "isBad", "isNeutral");
      if (tone === "good") els.effectPreview.classList.add("isGood");
      else if (tone === "bad") els.effectPreview.classList.add("isBad");
      else els.effectPreview.classList.add("isNeutral");
      els.effectPreview.innerHTML = move.customHtml;
      return;
    }

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
    const extraText = (move && typeof move.extra === "string" && move.extra.trim()) ? move.extra.trim() : "";
    const extraBit = extraText ? ` • ${extraText}` : "";
    els.effectPreview.innerHTML =
      `${move.name}: <span class="rpgEffectPreviewText">${tier.label}</span> ` +
      `<span class="rpgEffectPreviewMeta">(x${fmtMult(eff)} • ${meta}${extraBit})</span>`;
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

function setPreviewMove(name, type, baseCost, extra = "") {
    previewMove = { name, type, baseCost, extra };
    renderEffectPreview(previewMove);
  }

	/**
	 * Set a custom preview line (used for non-typed actions like Heal).
	 * @param {string} html
	 * @param {"good"|"bad"|"neutral"} tone
	 */
	function setPreviewText(html, tone = "neutral") {
	  // Store as the current preview so re-renders keep the same line.
	  const t = state?.player?.types?.[0] || "Touch";
	  previewMove = { name: "Preview", type: t, baseCost: 0, customHtml: html, tone };
	  renderEffectPreview(previewMove);
	}

	/**
	 * Predict how much HP Heal will restore right now (after capping at Max HP).
	 * This mirrors the actual heal formula so the preview is always accurate.
	 */
	function previewHealAmount() {
	  const healMult = typeof state?.player?.healMult === "number" ? state.player.healMult : 1;
	  const maxHp = Math.max(1, toSafeInt(state?.player?.max, 1));
	  const curHp = clamp(toSafeInt(state?.player?.hp, 0), 0, maxHp);
	  const hpRatio = maxHp > 0 ? curHp / maxHp : 1;
	  let heal = Math.round(maxHp * 0.28 + 4 * healMult);
	  if (hpRatio <= 0.35) heal += Math.round(maxHp * 0.08);
	  heal = Math.max(1, heal);
	  const next = clamp(curHp + heal, 0, maxHp);
	  return Math.max(0, next - curHp);
	}

	function showHealPreview() {
	  const amt = previewHealAmount();
	  setPreviewText(`Heal: <span class="rpgEffectPreviewText">+${amt} HP</span>`, "neutral");
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
        // Use the same tiered effectiveness logic the battle system uses.
        // (Even though this matrix is single-type columns today, this keeps it consistent.)
        const mult = typeMultiplier(atk, [def]);
        const tier = effectivenessTier(mult);
        const td = document.createElement("td");
        td.className = "rpgTypeCell";

        // 5 discrete outcomes: extremely not effective, not effective, neutral, effective, super effective.
        if (tier.score === 2) td.classList.add("isSuper");
        else if (tier.score === 1) td.classList.add("isEffective");
        else if (tier.score === -1) td.classList.add("isNot");
        else if (tier.score === -2) td.classList.add("isExtremeNot");
        else td.classList.add("isNeutral");

        // Display a number in the grid (so players can scan exact values).
        // Values remain discrete because typeMultiplier() snaps to the 5-tier system.
        td.textContent = `x${fmtMult(mult)}`;
        td.title = `${TYPE_META[atk]?.label ?? atk} → ${TYPE_META[def]?.label ?? def}: ${tier.label} (x${fmtMult(mult)})`;
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

    // Effectiveness is tiered (5 discrete outcomes) so it stays readable.
    const eff = typeMultiplier(moveType, defender.types);
    const tier = effectivenessTier(eff);

    const scaled = Math.max(1, Math.round(base * stab * eff));
    return {
      scaled,
      stab,
      eff,
      overall: stab * eff,
      tierLabel: tier.label,
      tierScore: tier.score,
      bannerTone: tier.bannerTone,
      // Log note (only when not neutral)
      note: effectivenessText(eff),
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
function toSafeNum(n, fallback) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function toSafeInt(n, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.trunc(x);
}



// --------------------
// Rarity (simple)
// --------------------

/** @typedef {"common"|"uncommon"|"rare"|"epic"|"legendary"} RarityKey */

const RARITY_ORDER = /** @type {RarityKey[]} */ (["common", "uncommon", "rare", "epic", "legendary"]);

const RARITY_META = /** @type {Record<RarityKey, {label:string}>} */ ({
  common: { label: "Common" },
  uncommon: { label: "Uncommon" },
  rare: { label: "Rare" },
  epic: { label: "Epic" },
  legendary: { label: "Legendary" },
});

const ITEM_RARITY_WEIGHTS = /** @type {Record<RarityKey, number>} */ ({
  common: 60,
  uncommon: 28,
  rare: 10,
  epic: 2,
  legendary: 0,
});

const GEAR_RARITY_WEIGHTS = /** @type {Record<RarityKey, number>} */ ({
  common: 55,
  uncommon: 28,
  rare: 13,
  epic: 4,
  legendary: 0,
});

/** @param {RarityKey|any} r */
function rarityLabel(r) {
  /** @type {RarityKey} */
  const key = (RARITY_META && RARITY_META[r]) ? r : "common";
  return RARITY_META[key].label;
}

/** @param {Record<RarityKey, number>} weights */
function rollRarity(weights) {
  const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0);
  if (!entries.length) return /** @type {RarityKey} */ ("common");
  const total = entries.reduce((s, [, w]) => s + Number(w), 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= Number(w);
    if (r <= 0) return /** @type {RarityKey} */ (k);
  }
  return /** @type {RarityKey} */ (entries[entries.length - 1][0]);
}

/** @param {any[]} list */
function pickOne(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Pick an ID from pools by rarity, falling back to more common rarities.
 * @param {Record<RarityKey, string[]>} pools
 * @param {RarityKey} wanted
 */
function pickByRarity(pools, wanted) {
  const idx = Math.max(0, RARITY_ORDER.indexOf(wanted));
  for (let i = idx; i >= 0; i--) {
    const r = RARITY_ORDER[i];
    const list = pools?.[r];
    const pick = pickOne(list);
    if (pick) return pick;
  }
  // last resort: any
  for (const r of RARITY_ORDER) {
    const pick = pickOne(pools?.[r]);
    if (pick) return pick;
  }
  return null;
}

/** @param {RarityKey|any} r */
function rarityRank(r) {
  const key = (RARITY_META && RARITY_META[r]) ? r : "common";
  return RARITY_ORDER.indexOf(key);
}

// --------------------
// Items (extremely simple)
// - One-use consumables
// - Found randomly after each cleared wave (equal chance per item)
// - Saved per-hero
// --------------------

const ITEM_DEFS = /** @type {Record<string, {id:string,name:string,icon:string,desc:string,rarity:RarityKey}>} */ ({
  potion: { id: "potion", name: "Potion", icon: "🧪", desc: "Heal 7 HP", rarity: "common" },
  ether: { id: "ether", name: "Mana Shard", icon: "💠", desc: "Restore 2 Mana", rarity: "common" },
  cleanse: { id: "cleanse", name: "Cleanse Charm", icon: "🧿", desc: "Clear Burn + Bind", rarity: "uncommon" },

  // Slightly more interesting drops (still very simple)
  bomb: { id: "bomb", name: "Bomb", icon: "💣", desc: "Deal 6 damage (ignores defenses)", rarity: "uncommon" },
  ember: { id: "ember", name: "Ember Oil", icon: "🕯️", desc: "Apply Burn (2) to enemy", rarity: "uncommon" },
  stun: { id: "stun", name: "Stun Dust", icon: "🌫️", desc: "Enemy skips next turn", rarity: "rare" },
  rune: { id: "rune", name: "Power Rune", icon: "🗡️", desc: "Next damage x1.3", rarity: "rare" },
  barrier: { id: "barrier", name: "Barrier Scroll", icon: "🛡️", desc: "Next hit −30%", rarity: "epic" },
});
const ITEM_IDS = Object.keys(ITEM_DEFS);

const ITEM_IDS_BY_RARITY = /** @type {Record<RarityKey, string[]>} */ ({
  common: ITEM_IDS.filter((id) => ITEM_DEFS[id]?.rarity === "common"),
  uncommon: ITEM_IDS.filter((id) => ITEM_DEFS[id]?.rarity === "uncommon"),
  rare: ITEM_IDS.filter((id) => ITEM_DEFS[id]?.rarity === "rare"),
  epic: ITEM_IDS.filter((id) => ITEM_DEFS[id]?.rarity === "epic"),
  legendary: ITEM_IDS.filter((id) => ITEM_DEFS[id]?.rarity === "legendary"),
});


const STARTING_ITEMS = /** @type {Record<string, number>} */ ({ potion: 1, ether: 1, bomb: 1 });

/** @param {any} raw */
function sanitizeItemCounts(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const id of ITEM_IDS) {
    const n = Math.max(0, toSafeInt(src[id], 0));
    if (n > 0) out[id] = clamp(n, 0, 99);
  }
  return out;
}


// --------------------
// Gear (equipment)
// - Persistent, NOT consumed
// - Three slots: Weapon / Armor / Trinket
// - Saved per-hero
// - Drag & drop in Gear menu (click also works, for mobile)
// --------------------

const EQUIP_SLOTS = /** @type {("weapon"|"armor"|"trinket")[]} */ (["weapon", "armor", "trinket"]);
const EQUIP_SLOT_LABEL = /** @type {Record<"weapon"|"armor"|"trinket", string>} */ ({
  weapon: "Weapon",
  armor: "Armor",
  trinket: "Trinket",
});

/** @type {Record<string, {id:string,slot:"weapon"|"armor"|"trinket",name:string,icon:string,desc:string, rarity:RarityKey, bossUnique?:boolean, hpBonus?:number, focusBonus?:number, powerPct?:number, healPct?:number, drPct?:number}>} */
const GEAR_DEFS = {
  // Trinkets (small, flexible bonuses)
  apprentice_ring: { id: "apprentice_ring", slot: "trinket", name: "Apprentice Ring", icon: "💍", desc: "+2 Max HP", rarity: "common", hpBonus: 2 },
  focus_band: { id: "focus_band", slot: "trinket", name: "Focus Band", icon: "🔷", desc: "+1 Max Mana", rarity: "common", focusBonus: 1 },
  ward_clasp: { id: "ward_clasp", slot: "trinket", name: "Ward Clasp", icon: "🧷", desc: "10% damage reduction", rarity: "uncommon", drPct: 0.10 },
  ember_charm: { id: "ember_charm", slot: "trinket", name: "Ember Charm", icon: "🔥", desc: "+8% damage", rarity: "uncommon", powerPct: 0.08 },
  sage_brooch: { id: "sage_brooch", slot: "trinket", name: "Sage Brooch", icon: "🌿", desc: "+8% healing", rarity: "uncommon", healPct: 0.08 },
  quartz_charm: { id: "quartz_charm", slot: "trinket", name: "Quartz Charm", icon: "💎", desc: "+3 Max HP", rarity: "uncommon", hpBonus: 3 },
  anchor_talisman: { id: "anchor_talisman", slot: "trinket", name: "Anchor Talisman", icon: "⚓", desc: "6% damage reduction", rarity: "common", drPct: 0.06 },
  duelist_coin: { id: "duelist_coin", slot: "trinket", name: "Duelist Coin", icon: "🪙", desc: "+6% damage", rarity: "common", powerPct: 0.06 },
  wisp_locket: { id: "wisp_locket", slot: "trinket", name: "Wisp Locket", icon: "🫧", desc: "+1 Max Mana, +4% healing", rarity: "rare", focusBonus: 1, healPct: 0.04 },
  bulwark_token: { id: "bulwark_token", slot: "trinket", name: "Bulwark Token", icon: "🛡️", desc: "8% damage reduction", rarity: "uncommon", drPct: 0.08 },

  // Weapons (lean into offense / Mana)
  tidal_blade: { id: "tidal_blade", slot: "weapon", name: "Tidal Blade", icon: "🗡️", desc: "+10% damage", rarity: "uncommon", powerPct: 0.10 },
  emberbrand_sabre: { id: "emberbrand_sabre", slot: "weapon", name: "Emberbrand Sabre", icon: "🗡️", desc: "+12% damage", rarity: "epic", powerPct: 0.12 },
  gale_dagger: { id: "gale_dagger", slot: "weapon", name: "Gale Dagger", icon: "🗡️", desc: "+9% damage", rarity: "uncommon", powerPct: 0.09 },
  echo_lance: { id: "echo_lance", slot: "weapon", name: "Echo Lance", icon: "🪓", desc: "+8% damage", rarity: "common", powerPct: 0.08 },
  duelist_foil: { id: "duelist_foil", slot: "weapon", name: "Duelist Foil", icon: "🗡️", desc: "+6% damage, +1 Max Mana", rarity: "rare", powerPct: 0.06, focusBonus: 1 },
  runic_mace: { id: "runic_mace", slot: "weapon", name: "Runic Mace", icon: "🔨", desc: "+2 Max HP, +6% damage", rarity: "uncommon", hpBonus: 2, powerPct: 0.06 },
  spring_wand: { id: "spring_wand", slot: "weapon", name: "Spring Wand", icon: "🪄", desc: "+10% healing", rarity: "uncommon", healPct: 0.10 },
  mana_scepter: { id: "mana_scepter", slot: "weapon", name: "Mana Scepter", icon: "🪄", desc: "+1 Max Mana", rarity: "common", focusBonus: 1 },
  prism_rod: { id: "prism_rod", slot: "weapon", name: "Prism Rod", icon: "🔮", desc: "+2 Max Mana", rarity: "rare", focusBonus: 2 },

  // Armor (survivability)
  stoneguard_vest: { id: "stoneguard_vest", slot: "armor", name: "Stoneguard Vest", icon: "🛡️", desc: "+4 Max HP", rarity: "common", hpBonus: 4 },
  ironbark_mail: { id: "ironbark_mail", slot: "armor", name: "Ironbark Mail", icon: "🥋", desc: "+6 Max HP, 6% damage reduction", rarity: "rare", hpBonus: 6, drPct: 0.06 },
  warded_coat: { id: "warded_coat", slot: "armor", name: "Warded Coat", icon: "🧥", desc: "12% damage reduction", rarity: "epic", drPct: 0.12 },
  mirrorweave_mantle: { id: "mirrorweave_mantle", slot: "armor", name: "Mirrorweave Mantle", icon: "🪞", desc: "8% damage reduction, +1 Max Mana", rarity: "rare", drPct: 0.08, focusBonus: 1 },
  mossweave_cloak: { id: "mossweave_cloak", slot: "armor", name: "Mossweave Cloak", icon: "🧶", desc: "+2 Max HP, +6% healing", rarity: "uncommon", hpBonus: 2, healPct: 0.06 },
  emberproof_jacket: { id: "emberproof_jacket", slot: "armor", name: "Emberproof Jacket", icon: "🧥", desc: "10% damage reduction", rarity: "uncommon", drPct: 0.10 },
  scholar_robe: { id: "scholar_robe", slot: "armor", name: "Scholar Robe", icon: "🎓", desc: "+2 Max HP, +1 Max Mana", rarity: "uncommon", hpBonus: 2, focusBonus: 1 },
  tidebreaker_coat: { id: "tidebreaker_coat", slot: "armor", name: "Tidebreaker Coat", icon: "🌊", desc: "+3 Max HP, 6% damage reduction", rarity: "uncommon", hpBonus: 3, drPct: 0.06 },
  pactwarden_wrap: { id: "pactwarden_wrap", slot: "armor", name: "Pactwarden Wrap", icon: "🧣", desc: "6% damage reduction, +6% healing", rarity: "rare", drPct: 0.06, healPct: 0.06 },

  // Boss relics (unique per area boss; NOT in the random drop pool)
  arena_victor_blade: { id: "arena_victor_blade", slot: "weapon", name: "Victor's Blade", icon: "🏆", desc: "+14% damage", rarity: "legendary", powerPct: 0.14, bossUnique: true },
  market_ledger_mail: { id: "market_ledger_mail", slot: "armor", name: "Ledger Mail", icon: "🧾", desc: "+1 Max Mana, 10% damage reduction", rarity: "legendary", focusBonus: 1, drPct: 0.10, bossUnique: true },
  feyleaf_circlet: { id: "feyleaf_circlet", slot: "trinket", name: "Feyleaf Circlet", icon: "🍃", desc: "+2 Max HP, +10% healing", rarity: "legendary", hpBonus: 2, healPct: 0.10, bossUnique: true },
  gutterglass_prism: { id: "gutterglass_prism", slot: "weapon", name: "Gutterglass Prism", icon: "🪞", desc: "+1 Max Mana, +8% damage", rarity: "legendary", focusBonus: 1, powerPct: 0.08, bossUnique: true },
};
const GEAR_IDS = Object.keys(GEAR_DEFS);


// --------------------
// Compendium rendering
// --------------------

function clearEl(el) {
  if (!(el instanceof HTMLElement)) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** @param {RarityKey|any} r */
function makeRarityPill(r) {
  const span = document.createElement('span');
  span.className = `rpgRarityPill rarity--${(RARITY_META && RARITY_META[r]) ? r : 'common'}`;
  span.textContent = rarityLabel(r);
  return span;
}

/**
 * @param {{icon?:string,title:string, sub?:string, types?:MagicType[], rightPill?:HTMLElement|null, tag?:string, sprite?:string, className?:string}} opts
 */
function makeCodexEntry(opts) {
  const row = document.createElement('div');
  row.className = `rpgCodexEntry${(typeof opts.className === 'string' && opts.className.trim()) ? ` ${opts.className.trim()}` : ''}`;

  const icon = document.createElement('div');
  icon.className = 'rpgCodexIcon';

  const spriteSrc = (typeof opts.sprite === 'string' && opts.sprite.trim()) ? opts.sprite.trim() : '';
  if (spriteSrc) {
    const img = document.createElement('img');
    img.className = 'rpgCodexSprite';
    img.loading = 'lazy';
    img.alt = '';
    img.src = spriteSrc;
    icon.appendChild(img);

    // Keep compendium sprites visually consistent even when the PNGs have different padding.
    autoScaleSprite(img, { target: 0.92, max: 1.32 });
  } else {
    icon.textContent = opts.icon || '✦';
  }

  row.appendChild(icon);

  const main = document.createElement('div');
  main.className = 'rpgCodexMain';

  const top = document.createElement('div');
  top.className = 'rpgCodexTopRow';

  const name = document.createElement('div');
  name.className = 'rpgCodexName';
  name.textContent = opts.title;
  top.appendChild(name);

  if (opts.tag) {
    const tag = document.createElement('span');
    tag.className = 'rpgCodexTag';
    tag.textContent = opts.tag;
    top.appendChild(tag);
  }

  if (opts.rightPill) {
    top.appendChild(opts.rightPill);
  }

  main.appendChild(top);

  if (Array.isArray(opts.types) && opts.types.length) {
    const tWrap = document.createElement('div');
    tWrap.className = 'rpgCodexTypes';
    for (const t of opts.types) {
      const pill = document.createElement('span');
      pill.className = `typeInline typeInline--${t}`;
      pill.textContent = `${typeIcon(t)} ${TYPE_META[t]?.label ?? t}`;
      tWrap.appendChild(pill);
    }
    main.appendChild(tWrap);
  }

  if (opts.sub) {
    const sub = document.createElement('div');
    sub.className = 'rpgCodexSub';
    sub.textContent = opts.sub;
    main.appendChild(sub);
  }

  row.appendChild(main);
  return row;
}

/**
 * Compute approximate enemy encounter rates for the current weighted system.
 * Rates are calculated for Wave 1 and Wave 2; Wave 3 is always the boss.
 * The Wave 2 rates account for the 70% anti-repeat reroll (when Wave 2 initially matches Wave 1).
 * @returns {Map<number, {w1:number,w2:number,any:number,boss:boolean}>}
 */
function computeEnemyEncounterRates() {
  /** @type {Map<number, {w1:number,w2:number,any:number,boss:boolean}>} */
  const out = new Map();

  const bossIdx = (typeof BOSS_ENEMY_INDEX === 'number') ? BOSS_ENEMY_INDEX : -1;
  if (bossIdx >= 0) {
    out.set(bossIdx, { w1: 0, w2: 0, any: 1, boss: true });
  }

  const sorted = Array.isArray(NON_BOSS_SORTED) ? NON_BOSS_SORTED : [];
  if (!sorted.length) return out;

  const weightsFor = (weightsByRank) => {
    const w = sorted.map((_, rank) => (weightsByRank && typeof weightsByRank[rank] === 'number') ? weightsByRank[rank] : 1);
    let total = 0;
    for (const x of w) total += Math.max(0, x || 0);
    const pByIndex = new Map();
    sorted.forEach((x, rank) => {
      const ww = Math.max(0, w[rank] || 0);
      pByIndex.set(x.i, total > 0 ? (ww / total) : 0);
    });
    return { weights: w, total, pByIndex };
  };

  const wave1 = weightsFor(WAVE1_WEIGHTS_BY_RANK);
  const wave2init = weightsFor(WAVE2_WEIGHTS_BY_RANK);

  // Wave 2 final distribution includes anti-repeat reroll.
  /** @type {Map<number, number>} */
  const p2final = new Map();
  for (const x of sorted) p2final.set(x.i, 0);

  const n = sorted.length;
  const canReroll = n > 1;

  // Precompute alternative wave2 distributions when excluding a specific wave1 enemy.
  /** @type {Map<number, Map<number, number>>} */
  const altDistByExclude = new Map();
  if (canReroll) {
    for (const ex of sorted) {
      const altSorted = sorted.filter((z) => z.i !== ex.i);
      const altWeights = altSorted.map((_, rank) => (WAVE2_WEIGHTS_BY_RANK && typeof WAVE2_WEIGHTS_BY_RANK[rank] === 'number') ? WAVE2_WEIGHTS_BY_RANK[rank] : 1);
      let altTotal = 0;
      for (const w of altWeights) altTotal += Math.max(0, w || 0);
      const altMap = new Map();
      altSorted.forEach((z, rank) => {
        const ww = Math.max(0, altWeights[rank] || 0);
        altMap.set(z.i, altTotal > 0 ? (ww / altTotal) : 0);
      });
      altDistByExclude.set(ex.i, altMap);
    }
  }

  // P(final w2 = k) = Σ_i P(w1=i) * [ P(init=k, k!=i) + P(init=i)*0.30*(k==i) + P(init=i)*0.70*P_alt(k|exclude i) ]
  for (const wi of sorted) {
    const i = wi.i;
    const pW1 = wave1.pByIndex.get(i) || 0;
    if (pW1 <= 0) continue;

    // baseline: init=k and k!=i
    for (const wk of sorted) {
      const k = wk.i;
      if (k === i) continue;
      const pInit = wave2init.pByIndex.get(k) || 0;
      if (pInit > 0) p2final.set(k, (p2final.get(k) || 0) + pW1 * pInit);
    }

    const pInitI = wave2init.pByIndex.get(i) || 0;
    if (pInitI > 0) {
      if (!canReroll) {
        // No reroll possible: wave2 is always the only enemy.
        p2final.set(i, (p2final.get(i) || 0) + pW1 * pInitI);
      } else {
        // 30% keep the repeat.
        p2final.set(i, (p2final.get(i) || 0) + pW1 * pInitI * 0.30);

        // 70% reroll from alt pool.
        const alt = altDistByExclude.get(i);
        if (alt) {
          for (const [k, pAlt] of alt.entries()) {
            if (pAlt > 0) p2final.set(k, (p2final.get(k) || 0) + pW1 * pInitI * 0.70 * pAlt);
          }
        }
      }
    }
  }

  // Fill final output for non-boss enemies.
  for (const x of sorted) {
    const idx = x.i;
    const p1 = wave1.pByIndex.get(idx) || 0;
    const p2 = p2final.get(idx) || 0;

    // Overlap term for "appears at least once" within a battle run.
    // Repeat only possible when wave1=idx AND wave2 final=idx.
    let overlap = 0;
    const pInit = wave2init.pByIndex.get(idx) || 0;
    if (canReroll) overlap = p1 * pInit * 0.30;
    else overlap = p1 * pInit;

    const any = clamp(p1 + p2 - overlap, 0, 1);
    out.set(idx, { w1: clamp(p1, 0, 1), w2: clamp(p2, 0, 1), any, boss: false });
  }

  return out;
}

function formatPct(p) {
  const n = Math.max(0, Number(p) || 0);
  if (n <= 0) return '0%';
  const v = n * 100;
  if (v < 0.1) return '<0.1%';
  const s = v.toFixed(1);
  return s.endsWith('.0') ? `${Math.round(v)}%` : `${s}%`;
}

function renderCodex() {
  // ENEMIES
  if (els.codexEnemiesCount instanceof HTMLElement) {
    els.codexEnemiesCount.textContent = `${Array.isArray(ENEMIES) ? ENEMIES.length : 0}`;
  }
  if (els.codexEnemies instanceof HTMLElement) {
    clearEl(els.codexEnemies);
    const rates = computeEnemyEncounterRates();
    const list = Array.isArray(ENEMIES) ? ENEMIES : [];
    list.forEach((e, idx) => {
      const isBoss = idx === (typeof BOSS_ENEMY_INDEX === 'number' ? BOSS_ENEMY_INDEX : -1);
      const icon = isBoss ? '👑' : '⚔️';
      const r = rates.get(idx);
      const appear = isBoss
        ? 'Appears: Wave 3 100%'
        : (r ? `Appears: W1 ${formatPct(r.w1)} • W2 ${formatPct(r.w2)}` : 'Appears: —');
      const sub = `HP ${toSafeInt(e?.maxHp, 0)} • Heals ${toSafeInt(e?.healCharges, 0)} • ${appear}`;
      els.codexEnemies.appendChild(makeCodexEntry({
        icon,
        title: String(e?.name || 'Enemy'),
        types: Array.isArray(e?.types) ? e.types : [],
        sub,
        tag: isBoss ? 'Boss' : '',
        sprite: String(e?.sprite || ''),
        className: 'rpgCodexEntry--enemy',
      }));
    });
  }

  // ITEMS
  const itemList = Object.values(ITEM_DEFS || {});
  if (els.codexItemsCount instanceof HTMLElement) {
    els.codexItemsCount.textContent = `${itemList.length}`;
  }
  if (els.codexItems instanceof HTMLElement) {
    clearEl(els.codexItems);
    itemList
      .slice()
      .sort((a, b) => (rarityRank(a?.rarity) - rarityRank(b?.rarity)) || String(a?.name||'').localeCompare(String(b?.name||'')))
      .forEach((it) => {
        els.codexItems.appendChild(makeCodexEntry({
          icon: String(it?.icon || '🎒'),
          title: String(it?.name || it?.id || 'Item'),
          sub: String(it?.desc || ''),
          rightPill: makeRarityPill(it?.rarity),
        }));
      });
  }

  // GEAR
  const gearList = Object.values(GEAR_DEFS || {});
  if (els.codexGearCount instanceof HTMLElement) {
    els.codexGearCount.textContent = `${gearList.length}`;
  }
  if (els.codexGear instanceof HTMLElement) {
    clearEl(els.codexGear);

    const bySlot = { weapon: [], armor: [], trinket: [] };
    gearList.forEach((g) => {
      const slot = g?.slot;
      if (slot === 'weapon' || slot === 'armor' || slot === 'trinket') bySlot[slot].push(g);
    });

    for (const slot of EQUIP_SLOTS) {
      const header = document.createElement('div');
      header.className = 'rpgCodexTag';
      header.style.width = 'fit-content';
      header.textContent = `${EQUIP_SLOT_LABEL[slot]}`;
      els.codexGear.appendChild(header);

      const list = bySlot[slot]
        .slice()
        .sort((a, b) => {
          const bossA = a?.bossUnique ? 1 : 0;
          const bossB = b?.bossUnique ? 1 : 0;
          if (bossA != bossB) return bossA - bossB; // normal gear first, boss relics last
          return (rarityRank(a?.rarity) - rarityRank(b?.rarity)) || String(a?.name||'').localeCompare(String(b?.name||''));
        });

      list.forEach((g) => {
        const tag = g?.bossUnique ? 'Boss Relic' : '';
        els.codexGear.appendChild(makeCodexEntry({
          icon: String(g?.icon || '🧰'),
          title: String(g?.name || g?.id || 'Gear'),
          sub: String(g?.desc || ''),
          rightPill: makeRarityPill(g?.rarity),
          tag,
        }));
      });
    }
  }
}

// Exclude boss relics from the random drop pool (they are awarded only by bosses).
const GEAR_DROP_IDS = GEAR_IDS.filter((id) => !GEAR_DEFS[id]?.bossUnique);

// Precompute lists by slot (used for balanced drops and clean UI logic).
const GEAR_IDS_BY_SLOT = /** @type {Record<"weapon"|"armor"|"trinket", string[]>} */ ({
  weapon: GEAR_DROP_IDS.filter((id) => GEAR_DEFS[id]?.slot === "weapon"),
  armor: GEAR_DROP_IDS.filter((id) => GEAR_DEFS[id]?.slot === "armor"),
  trinket: GEAR_DROP_IDS.filter((id) => GEAR_DEFS[id]?.slot === "trinket"),
});
const GEAR_DROP_SLOTS = EQUIP_SLOTS.filter((s) => Array.isArray(GEAR_IDS_BY_SLOT[s]) && GEAR_IDS_BY_SLOT[s].length > 0);

const GEAR_IDS_BY_SLOT_RARITY = /** @type {Record<"weapon"|"armor"|"trinket", Record<RarityKey, string[]>>} */ ({
  weapon: {
    common: GEAR_IDS_BY_SLOT.weapon.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "common"),
    uncommon: GEAR_IDS_BY_SLOT.weapon.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "uncommon"),
    rare: GEAR_IDS_BY_SLOT.weapon.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "rare"),
    epic: GEAR_IDS_BY_SLOT.weapon.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "epic"),
    legendary: [],
  },
  armor: {
    common: GEAR_IDS_BY_SLOT.armor.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "common"),
    uncommon: GEAR_IDS_BY_SLOT.armor.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "uncommon"),
    rare: GEAR_IDS_BY_SLOT.armor.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "rare"),
    epic: GEAR_IDS_BY_SLOT.armor.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "epic"),
    legendary: [],
  },
  trinket: {
    common: GEAR_IDS_BY_SLOT.trinket.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "common"),
    uncommon: GEAR_IDS_BY_SLOT.trinket.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "uncommon"),
    rare: GEAR_IDS_BY_SLOT.trinket.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "rare"),
    epic: GEAR_IDS_BY_SLOT.trinket.filter((id) => (GEAR_DEFS[id]?.rarity || "common") === "epic"),
    legendary: [],
  },
});


// Only new heroes get starter gear. Existing saves remain unchanged.
const STARTING_GEAR = /** @type {Record<string, number>} */ ({ apprentice_ring: 1 });

/** @param {any} raw */
function sanitizeGearCounts(raw) {
  /** @type {Record<string, number>} */
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const id of GEAR_IDS) {
    const n = Math.max(0, toSafeInt(src[id], 0));
    if (n > 0) out[id] = clamp(n, 0, 99);
  }
  return out;
}

/** @param {any} raw */
function sanitizeBossUniques(raw) {
  /** @type {Record<string, boolean>} */
  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof k !== "string") continue;
    if (v) out[k] = true;
  }
  return out;
}

/** @param {any} id @param {Record<string, number>} inv @param {"weapon"|"armor"|"trinket"} slot */
function sanitizeEquippedGearId(id, inv, slot) {
  if (typeof id !== "string") return null;
  const def = GEAR_DEFS[id];
  if (!def) return null;
  if (def.slot !== slot) return null;
  const n = Math.max(0, toSafeInt(inv?.[id], 0));
  return n > 0 ? id : null;
}

/**
 * Accepts either:
 * - legacy string `equip` (treated as trinket)
 * - {weapon, armor, trinket}
 * @param {any} raw
 * @param {Record<string, number>} inv
 * @returns {{weapon:string|null, armor:string|null, trinket:string|null}}
 */
function sanitizeEquipSlots(raw, inv) {
  /** @type {{weapon:string|null, armor:string|null, trinket:string|null}} */
  const out = { weapon: null, armor: null, trinket: null };

  // Backwards compatible: old saves used a single `equip` string.
  if (typeof raw === "string") {
    out.trinket = sanitizeEquippedGearId(raw, inv, "trinket");
    return out;
  }

  const src = raw && typeof raw === "object" ? raw : {};
  out.weapon = sanitizeEquippedGearId(src.weapon, inv, "weapon");
  out.armor = sanitizeEquippedGearId(src.armor, inv, "armor");
  out.trinket = sanitizeEquippedGearId(src.trinket, inv, "trinket");
  return out;
}

/**
 * Aggregate bonuses from equipped slots.
 * @param {{weapon:string|null, armor:string|null, trinket:string|null}} slots
 */
function gearBonusesFromSlots(slots) {
  const ids = [slots.weapon, slots.armor, slots.trinket].filter((x) => typeof x === "string");
  let hpBonus = 0;
  let focusBonus = 0;
  let powerPct = 0;
  let healPct = 0;
  let drPct = 0;

  ids.forEach((id) => {
    const g = id && GEAR_DEFS[id] ? GEAR_DEFS[id] : null;
    if (!g) return;
    hpBonus += Math.max(0, toSafeInt(g.hpBonus, 0));
    focusBonus += Math.max(0, toSafeInt(g.focusBonus, 0));
    powerPct += clamp(Number(g.powerPct ?? 0), 0, 0.50);
    healPct += clamp(Number(g.healPct ?? 0), 0, 0.50);
    drPct += clamp(Number(g.drPct ?? 0), 0, 0.50);
  });

  // Keep stacking sane.
  powerPct = clamp(powerPct, 0, 0.50);
  healPct = clamp(healPct, 0, 0.50);
  drPct = clamp(drPct, 0, 0.50);

  return { hpBonus, focusBonus, powerPct, healPct, drPct, ids };
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
  const raw = localStorage.getItem(PROGRESS_KEY_PREFIX + heroId);
  if (!raw) {
    return {
      level: 1,
      xp: 0,
      spells: undefined,
      items: { ...STARTING_ITEMS },
      gear: { ...STARTING_GEAR },
      equipSlots: { weapon: null, armor: null, trinket: "apprentice_ring" },
      bossUniques: {},
    };
  }
  try {
    const obj = JSON.parse(raw);
    const level = clamp(toSafeInt(obj?.level, 1), 1, 99);
    const xp = Math.max(0, toSafeInt(obj?.xp, 0));
    const spells = Array.isArray(obj?.spells)
      ? obj.spells.filter((id) => typeof id === "string" && !!SPELLS_BY_ID[id])
      : undefined;
    const items = sanitizeItemCounts(obj?.items);
    const gear = sanitizeGearCounts(obj?.gear);

    // Prefer modern shape, but accept legacy `equip`.
    const rawSlots = obj?.equipSlots ?? obj?.equipment ?? obj?.equip;
    const equipSlots = sanitizeEquipSlots(rawSlots, gear);

    const bossUniques = sanitizeBossUniques(obj?.bossUniques);

    return { level, xp, spells, items, gear, equipSlots, bossUniques };
  } catch {
    return {
      level: 1,
      xp: 0,
      spells: undefined,
      items: { ...STARTING_ITEMS },
      gear: { ...STARTING_GEAR },
      equipSlots: { weapon: null, armor: null, trinket: "apprentice_ring" },
      bossUniques: {},
    };
  }
}


/**
 * @param {string} heroId
 * @param {{level:number,xp:number,spells?:string[],items?:Record<string,number>,gear?:Record<string,number>,equipSlots?:{weapon?:string|null,armor?:string|null,trinket?:string|null},equip?:string|null}} prog
 */
function saveHeroProgress(heroId, prog) {
  try {
    const payload = {
      level: Math.max(1, toSafeInt(prog.level, 1)),
      xp: Math.max(0, toSafeInt(prog.xp, 0)),
    };

    if (Array.isArray(prog.spells)) {
      payload.spells = prog.spells.filter((id) => typeof id === "string" && !!SPELLS_BY_ID[id]);
    }

    if (prog?.items && typeof prog.items === "object") {
      payload.items = sanitizeItemCounts(prog.items);
    }

    if (prog?.gear && typeof prog.gear === "object") {
      payload.gear = sanitizeGearCounts(prog.gear);
    }

    const inv = payload.gear || sanitizeGearCounts(prog.gear);

    // Accept either modern equipSlots or legacy equip string, then sanitize.
    const rawSlots = (prog?.equipSlots && typeof prog.equipSlots === "object") ? prog.equipSlots : prog?.equip;
    const slots = sanitizeEquipSlots(rawSlots, inv);
    payload.equipSlots = slots;

    // Back-compat for older builds: store trinket in `equip` too.
    payload.equip = slots.trinket;

    if (prog?.bossUniques && typeof prog.bossUniques === "object") {
      payload.bossUniques = sanitizeBossUniques(prog.bossUniques);
    }

    window.localStorage.setItem(PROGRESS_KEY_PREFIX + heroId, JSON.stringify(payload));
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

  const cid = String(c?.id || "").toLowerCase();

  // Mild per-hero tuning (kept close to the old roster).
  const preset = {
    relen: { maxHp: 20, focusStart: 2 },
    axel: { maxHp: 22, focusStart: 2 },
    mira: { maxHp: 21, focusStart: 2 },
    devante: { maxHp: 19, focusStart: 2 },
    elroy: { maxHp: 23, focusStart: 2 },
  }[cid] || { maxHp: 20, focusStart: 2 };

  // Game-page-only sprite override(s)
  let sprite = String(c?.image || "./assets/images/characters/relen.png");
  if (cid === "relen") sprite = "./assets/images/characters/relen-game.png";

  return {
    id: String(c?.id || "hero"),
    name: String(c?.name || "Hero"),
    types: safeTypes,
    typesLabel,
    maxHp: preset.maxHp,
    healCharges: 3,
    focusMax: 6,
    focusStart: preset.focusStart,
    sprite,
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
    sprite: "./assets/images/characters/relen-game.png",
    blurb: "Wind + Sight. A young prodigy with light-built precision.",
  },
  {
    id: "axel",
	    name: "Belle",
    types: /** @type {MagicType[]} */ (["Sound", "Fire"]),
    maxHp: 22,
    healCharges: 3,
    focusMax: 6,
    focusStart: 2,
    sprite: "./assets/images/characters/axel.png",
    blurb: "Sound + Fire. Resonant pulse with matchbright snap.",
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
    name: "Inkward Scribe",
    types: /** @type {MagicType[]} */ (["Sound", "Touch"]),
    maxHp: 25,
    healCharges: 1,
    profile: "soundTouch",
    sprite: "./assets/images/enemy-scribe.png",
  },
  {
    name: "Tidehand Alchemist",
    types: /** @type {MagicType[]} */ (["Touch", "Water"]),
    maxHp: 27,
    healCharges: 1,
    profile: "waterTouch",
    sprite: "./assets/images/enemy-tidehand.png",
    spriteIsPixel: false,
  },

  {
    name: "Chorusflame Knight",
    types: /** @type {MagicType[]} */ (["Sound", "Fire"]),
    maxHp: 31,
    healCharges: 1,
    profile: "soundFire",
    sprite: "./assets/images/enemy-chorusflame.png",
    spriteIsPixel: false,
  },

  {
    name: "Ravenwind Oracle",
    types: /** @type {MagicType[]} */ (["Sight", "Wind"]),
    maxHp: 26,
    healCharges: 1,
    profile: "windSight",
    sprite: "./assets/images/enemy-ravenwind.png",
    spriteIsPixel: false,
  },

  {
    name: "Verdant Scentwarden",
    types: /** @type {MagicType[]} */ (["SmellTaste", "Earth"]),
    maxHp: 28,
    healCharges: 1,
    profile: "smellEarth",
    sprite: "./assets/images/enemy-verdant-mender.png",
    spriteIsPixel: false,
  },

  {
    name: "Candlecrown Matron",
    types: /** @type {MagicType[]} */ (["Sight", "Sound"]),
    maxHp: 36,
    healCharges: 2,
    focusMax: 7,
    focusStart: 3,
    profile: "bossEclipse",
    sprite: "./assets/images/enemy-candle-queen.png",
  },
];


// --- Random encounter system (not tied to locations) ---
// Non-boss enemies are chosen per-wave using weighted probabilities.
// Wave 1 favors easier foes; Wave 2 favors tougher foes; Wave 3 is always a boss.
const BOSS_ENEMY_INDEX = ENEMIES.length - 1;
const VERDANT_ENEMY_INDEX = Math.max(0, ENEMIES.findIndex((e) => e.profile === "smellEarth"));

const NON_BOSS_ENEMY_INDICES = ENEMIES.map((_, i) => i).filter((i) => i !== BOSS_ENEMY_INDEX);

/**
 * Rough difficulty score for weighting.
 * (Higher means tougher.)
 */
function enemyDifficultyScore(tpl) {
  const hp = toSafeInt(tpl.maxHp, 20);
  const heals = toSafeInt(tpl.healCharges, 0);
  const focusMax = typeof tpl.focusMax === "number" ? tpl.focusMax : 6;
  // HP is the main signal; healing and extra focus add endurance.
  return hp + heals * 6 + Math.max(0, focusMax - 6) * 2;
}

/**
 * Weighted random choice.
 * @param {number[]} indices
 * @param {number[]} weights
 */
function weightedPick(indices, weights) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i] || 0);
  if (total <= 0) return indices[0];

  let r = Math.random() * total;
  for (let i = 0; i < indices.length; i++) {
    r -= Math.max(0, weights[i] || 0);
    if (r <= 0) return indices[i];
  }
  return indices[indices.length - 1];
}

const NON_BOSS_SORTED = [...NON_BOSS_ENEMY_INDICES]
  .map((i) => ({ i, s: enemyDifficultyScore(ENEMIES[i]) }))
  .sort((a, b) => a.s - b.s);

// Stronger contrast so wave 2 feels meaningfully tougher on average.
const WAVE1_WEIGHTS_BY_RANK = [10, 6, 3, 1];
const WAVE2_WEIGHTS_BY_RANK = [1, 3, 6, 9];

function pickRandomEnemyIndexForWave(waveIndex) {
  // Only randomize waves 1-2; boss is fixed.
  const isWave2 = waveIndex === 1;
  const weightsByRank = isWave2 ? WAVE2_WEIGHTS_BY_RANK : WAVE1_WEIGHTS_BY_RANK;

  const indices = NON_BOSS_SORTED.map((x) => x.i);
  const weights = NON_BOSS_SORTED.map((_, rank) => weightsByRank[rank] ?? 1);
  return weightedPick(indices, weights);
}

/**
 * Build a three-wave "enemy set" for one battle run.
 * @param {number} playerLevel
 */
function buildEnemySetForBattle(playerLevel) {
  const pLvl = Math.max(1, toSafeInt(playerLevel, 1));
  const w1i = pickRandomEnemyIndexForWave(0);

  // Wave 2: prefer tougher AND prefer variety (softly avoid repeating wave 1).
  let w2i = pickRandomEnemyIndexForWave(1);
  if (w2i === w1i && NON_BOSS_ENEMY_INDICES.length > 1) {
    // 70% chance to reroll once for variety.
    if (Math.random() < 0.70) {
      const altPool = NON_BOSS_ENEMY_INDICES.filter((i) => i !== w1i);
      // Use the same wave2 weighting, but restricted pool.
      const altSorted = NON_BOSS_SORTED.filter((x) => altPool.includes(x.i));
      const altIndices = altSorted.map((x) => x.i);
      const altWeights = altSorted.map((_, rank) => WAVE2_WEIGHTS_BY_RANK[rank] ?? 1);
      w2i = weightedPick(altIndices, altWeights);
    }
  }

  // Wave 3 is always the boss template.
  return [ENEMIES[w1i], ENEMIES[w2i], ENEMIES[BOSS_ENEMY_INDEX]];
}

const FALLBACK_LOCATIONS = [
  { id: "ember_plaza", name: "Ember Plaza", subtitle: "Warm stones. Hot tempers.", enemySet: [0, 1, BOSS_ENEMY_INDEX] },
  { id: "quartz_library", name: "Quartz Library", subtitle: "Quiet halls. Heavy secrets.", enemySet: [1, 2, BOSS_ENEMY_INDEX] },
  { id: "gale_rooftops", name: "Gale Rooftops", subtitle: "Open sky. Unstable footing.", enemySet: [0, 2, BOSS_ENEMY_INDEX] },
  { id: "mirror_tunnels", name: "Mirror Tunnels", subtitle: "Dim lights. Echoing steps.", enemySet: [0, 1, BOSS_ENEMY_INDEX] },
];


// Locations in-game are sourced from the Map dataset (data/map-locations.js) when available.
// This keeps the RPG in sync with the site's world map.
const GAME_LOCATION_IDS = ["arena", "market-central", "fey-forest", "gutterglass"];
const LOCATION_ENEMY_SETS = [
  [0, 1, BOSS_ENEMY_INDEX],
  [1, 2, BOSS_ENEMY_INDEX],
  [VERDANT_ENEMY_INDEX, 5, BOSS_ENEMY_INDEX],
  [0, 1, BOSS_ENEMY_INDEX],
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
// Unique boss relic per area (awarded on first boss clear per hero).
const BOSS_UNIQUE_GEAR_BY_LOCATION = /** @type {Record<string, string>} */ ({
  // Map-sourced game locations
  "arena": "arena_victor_blade",
  "market-central": "market_ledger_mail",
  "fey-forest": "feyleaf_circlet",
  "gutterglass": "gutterglass_prism",

  // Fallback locations (in case map data isn't present)
  "ember_plaza": "arena_victor_blade",
  "quartz_library": "feyleaf_circlet",
  "gale_rooftops": "gutterglass_prism",
  "mirror_tunnels": "market_ledger_mail",
});


/** @type {string|null} */
let activeLocationId = null;

/** @type {typeof ENEMIES} */
let activeEnemySet = [ENEMIES[0], ENEMIES[1], ENEMIES[BOSS_ENEMY_INDEX]];

function getLocationById(id) {
  return LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];
}

function setActiveLocation(id) {
  const loc = getLocationById(id);
  activeLocationId = loc.id;
  return loc;
}


  /**
   * Create a fresh enemy state from template.
   * @param {number} waveIndex
   */
  function makeEnemy(waveIndex, enemySet, playerLevel = 1) {
  const set = enemySet || activeEnemySet || ENEMIES;
  const t = set[waveIndex] ?? set[0] ?? ENEMIES[0];

  // Scaling philosophy:
  // - Enemies *do* scale with you so fights stay relevant...
  // - ...but they scale *slower* than the player so leveling still feels rewarding.
  // - Higher waves remain tougher primarily because their base templates are tougher.
  const pLvl = Math.max(1, toSafeInt(playerLevel, 1));
  const w = Math.max(0, toSafeInt(waveIndex, 0));
  // Enemies "catch up" to only a portion of your levels.
  // (0.55 means: when you gain 10 levels, enemies gain about 5 of them.)
  // Bosses scale even slower so you can eventually outgrow an area boss.
  const isBossTemplate = t.profile === "bossEclipse" || w >= 2;
  const ENEMY_LEVEL_CATCHUP = isBossTemplate ? 0.45 : 0.55;

  // Displayed level: your (partial) level + a wave bump.
  // Boss wave already has a huge base template, so its bump is smaller.
  const waveBump = isBossTemplate ? 1 : w;
  const lvl = Math.max(1, 1 + Math.floor((pLvl - 1) * ENEMY_LEVEL_CATCHUP) + waveBump);

  // Stat growth per enemy level.
  // Boss growth is gentler so Lv ~8 is a real "you can win" threshold.
  const hpRate = isBossTemplate ? 0.03 : 0.04;
  const powRate = isBossTemplate ? 0.02 : 0.025;
  const hpScale = 1 + (lvl - 1) * hpRate;
  const powScale = 1 + (lvl - 1) * powRate;

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
    stunned: 0,          // skips next turn
    enraged: false,

    // AI
    profile: t.profile,
    aiStep: 0,
    intent: null,        // filled at start of player's turn
    sprite: t.sprite,
    spriteIsPixel: t.spriteIsPixel !== false,
  };
}

  /** @param {ReturnType<typeof getHeroById>} pt */
  function makePlayerFromHero(pt) {
    const prog = loadHeroProgress(pt.id);
    const scaled = applyLevelToHero(pt, prog.level);
    const items = sanitizeItemCounts(prog.items);
    const gear = sanitizeGearCounts(prog.gear);

    // Backwards compatible: accept legacy `equip` and modern `equipSlots`.
    const equipSlots = sanitizeEquipSlots(prog.equipSlots ?? prog.equip, gear);
    const bonus = gearBonusesFromSlots(equipSlots);

    const bossUniques = sanitizeBossUniques(prog.bossUniques);

    const maxWithGear = scaled.maxHp + bonus.hpBonus;
    const focusMaxWithGear = scaled.focusMax + bonus.focusBonus;

    const savedSpells = Array.isArray(prog.spells) ? prog.spells : knownSpellIdsFor(pt.types, prog.level);
    let spells = sanitizeKnownSpellIds(savedSpells, pt.types, prog.level);
    startingSpellIdsFor(pt.types).forEach((id) => { if (!spells.includes(id)) spells.push(id); });
    spells = sanitizeKnownSpellIds(spells, pt.types, prog.level);

    return {
      id: pt.id,
      name: pt.name,
      types: pt.types,
      sprite: pt.sprite,

      // Spells are chosen on level-up (with starting spells always available).
      spells,
      pendingSpellQueue: [],

      // progression
      level: prog.level,
      xp: prog.xp,
      xpToNext: xpToNext(prog.level),
      powerMult: scaled.powerMult * (1 + bonus.powerPct),
      healMult: scaled.healMult * (1 + bonus.healPct),
      equipDR: bonus.drPct,
      baseMaxHp: pt.maxHp,
      baseFocusMax: pt.focusMax,

      // vitals
      hp: maxWithGear,
      max: maxWithGear,

      // statuses
      guarding: false,
      evading: false,
      burn: 0,
      bound: 0,

      // tactical item effects
      barrier: 0,          // next hit −30%
      damageBoost: 0,      // e.g. 1.3 for next damage

      // items (one-use consumables)
      items,

      // gear
      gear,
      equipSlots,
      bossUniques,

      // turn flag: allow 1 item per turn without ending the turn
      itemUsedThisTurn: false,

      // resources
      healCharges: pt.healCharges,
      focus: clamp(scaled.focusStart, 0, focusMaxWithGear),
      focusMax: focusMaxWithGear,
    };
  }


  function makeInitialState(enemySet = null, locationId = activeLocationId) {
  const loc = locationId ? getLocationById(locationId) : null;
  const pt = getActiveHero();
  const player = makePlayerFromHero(pt);

  // If no set was provided (or it looks incomplete), generate a fresh random encounter lineup.
  let set = Array.isArray(enemySet) && enemySet.length ? enemySet : null;
  if (!set || set.length < 3) {
    set = buildEnemySetForBattle(player.level);
  }

  // Normalize length (Wave 3 must be a boss).
  if (set.length < 3) {
    const w1 = set[0] || ENEMIES[0];
    const w2 = set[1] || w1;
    set = [w1, w2, ENEMIES[BOSS_ENEMY_INDEX]];
  } else {
    // Ensure the final slot is always the boss template.
    set = [set[0], set[1] || set[0], ENEMIES[BOSS_ENEMY_INDEX]];
  }

  // Keep global in sync so wave spawns use the same lineup.
  activeEnemySet = set;

  return {
    battleId: ++battleSerial,
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
  const pt = getActiveHero();
  const player = makePlayerFromHero(pt);
  const set = buildEnemySetForBattle(player.level);

  // Keep global in sync so other helpers have a consistent reference.
  activeEnemySet = set;

  return {
    battleId: ++battleSerial,
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


  const GAME_BUILD = "2026-02-16-random-encounters";


  // Load saved hero choice (if any)

  let battleSerial = 0;

  loadSavedHero();

  /** @type {ReturnType<typeof makeInitialState>} */
  let state = makeInitialState();
syncKnownSpells(false);

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


  // HP bar turns red under this fraction (e.g. 0.30 = 30%).
  const HP_LOW_THRESHOLD = 0.30;

  /** @param {HTMLElement|null} el @param {number} ratio */
  function setHpBar(el, ratio) {
    setBar(el, ratio);
    if (!el) return;
    const safe = clamp(ratio, 0, 1);
    el.classList.toggle("isLowHp", safe <= HP_LOW_THRESHOLD);
  }


  
function persistPlayerProgress() {
  const heroId = state?.player?.id || activeHeroId;
  if (!heroId) return;
  saveHeroProgress(heroId, {
    level: Math.max(1, toSafeInt(state.player.level, 1)),
    xp: Math.max(0, toSafeInt(state.player.xp, 0)),
    spells: Array.isArray(state.player.spells) ? state.player.spells : [],
    items: sanitizeItemCounts(state.player.items),
    gear: sanitizeGearCounts(state.player.gear),
    equipSlots: (state.player && typeof state.player.equipSlots === "object") ? state.player.equipSlots : undefined,
    bossUniques: (state.player && typeof state.player.bossUniques === "object") ? state.player.bossUniques : undefined,
  });
}

  /** Recompute scaled stats/multipliers for the current level.
   *  @param {boolean} onLevelUp
   */
  function syncPlayerLevel(onLevelUp = false) {
    const hero = getHeroById(state?.player?.id || activeHeroId);
    const lvl = Math.max(1, toSafeInt(state.player.level, 1));
    const scaled = applyLevelToHero(hero, lvl);


    // Apply gear bonuses (3-slot equipment). Back-compat: accept legacy `equip` string.
    state.player.gear = sanitizeGearCounts(state.player.gear);
    state.player.equipSlots = sanitizeEquipSlots(state.player.equipSlots ?? state.player.equip, state.player.gear);
    const bonus = gearBonusesFromSlots(state.player.equipSlots);

    const newMax = scaled.maxHp + bonus.hpBonus;
    const newFocusMax = scaled.focusMax + bonus.focusBonus;
    const newPowerMult = scaled.powerMult * (1 + bonus.powerPct);
    const newHealMult = scaled.healMult * (1 + bonus.healPct);

    const oldMax = toSafeInt(state.player.max, newMax);
    const oldFocusMax = toSafeInt(state.player.focusMax, newFocusMax);

    state.player.max = newMax;
    state.player.focusMax = newFocusMax;
    state.player.powerMult = newPowerMult;
    state.player.healMult = newHealMult;
    state.player.equipDR = bonus.drPct;
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
    let pendingAdded = 0;

    while (state.player.xp >= state.player.xpToNext) {
      state.player.xp -= state.player.xpToNext;
      state.player.level = Math.max(1, toSafeInt(state.player.level, 1) + 1);
      state.player.xpToNext = xpToNext(state.player.level);
      syncPlayerLevel(true);

      const { pendingAdded: addPending } = syncKnownSpells(true);
      pendingAdded += Math.max(0, toSafeInt(addPending, 0));

      leveled = true;
      addLog(`🌟 Level up! You are now Lv ${state.player.level}.`);
    }

    if (leveled) {
      // A little celebration without interrupting flow.
      showMoveBanner("Level Up", "Sight");

      // If a new spell choice unlocked, prompt immediately.
      if (pendingAdded > 0) {
        window.setTimeout(() => openNextSpellPick(), 180);
      }
    }

    persistPlayerProgress();
    render();
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
    if (!state.over && state.player.barrier > 0) parts.push("Barrier (next hit −30%)");
    if (!state.over && state.player.damageBoost > 1) parts.push("Power Rune (next damage x1.3)");
    if (!state.over && state.player.bound > 0) parts.push("Bound (next move weakened)");
    if (!state.over && state.player.burn > 0) parts.push(`Burning (${state.player.burn})`);
    return parts.length ? parts.join(" • ") : "Ready";
  }

  function statusLineForEnemy() {
    const parts = [];
    if (!state.over && state.enemy.enraged) parts.push("Enraged");
    if (!state.over && state.enemy.stunned > 0) parts.push("Stunned (skips next turn)");
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

    const isBoss =
      Array.isArray(state?.enemySet) &&
      state.enemySet.length >= 3 &&
      state.wave === state.enemySet.length - 1;

    // Visual cue: Wave 2 gets a subtle boost, and the final wave gets a BOSS badge.
    els.enemySprite.classList.toggle("is-phase2", state.wave === 1);
    els.enemySprite.classList.toggle("is-boss", isBoss);
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
    lance: 2,
    glare: 2,
    squall: 2,
    resonant: 2,
    resonate: 2,
    quake: 2,
    shatter: 2,
    mirrorbind: 2,
    stonebind: 2,
    hushbind: 2,
    wavebind: 2,
    surge: 2,
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

  if (e.profile === "bossEclipse") {
    // Boss pattern: mixes defense, control, and heavy hits.
    // Mana gating (below) will force a basic Strike when the boss can't afford a spell,
    // which naturally creates breathing room.
    const pattern = ["ward", "mirrorbind", "lance", "resonate", "ignite", "shatter", "siphon", "quake", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    if (next === "ignite" && p.burn > 0) next = "resonate";
    if (next === "mirrorbind" && p.bound > 0) next = "lance";
    if (next === "ward" && e.ward > 0) next = "attack";

    if (next === "ward") return { id: "ward", name: "Mirror Ward", type: null, base: 0, note: "Next hit reduced + reflects" };
    if (next === "mirrorbind") return { id: "mirrorbind", name: "Mirrorbind", type: "Touch", base: 3, note: "Applies Bind" };
    if (next === "lance") return { id: "lance", name: "Arcane Lance", type: "Sight", base: 7, note: "" };
    if (next === "resonate") return { id: "resonate", name: "Resonant Blast", type: "Sound", base: 6, note: "" };
    if (next === "ignite") return { id: "ignite", name: "Ignite", type: "Fire", base: 4, note: "Applies Burn (2)" };
    if (next === "shatter") return { id: "shatter", name: "Shatter", type: "Earth", base: 6, note: "Punishes Guard" };
    if (next === "siphon") return { id: "siphon", name: "Siphon", type: "Sight", base: 4, note: "Heals enemy for 3" };
    if (next === "quake") return { id: "quake", name: "Quake", type: "Earth", base: 7, note: "Shakes through guard" };
    return { id: "attack", name: "Strike", type: "Sight", base: 4, note: "" };
  }
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





  if (e.profile === "soundFire") {
    const pattern = ["ignite", "resonate", "ward", "resonate", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    // If you're already burning, they don't waste a turn re-igniting.
    if (next === "ignite" && p.burn > 0) next = "resonate";
    if (next === "ward" && e.ward > 0) next = "attack";

    if (next === "ignite") return { id: "ignite", name: "Ignite", type: "Fire", base: 4, note: "Applies Burn (2)" };
    if (next === "resonate") return { id: "resonate", name: "Resonant Blast", type: "Sound", base: 6, note: "" };
    if (next === "ward") return { id: "ward", name: "Mirror Ward", type: null, base: 0, note: "Next hit reduced + reflects" };
    return { id: "attack", name: "Strike", type: "Sound", base: 4, note: "" };
  }
  if (e.profile === "waterTouch") {
    const pattern = ["surge", "wavebind", "fortify", "surge", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    // If burn is present (either side), prioritize Surging Current to douse it.
    if (next !== "surge" && (p.burn > 0 || e.burn > 0)) next = "surge";

    // If you're already bound, they pivot to water damage.
    if (next === "wavebind" && p.bound > 0) next = "surge";

    if (next === "surge") return { id: "surge", name: "Surging Current", type: "Water", base: 5, note: "Douses Burn" };
    if (next === "wavebind") return { id: "wavebind", name: "Wavebind", type: "Touch", base: 3, note: "Applies Bind" };
    if (next === "fortify") return { id: "fortify", name: "Brineguard", type: null, base: 0, note: "Next hit reduced" };
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


  if (e.profile === "smellEarth") {
    const pattern = ["attack", "quake", "fortify", "shatter", "attack"];
    let next = pattern[e.aiStep % pattern.length];

    // Avoid wasting a turn re-fortifying.
    if (next === "fortify" && e.fortified > 0) next = "attack";

    if (next === "quake") return { id: "quake", name: "Quake", type: "Earth", base: 6, note: "Shakes through guard" };
    if (next === "fortify") return { id: "fortify", name: "Fortify", type: null, base: 0, note: "Next hit reduced" };
    if (next === "shatter") return { id: "shatter", name: "Shatter", type: "Earth", base: 5, note: "Punishes Guard" };
    return { id: "attack", name: "Scented Swipe", type: "SmellTaste", base: 4, note: "" };
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
    els.enemyIntentText.textContent = `Intent: ${intent.name} (${intent.type} x${fmtMult(typed.eff)}${badge})`;
  }

  // --------------------
  // Defenses + statuses
  // --------------------

  /**
   * Apply enemy defenses. Returns {final, reflected}.
   * @param {number} incoming
   */
  function applyEnemyDefenses(incoming, opts = {}) {
    let final = incoming;
    let reflected = 0;

    const pierce = clamp(Number(opts?.piercePct ?? 0), 0, 1);
    const noReflect = !!opts?.noReflect;

    // Mirror ward: reduction + reflect (can be pierced / reflect suppressed).
    if (!opts?.ignoreWard && state.enemy.ward > 0) {
      const before = final;
      const mult = 0.6 + 0.4 * pierce;
      final = Math.ceil(final * mult);

      const reflFactor = noReflect ? 0 : (0.25 * (1 - pierce));
      const refl = Math.floor(before * reflFactor);
      if (refl > 0) reflected = Math.max(reflected, refl);

      state.enemy.ward = 0;
      const note = pierce > 0.01 ? " (partially pierced)" : "";
      const back = refl > 0 ? ` and bites back (${refl}).` : ".";
      addLog(`A mirror ward bends the strike (${before} → ${final})${note}${back}`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
    }

    // Fortify: reduction (can be pierced)
    if (!opts?.ignoreFortify && state.enemy.fortified > 0) {
      const before = final;
      const mult = 0.7 + 0.3 * pierce;
      final = Math.ceil(final * mult);
      state.enemy.fortified = 0;
      const note = pierce > 0.01 ? " (pierced)" : "";
      addLog(`${state.enemy.name} is fortified (${before} → ${final})${note}.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
    }

    // Brace: reduction (can be pierced)
    if (!opts?.ignoreGuard && state.enemy.guarding) {
      const before = final;
      const mult = 0.5 + 0.5 * pierce;
      final = Math.floor(final * mult);
      state.enemy.guarding = false;
      const note = pierce > 0.01 ? " (pierced)" : "";
      addLog(`${state.enemy.name} braces (${before} → ${final})${note}.`);
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

    // Barrier (from item): reduce next hit by 30%
    if (state.player.barrier > 0) {
      const before = final;
      final = Math.ceil(final * 0.7);
      state.player.barrier = 0;
      addLog(`A barrier absorbs part of the blow (${before} → ${final}).`);
      playAnim(els.playerSprite, "rpgAnim-guard");
      spawnFx("guard", "player");
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

    // Equipment passive: constant damage reduction (after other defenses)
    const dr = clamp(Number(state.player.equipDR ?? 0), 0, 0.50);
    if (final > 0 && dr > 0) {
      const before = final;
      final = Math.max(0, Math.ceil(final * (1 - dr)));
      if (final !== before) {
        const slots = (state?.player?.equipSlots && typeof state.player.equipSlots === "object")
          ? state.player.equipSlots
          : sanitizeEquipSlots(state?.player?.equip, sanitizeGearCounts(state?.player?.gear));

        const ids = [slots.weapon, slots.armor, slots.trinket].filter((x) => typeof x === "string");
        const label = ids.length
          ? ids.map((id) => `${GEAR_DEFS[id].icon} ${GEAR_DEFS[id].name}`).join(", ")
          : "Your gear";

        addLog(`${label} dampens the hit (${before} → ${final}).`);
      }
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
    const isBossWave = Array.isArray(state.enemySet) && state.enemySet.length >= 3 && state.wave === state.enemySet.length - 1;
    setText(els.enemyName, `${state.enemy.name} Lv ${enemyLv} (Wave ${state.wave + 1}/${state.enemySet.length}${isBossWave ? " • BOSS" : ""})`);
    setTypeLine(els.playerTypeText, state.player.types);
    setTypeLine(els.enemyTypeText, state.enemy.types);

    // Equipment (Weapon / Armor / Trinket)
    if (els.playerEquipText instanceof HTMLElement) {
      const slots = (state?.player?.equipSlots && typeof state.player.equipSlots === "object")
        ? state.player.equipSlots
        : sanitizeEquipSlots(state?.player?.equip, sanitizeGearCounts(state?.player?.gear));

      const parts = EQUIP_SLOTS.map((slot) => {
        const id = slots[slot];
        const g = id && GEAR_DEFS[id] ? GEAR_DEFS[id] : null;
        return `${EQUIP_SLOT_LABEL[slot]}: ${g ? `${g.icon} ${g.name} (${rarityLabel(g.rarity || "common")})` : "—"}`;
      });

      els.playerEquipText.textContent = `Equipment: ${parts.join(" • ")}`;
    }
    updateSpellPickButtonUI();

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
      // Normalize visual size across different sprite padding.
      autoScaleSprite(els.enemySpriteImg, { target: 0.93, max: 2.85, fillH: 0.86 });
      // Pixel-art enemies stay crisp, but allow portrait-style enemy art too.
      const enemyIsPortrait = state.enemy.spriteIsPixel === false;
      els.enemySpriteImg.classList.toggle("isPixel", !enemyIsPortrait);
    }

    // Player sprite swap (hero selection)
    if (els.playerSpriteImg instanceof HTMLImageElement && state.player.sprite) {
      if (els.playerSpriteImg.getAttribute("src") !== state.player.sprite) {
        els.playerSpriteImg.setAttribute("src", state.player.sprite);
      }

      // Normalize visual size across different sprite padding.
      autoScaleSprite(els.playerSpriteImg, { target: 0.93, max: 2.85, fillH: 0.86 });

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

    if (els.attackBtn instanceof HTMLButtonElement) {
      const atkLabel = TYPE_META[atkType]?.label ?? atkType;
      // Add a small type icon next to the Attack button label.
      const atkIcon = typeIcon(atkType);
      els.attackBtn.classList.add("hasTypeIcon");
      els.attackBtn.innerHTML = `<span class="btnTypeIcon" aria-hidden="true">${atkIcon}</span><span class="btnTypeText">Attack (${atkLabel} x${fmtMult(atkPrev.overall)} | +1 Mana)</span>`;
      els.attackBtn.dataset.type = atkType;
    }
    // Spells unlock on level-up and are rendered dynamically.
    const spells = getKnownSpells();


    // Add type icons next to the Magic button (based on the spell types you currently know).
    // If you know spells of multiple types, we show a small cluster of icons.
    if (els.magicToggle instanceof HTMLButtonElement) {
      const uniqTypes = Array.from(new Set(spells.map((s) => s.type)));
      const iconTypes = uniqTypes.length ? uniqTypes : [playerPrimaryType()];
      const icons = iconTypes.map((t) => typeIcon(t)).join("");
      els.magicToggle.classList.add("hasTypeIcon");
      els.magicToggle.innerHTML = `<span class="btnTypeIcon" aria-hidden="true">${icons}</span><span class="btnTypeText">Magic</span>`;
      if (iconTypes[0]) els.magicToggle.dataset.type = iconTypes[0];
    }

    if (els.healBtn instanceof HTMLButtonElement) {
	      els.healBtn.textContent = `Heal (${healCost} Mana, ${state.player.healCharges})`;
	      // Hover/focus preview shows the exact heal amount; keep the tooltip accurate too.
	      const amt = previewHealAmount();
	      els.healBtn.title = `Heals ${amt} HP`;
    }

    // HP
    setText(els.playerHpText, `HP ${playerHp} / ${state.player.max}`);
    setText(els.enemyHpText, `HP ${enemyHp} / ${state.enemy.max}`);
    setHpBar(els.playerHpFill, playerHp / state.player.max);
    setHpBar(els.enemyHpFill, enemyHp / state.enemy.max);

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
    if (disableActions) {
      closeMagicMenu();
      closeInventoryMenu();
    }

    // Render spell menu with up-to-date enable/disable state.
    renderSpellMenu(spells, isPlayerTurn, focus, boundExtra);

    // Render items menu (inventory) with up-to-date enable/disable state.
    renderItemMenu(isPlayerTurn);

    // Render gear menu (equipment) with up-to-date enable/disable state.
    renderGearMenu(isPlayerTurn);

    const canHeal = isPlayerTurn && state.player.healCharges > 0 && focus >= healCost;

    if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.disabled = disableActions;
    if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.disabled = disableActions;
    const hasAnySpell = spells.length > 0;
    if (els.magicToggle instanceof HTMLButtonElement) els.magicToggle.disabled = disableActions || !hasAnySpell;

    if (els.inventoryToggle instanceof HTMLButtonElement) els.inventoryToggle.disabled = disableActions;
    if (els.inventoryItemsShortcut instanceof HTMLButtonElement) els.inventoryItemsShortcut.disabled = disableActions;
    if (els.healBtn instanceof HTMLButtonElement) els.healBtn.disabled = !canHeal;
    if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.disabled = false;
  }

  function endGame(message) {
    state.over = true;
    addLog(message);
    if (state.enemy.hp <= 0) playAnim(els.enemySprite, "rpgAnim-faint");
    if (state.player.hp <= 0) playAnim(els.playerSprite, "rpgAnim-faint");
    render();
    if (state.player.hp <= 0) {
      openDefeatScreen(message || "You were defeated.");
    }

  }

  // --------------------
  // Items: inventory + deterministic loot
  // --------------------

  /** @param {string} itemId @param {number} count */
  function gainItem(itemId, count = 1) {
    if (!ITEM_DEFS[itemId]) return;
    if (!state.player.items || typeof state.player.items !== "object") state.player.items = {};
    const prev = Math.max(0, toSafeInt(state.player.items[itemId], 0));
    const next = clamp(prev + Math.max(1, toSafeInt(count, 1)), 0, 99);
    state.player.items[itemId] = next;
    const def = ITEM_DEFS[itemId];
    addLog(`🎁 Found: ${def.icon} ${def.name} [${rarityLabel(def.rarity)}] (x${Math.max(1, toSafeInt(count, 1))}).`);
    persistPlayerProgress();
  }

  /** @param {string} itemId */
  function consumeItem(itemId) {
    const inv = state?.player?.items && typeof state.player.items === "object" ? state.player.items : {};
    const prev = Math.max(0, toSafeInt(inv[itemId], 0));
    if (prev <= 0) return false;
    const next = prev - 1;
    if (next <= 0) delete inv[itemId];
    else inv[itemId] = next;
    state.player.items = inv;
    persistPlayerProgress();
    return true;
  }

  /** @param {string} gearId */
  function gainGear(gearId, count = 1) {
    if (!GEAR_DEFS[gearId]) return;
    if (!state.player.gear || typeof state.player.gear !== "object") state.player.gear = {};
    const prev = Math.max(0, toSafeInt(state.player.gear[gearId], 0));
    const next = clamp(prev + Math.max(1, toSafeInt(count, 1)), 0, 99);
    state.player.gear[gearId] = next;
    const def = GEAR_DEFS[gearId];
    addLog(`🧰 Found gear: ${def.icon} ${def.name} [${rarityLabel(def.rarity)}] (x${Math.max(1, toSafeInt(count, 1))}).`);
    persistPlayerProgress();
  }


  /**
   * Award a one-time boss relic for the current location (per hero).
   * Returns the awarded gearId, or null if none/already claimed.
   * @param {string|null} locationId
   */
  function awardBossRelicIfEligible(locationId) {
    if (!locationId || !state?.player) return null;
    const gearId = BOSS_UNIQUE_GEAR_BY_LOCATION?.[locationId] || null;
    if (!gearId || !GEAR_DEFS[gearId]) return null;
    if (!state.player.bossUniques || typeof state.player.bossUniques !== "object") state.player.bossUniques = {};
    if (state.player.bossUniques[locationId]) return null;
    state.player.bossUniques[locationId] = true;
    gainGear(gearId, 1);
    return gearId;
  }

  /** @param {number} waveIndex */
  function lootForWave(waveIndex) {
    // Loot is split into: consumables + (rare) gear.
    // Items: equal chance per item, small chance of none.
    // Gear: fairly common (about 1 in 4 victories).
    const isBossWave = waveIndex >= 2;
    const result = { itemId: null, gearId: null };

    if (!isBossWave) {
      const NONE_CHANCE = 0.25;
      if (Math.random() >= NONE_CHANCE && Array.isArray(ITEM_IDS) && ITEM_IDS.length > 0) {
        const wanted = rollRarity(ITEM_RARITY_WEIGHTS);
        const pick = pickByRarity(ITEM_IDS_BY_RARITY, wanted);
        result.itemId = pick && ITEM_DEFS[pick] ? pick : null;
      }
    }

    // Gear chance: ~25% per cleared wave.
    // Note: we allow this on boss waves too so the overall feel stays consistent.
    const gearChance = 0.25;

    // Pick a slot first, then a random piece within that slot (keeps drops varied across Weapon/Armor/Trinket).
    if (Math.random() < gearChance && Array.isArray(GEAR_DROP_SLOTS) && GEAR_DROP_SLOTS.length > 0) {
      const slot = GEAR_DROP_SLOTS[Math.floor(Math.random() * GEAR_DROP_SLOTS.length)];
      const pools = GEAR_IDS_BY_SLOT_RARITY?.[slot];
      const wanted = rollRarity(GEAR_RARITY_WEIGHTS);
      const pick = pickByRarity(pools || /** @type {any} */ ({}), wanted);
      result.gearId = pick && GEAR_DEFS[pick] ? pick : null;
    }

    return result;
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

        // Loot: random consumable and (rarer) gear.
    const loot = lootForWave(state.wave);
    const parts = [];
    if (loot?.itemId) {
      const d = ITEM_DEFS[loot.itemId];
      if (d) {
        gainItem(loot.itemId, 1);
        parts.push(`${d.icon} ${d.name} [${rarityLabel(d.rarity)}] (x1)`);
      }
    }
    if (loot?.gearId) {
      const g = GEAR_DEFS[loot.gearId];
      if (g) {
        gainGear(loot.gearId, 1);
        parts.push(`${g.icon} ${g.name} [${rarityLabel(g.rarity)}] (Gear)`);
      }
    }

    const lootLine = () => parts.length ? `Picked up: ${parts.join(' + ')}` : 'No loot this time.';

    playAnim(els.enemySprite, "rpgAnim-faint");

    const nextIndex = state.wave + 1;
    const isFinal = nextIndex >= state.enemySet.length;

    // Boss relic (one-time per location per hero)
    let bossRelicId = null;
    if (isFinal && state.wave >= 2) {
      bossRelicId = awardBossRelicIfEligible(state.locationId || null);
      if (bossRelicId) {
        const rg = GEAR_DEFS[bossRelicId];
        if (rg) parts.unshift(`${rg.icon} ${rg.name} [${rarityLabel(rg.rarity)}] (Boss Relic)`);
      }
    }

    // Lock controls and show a brief victory/loot screen for ~3 seconds.
    setPhase("loot");
    const title = isFinal ? "Victory!" : `Wave ${state.wave + 1} cleared!`;
    const subtitle = isFinal ? "You collect your spoils." : "You collect your spoils.";
    openLootScreen(title, subtitle, lootLine());
    render();

    const myBattle = state.battleId;

    // Remember what should happen after the loot screen closes (timer or Escape).
    lootResolve = { battleId: myBattle, isFinal, nextIndex };

    if (lootTimer) window.clearTimeout(lootTimer);
    lootTimer = window.setTimeout(() => {
      // If the player started a new battle, do nothing.
      if (!state || state.battleId !== myBattle) return;
      closeLootScreen();
      lootTimer = 0;
    }, 3000);
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

    // New turn = items refresh (1 item per turn).
    if (phase === "player" && state && state.player) state.player.itemUsedThisTurn = false;
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
    lockBtn(els.inventoryToggle, locked);
    lockBtn(els.inventoryItemsShortcut, locked);
    lockBtn(els.windBtn, locked);
    lockBtn(els.waterBtn, locked);
    lockBtn(els.soundBtn, locked);
    lockBtn(els.smellTasteBtn, locked);
    lockBtn(els.fireBtn, locked);
    lockBtn(els.explainBtn, locked);

    // Dynamic spell buttons inside the Magic menu.
    if (els.magicMenu instanceof HTMLElement) {
      els.magicMenu.querySelectorAll("button[data-spell-id]").forEach((b) => {
        if (b instanceof HTMLButtonElement) b.disabled = locked;
      });
    }

    // Dynamic buttons inside the Inventory menu.
    if (els.inventoryMenu instanceof HTMLElement) {
      els.inventoryMenu.querySelectorAll("button").forEach((b) => {
        if (b instanceof HTMLButtonElement) b.disabled = locked && b.id !== "restartBtn";
      });
    }

    if (locked) {
      closeMagicMenu();
      closeInventoryMenu();
    }

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

    // Stun: skip the enemy's action once (burn already ticked above).
    if ((state.enemy.stunned ?? 0) > 0) {
      state.enemy.stunned = Math.max(0, toSafeInt(state.enemy.stunned, 0) - 1);
      showMoveBanner("Stunned", "Sight");
      addLog(`${state.enemy.name} is stunned and loses the turn.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      spawnFx("guard", "enemy");
      render();
      queuePlayerTurn();
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
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.playerSprite, "rpgAnim-hit");
    spawnFloat(`-${afterDef}`, "player", "dmg", typed.eff);

    // Apply deterministic status effects
    if (intent.id === "ignite") {
      p.burn = Math.max(p.burn, 2);
      addLog("Flame clings to you (burn).");
    }

    if (intent.id === "surge") {
      let did = false;
      if (p.burn > 0) {
        p.burn = 0;
        did = true;
      }
      if (e.burn > 0) {
        e.burn = 0;
        did = true;
      }
      if (did) addLog("💧 The surge douses the flames.");
    }
    if (intent.id === "stonebind" || intent.id === "mirrorbind" || intent.id === "hushbind" || intent.id === "wavebind") {
  p.bound = 1;
  addLog(
    intent.id === "stonebind"
      ? "Stonebind locks your movement (bind)."
      : intent.id === "hushbind"
        ? "Hushbind seals your motion (bind)."
        : intent.id === "wavebind"
          ? "Wavebind tethers your limbs (bind)."
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
    closeInventoryMenu();

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


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, atkType);
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You strike ${state.enemy.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx(fxKindForType(atkType), "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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

  /**
   * Cast a spell by id (spells unlock automatically based on level).
   * @param {string} spellId
   */
  function playerCastSpell(spellId) {
    if (isGameOver()) return;
    if (state.phase !== "player") return;
    closeMagicMenu();
    closeInventoryMenu();

    const spell = SPELLS_BY_ID[spellId];
    if (!spell) {
      addLog("That spell isn't in your spellbook.");
      render();
      return;
    }

    if (!playerHasType(spell.type)) {
      addLog("Your hero can't use that kind of magic.");
      render();
      return;
    }

    const extra = state.player.bound > 0 ? 1 : 0;
    const cost = Math.max(0, toSafeInt(spell.baseCost, 0) + extra);
    if (state.player.focus < cost) {
      addLog("Not enough Mana.");
      render();
      return;
    }

    showMoveBanner(spell.name, spell.type);
    playAnim(els.playerSprite, "rpgAnim-attack");

    const hooksBefore = Array.isArray(spell.hooksBefore) ? spell.hooksBefore : [];
    const hooksAfter = Array.isArray(spell.hooksAfter) ? spell.hooksAfter : [];

    // Before-hit hooks
    if (hooksBefore.includes("breakDefenses")) {
      if (state.enemy.ward > 0 || state.enemy.fortified > 0 || state.enemy.guarding) {
        state.enemy.ward = 0;
        state.enemy.fortified = 0;
        state.enemy.guarding = false;
        addLog("You shatter the enemy's defenses.");
      }
    }

    // Damage is level-scaled.
    let base = scaledPlayerBase(toSafeInt(spell.baseDamage, 1));

    // Bind weakens next move (after cost is computed).
    if (state.player.bound > 0) {
      base = Math.max(1, base - 2);
      state.player.bound = 0;
      addLog("Bind dulls your spell (−2).");
    }


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, spell.type);
    const piercePct = typeof spell.piercePct === "number" ? spell.piercePct : Number(spell.piercePct) || 0;
    const def = applyEnemyDefenses(typed.scaled, {
      piercePct,
      noReflect: !!spell.noReflect,
    });

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(`You cast ${spell.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);

    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx(fxKindForType(spell.type), "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

    // Mirror ward reflection (if any)
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

    // After-hit hooks
    for (const hook of hooksAfter) {
      if (hook === "gusted") {
        state.enemy.gusted = true;
        addLog("💨 Gusted: enemy's next hit is softened.");
      } else if (hook === "evade") {
        state.player.evading = true;
        addLog("🕊️ Evading: your next hit is softened.");
        spawnFx("guard", "player");
      } else if (hook === "douse") {
        let did = false;
        if (state.enemy.burn > 0) {
          state.enemy.burn = 0;
          did = true;
        }
        if (state.player.burn > 0) {
          state.player.burn = 0;
          did = true;
        }
        if (did) addLog("💧 Flames are doused.");
      } else if (hook === "burn1" || hook === "burn2") {
        const n = hook === "burn1" ? 1 : 2;
        state.enemy.burn = Math.max(state.enemy.burn, n);
        addLog(`🔥 Burn applied (${n}).`);
      } else if (hook.startsWith("scent")) {
        const n = Math.max(0, toSafeInt(hook.replace("scent", ""), 0));
        if (n > 0) {
          state.enemy.scented = Math.max(state.enemy.scented, n);
          addLog(`👃 Scented (${n}).`);
        }
      } else if (hook.startsWith("mana+")) {
        const n = Math.max(0, toSafeInt(hook.replace("mana+", ""), 0));
        if (n > 0) {
          gainFocus(n);
          addLog(`✨ Mana +${n}.`);
        }
      } else if (hook.startsWith("heal+")) {
        const n = Math.max(0, toSafeInt(hook.replace("heal+", ""), 0));
        if (n > 0) {
          const before = state.player.hp;
          state.player.hp = clamp(state.player.hp + n, 0, state.player.max);
          const healed = state.player.hp - before;
          if (healed > 0) {
            addLog(`💚 Healed ${healed}.`);
            spawnFx("heal", "player");
            spawnFloat(`+${healed}`, "player", "heal", null);
          }
        }
      } else if (hook.startsWith("drainEnemyMana+")) {
        const n = Math.max(0, toSafeInt(hook.replace("drainEnemyMana+", ""), 0));
        if (n > 0) {
          const before = state.enemy.focus;
          spendEnemyFocus(n);
          const drained = Math.max(0, before - state.enemy.focus);
          if (drained > 0) addLog(`🔻 Drained ${drained} enemy Mana.`);
        }
      }
    }

    spendFocus(cost);

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} is defeated.`);
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


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, "Wind");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You send a wind blade for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
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


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, "Water");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You crash water onto ${state.enemy.name} for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx("water", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
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
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx("sound", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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


  if (state.player.damageBoost > 1) {
    const before = base;
    base = Math.max(1, Math.round(base * state.player.damageBoost));
    state.player.damageBoost = 0;
    addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
  }

  const typed = computeTypedDamage("player", "enemy", base, "SmellTaste");
  const def = applyEnemyDefenses(typed.scaled);

  state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
  addLog(`You release an aroma hex for ${def.final} damage.`);
  if (typed.note) addLog(typed.note);
  setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
  playAnim(els.enemySprite, "rpgAnim-hit");
  spawnFx("smell", "enemy");
  spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, "Fire");
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You hurl flame for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx("fire", "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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
      addLog("Bind blurs your casting (−2).");
    }


    if (state.player.damageBoost > 1) {
      const before = base;
      base = Math.max(1, Math.round(base * state.player.damageBoost));
      state.player.damageBoost = 0;
      addLog(`🗡️ Power Rune empowers your damage (${before} → ${base}).`);
    }

    const typed = computeTypedDamage("player", "enemy", base, t);
    const def = applyEnemyDefenses(typed.scaled);

    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);
    addLog(`You channel ${label} magic for ${def.final} damage.`);
    if (typed.note) addLog(typed.note);
    setEffectBanner(`${typed.tierLabel} (x${fmtMult(typed.eff)})`, typed.bannerTone);
    playAnim(els.enemySprite, "rpgAnim-hit");
    spawnFx(fxKindForType(t), "enemy");
    spawnFloat(`-${def.final}`, "enemy", "dmg", typed.eff);

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
    closeInventoryMenu();

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
    }

    showMoveBanner("Heal", "Touch");
    playAnim(els.playerSprite, "rpgAnim-heal");
    spawnFx("heal", "player");

    const healMult = typeof state.player.healMult === "number" ? state.player.healMult : 1;

    // Healing should be a meaningful tempo choice, not a button that gets erased immediately.
    // Scale primarily off Max HP (so it stays relevant), with a small level/gear multiplier.
    const maxHp = Math.max(1, toSafeInt(state.player.max, 1));
    const hpRatio = maxHp > 0 ? state.player.hp / maxHp : 1;

    // Baseline: ~28% max HP + a small scaling term.
    let heal = Math.round(maxHp * 0.28 + 4 * healMult);

    // Emergency bump when you're low.
    if (hpRatio <= 0.35) heal += Math.round(maxHp * 0.08);

    heal = Math.max(1, heal);
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.max);
    const actual = state.player.hp - before;

    if (actual > 0) spawnFloat(`+${actual}`, "player", "heal", null);

    state.player.healCharges = Math.max(0, state.player.healCharges - 1);
    spendFocus(cost);

    // A small "afterglow" shield so healing isn't immediately undone by the enemy's next swing.
    // Uses the existing Barrier status (next hit −30%).
    if (!(state.player.barrier > 0)) {
      state.player.barrier = 1;
      spawnFx("guard", "player");
      addLog("🛡️ A gentle ward settles around you (next hit −30%).");
    }

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
    closeInventoryMenu();

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

  /** @param {string} itemId */
  function playerUseItem(itemId) {
    if (isGameOver()) return;
    if (state.phase !== "player") return;

    if (state.player.itemUsedThisTurn) {
      addLog("You already used an item this turn.");
      render();
      return;
    }

    closeMagicMenu();


    const def = ITEM_DEFS[itemId];
    if (!def) {
      addLog("That item doesn't exist.");
      render();
      return;
    }

    const inv = state?.player?.items && typeof state.player.items === "object" ? state.player.items : {};
    const have = Math.max(0, toSafeInt(inv[itemId], 0));
    if (have <= 0) {
      addLog(`You don't have any ${def.name} left.`);
      render();
      return;
    }

    if (!itemCanUse(itemId)) {
      // Don't waste it.
      addLog(`${def.name} would have no effect right now.`);
      render();
      return;
    }

    // Consume first so the UI stays honest even if something throws later.
    if (!consumeItem(itemId)) {
      addLog(`You don't have any ${def.name} left.`);
      render();
      return;
    }
    // Apply effect (simple + readable)
    if (itemId === "potion") {
      const amount = 7;
      const before = state.player.hp;
      state.player.hp = clamp(state.player.hp + amount, 0, state.player.max);
      const actual = state.player.hp - before;
      showMoveBanner(`${def.name}`, "Touch");
      playAnim(els.playerSprite, "rpgAnim-heal");
      spawnFx("heal", "player");
      if (actual > 0) spawnFloat(`+${actual}`, "player", "heal", null);
      addLog(`You use ${def.name} (+${actual} HP).`);
    } else if (itemId === "ether") {
      const before = state.player.focus;
      gainFocus(2);
      const actual = state.player.focus - before;
      showMoveBanner(`${def.name}`, "Sight");
      playAnim(els.playerSprite, "rpgAnim-heal");
      spawnFx("sight", "player");
      addLog(`You use ${def.name} (+${actual} Mana).`);
    } else if (itemId === "cleanse") {
      const b = Math.max(0, toSafeInt(state.player.burn, 0));
      const bd = Math.max(0, toSafeInt(state.player.bound, 0));
      state.player.burn = 0;
      state.player.bound = 0;
      showMoveBanner(`${def.name}`, "Touch");
      playAnim(els.playerSprite, "rpgAnim-heal");
      spawnFx("touch", "player");
      const parts = [];
      if (b > 0) parts.push("Burn");
      if (bd > 0) parts.push("Bind");
      addLog(`You use ${def.name} (cleared ${parts.join(" and ")}).`);
    } else if (itemId === "bomb") {
      const dmg = 6;
      showMoveBanner(`${def.name}`, "Fire");
      playAnim(els.playerSprite, "rpgAnim-attack");
      spawnFx("fire", "enemy");
      state.enemy.hp = clamp(state.enemy.hp - dmg, 0, state.enemy.max);
      addLog(`You throw a ${def.name} for ${dmg} damage.`);
      spawnFloat(`-${dmg}`, "enemy", "dmg", null);
      playAnim(els.enemySprite, "rpgAnim-hit");
    } else if (itemId === "ember") {
      showMoveBanner(`${def.name}`, "Fire");
      playAnim(els.playerSprite, "rpgAnim-attack");
      spawnFx("fire", "enemy");
      state.enemy.burn = Math.max(toSafeInt(state.enemy.burn, 0), 2);
      addLog(`🔥 ${def.name} coats ${state.enemy.name} (burn 2).`);
    } else if (itemId === "stun") {
      showMoveBanner(`${def.name}`, "Sound");
      playAnim(els.playerSprite, "rpgAnim-attack");
      spawnFx("sound", "enemy");
      state.enemy.stunned = Math.max(toSafeInt(state.enemy.stunned, 0), 1);
      addLog(`🌫️ ${state.enemy.name} staggers (stunned).`);
    } else if (itemId === "rune") {
      showMoveBanner(`${def.name}`, "Sight");
      playAnim(els.playerSprite, "rpgAnim-heal");
      spawnFx("sight", "player");
      state.player.damageBoost = 1.3;
      addLog(`🗡️ ${def.name} flares (next damage x1.3).`);
    } else if (itemId === "barrier") {
      showMoveBanner(`${def.name}`, "Earth");
      playAnim(els.playerSprite, "rpgAnim-guard");
      spawnFx("guard", "player");
      state.player.barrier = 1;
      addLog(`🛡️ ${def.name} surrounds you (next hit −30%).`);
    }

    state.player.itemUsedThisTurn = true;

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} is defeated.`);
      return;
    }

    addLog("Choose an action.");
    render();
  }

  /** @param {string} gearId */
    /**
   * Equip a piece of gear into its slot (or a slot override).
   * @param {string} gearId
   * @param {"weapon"|"armor"|"trinket"|null} slotOverride
   */
  function playerEquipGear(gearId, slotOverride = null) {
    if (isGameOver()) return;
    if (state.phase !== "player") return;

    closeMagicMenu();
    // Keep Inventory open so you can rapidly swap/compare equipment.

    const def = GEAR_DEFS[gearId];
    if (!def) {
      addLog("That gear doesn't exist.");
      render();
      return;
    }

    const inv = state?.player?.gear && typeof state.player.gear === "object" ? state.player.gear : {};
    const have = Math.max(0, toSafeInt(inv[gearId], 0));
    if (have <= 0) {
      addLog(`You don't own ${def.name}.`);
      render();
      return;
    }

    const slot = slotOverride || def.slot;
    if (slot !== def.slot) {
      addLog(`${def.icon} ${def.name} doesn't fit that slot.`);
      render();
      return;
    }

    state.player.gear = sanitizeGearCounts(state.player.gear);
    state.player.equipSlots = sanitizeEquipSlots(state.player.equipSlots ?? state.player.equip, state.player.gear);

    const prev = state.player.equipSlots[slot];

    if (prev === gearId) {
      addLog(`You're already using ${def.icon} ${def.name} as your ${EQUIP_SLOT_LABEL[slot]}.`);
      render();
      return;
    }

    state.player.equipSlots[slot] = gearId;

    // Legacy compatibility: keep `equip` as the trinket for older code paths.
    state.player.equip = state.player.equipSlots.trinket;

    syncPlayerLevel(false);
    persistPlayerProgress();

    if (prev && GEAR_DEFS[prev]) {
      addLog(`🧰 ${EQUIP_SLOT_LABEL[slot]}: replaced ${GEAR_DEFS[prev].icon} ${GEAR_DEFS[prev].name} with ${def.icon} ${def.name}.`);
    } else {
      addLog(`🧰 ${EQUIP_SLOT_LABEL[slot]} equipped: ${def.icon} ${def.name}.`);
    }

    render();
  }

  /** @param {"weapon"|"armor"|"trinket"} slot */
  function playerUnequipGear(slot) {
    if (isGameOver()) return;
    if (state.phase !== "player") return;

    closeMagicMenu();
    // Keep Inventory open so you can rapidly swap/compare equipment.

    state.player.gear = sanitizeGearCounts(state.player.gear);
    state.player.equipSlots = sanitizeEquipSlots(state.player.equipSlots ?? state.player.equip, state.player.gear);

    const curId = state.player.equipSlots[slot];
    if (!curId || !GEAR_DEFS[curId]) {
      addLog(`No ${EQUIP_SLOT_LABEL[slot]} equipped.`);
      render();
      return;
    }

    const cur = GEAR_DEFS[curId];
    state.player.equipSlots[slot] = null;

    // Legacy compatibility
    state.player.equip = state.player.equipSlots.trinket;

    syncPlayerLevel(false);
    persistPlayerProgress();
    addLog(`🧰 ${EQUIP_SLOT_LABEL[slot]} unequipped: ${cur.icon} ${cur.name}.`);
    render();
  }


  function restartToHeroSelect() {
    closeMagicMenu();
    closeInventoryMenu();
    closeHeroPicker();
    closeLocationPicker();
    lootResolve = null;
    if (isLootOpen()) closeLootScreen();
    if (lootTimer) window.clearTimeout(lootTimer);
    lootTimer = 0;
    if (isDefeatOpen()) closeDefeatScreen();
    resetVisuals();
    state = makeLobbyState();
    syncKnownSpells(false);
    renderIntent(null);
    setEffectBanner("—", "neutral");
    render();
    openHeroPicker();
  }

  function restart() {
    closeMagicMenu();
    closeInventoryMenu();
    closeHeroPicker();
    closeLocationPicker();
    lootResolve = null;
    if (isLootOpen()) closeLootScreen();
    if (lootTimer) window.clearTimeout(lootTimer);
    lootTimer = 0;
    if (isDefeatOpen()) closeDefeatScreen();
    resetVisuals();
    state = makeLobbyState();
  syncKnownSpells(false);
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

  if (els.inventoryToggle instanceof HTMLButtonElement) {
    els.inventoryToggle.addEventListener("click", toggleInventoryMenu);
  }

  
  // --------------------
  // Overworld wiring (movement + battle)
  // --------------------

  // Click a battle marker to snap to it.
  if (els.locationChoices instanceof HTMLElement) {
    els.locationChoices.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest('button[data-ow-loc]');
      if (!(btn instanceof HTMLButtonElement)) return;
      const id = btn.getAttribute('data-ow-loc');
      if (!id) return;
      const m = getMapLocationData(id);
      if (m) {
        setOwPos(m.leftPct, m.topPct);
        renderOverworldPositions();
        updateOverworldUI();
      }
    });
  }
  if (els.overworldBattleBtn instanceof HTMLButtonElement) {
    els.overworldBattleBtn.addEventListener("click", () => {
      const loc = getBattleableOverworldLocation();
      if (!loc) return;
      startBattleWithLocation(loc.id);
    });
  }

  // Back button (close the overworld modal)
  if (els.overworldBackBtn instanceof HTMLButtonElement) {
    els.overworldBackBtn.addEventListener("click", () => {
      closeLocationPicker();
    });
  }

  const bindMoveBtn = (btn, dx, dy) => {
    if (!(btn instanceof HTMLButtonElement)) return;
    btn.addEventListener("click", () => moveOverworld(dx, dy));
  };

  bindMoveBtn(els.owUp, 0, -1);
  bindMoveBtn(els.owDown, 0, 1);
  bindMoveBtn(els.owLeft, -1, 0);
  bindMoveBtn(els.owRight, 1, 0);

  // Keyboard traversal while the overworld modal is open.
  document.addEventListener("keydown", (e) => {
    if (!isLocationOpen()) return;
    // Don't steal keys if you're typing in a field.
    const t = e.target;
    if (t && (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;

    const k = e.key;
    const map = {
      "ArrowUp": [0, -1],
      "ArrowDown": [0, 1],
      "ArrowLeft": [-1, 0],
      "ArrowRight": [1, 0],
      "w": [0, -1],
      "s": [0, 1],
      "a": [-1, 0],
      "d": [1, 0],
      "W": [0, -1],
      "S": [0, 1],
      "A": [-1, 0],
      "D": [1, 0],
    };

    if (k === "Enter") {
      const loc = getBattleableOverworldLocation();
      if (loc) {
        e.preventDefault();
        startBattleWithLocation(loc.id);
      }
      return;
    }

    const step = map[k];
    if (!step) return;
    e.preventDefault();
    moveOverworld(step[0], step[1]);
  });


  // Inventory menu: tabs + items + gear actions
  if (els.inventoryMenu instanceof HTMLElement) {
    els.inventoryMenu.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;

	      // Tabs (Gear / Items)
	      const tabBtn = target.closest('button[data-inv-tab]');
	      if (tabBtn instanceof HTMLButtonElement) {
	        const tab = tabBtn.getAttribute('data-inv-tab');
	        if (tab === 'gear' || tab === 'items') {
	          setInventoryTab(tab);
	          if (tab === 'items' && (els.inventoryItemsPane instanceof HTMLElement)) {
	            els.inventoryItemsPane.scrollTop = 0;
	            window.setTimeout(() => {
	              const b = els.inventoryItemsPane.querySelector('button:not([disabled])');
	              if (b instanceof HTMLButtonElement) b.focus({ preventScroll: true });
	            }, 0);
	          }
	          if (tab === 'gear' && (els.inventoryGearPane instanceof HTMLElement)) {
	            els.inventoryGearPane.scrollTop = 0;
	            window.setTimeout(() => {
	              const b = els.inventoryGearPane.querySelector('button:not([disabled])');
	              if (b instanceof HTMLButtonElement) b.focus({ preventScroll: true });
	            }, 0);
	          }
	        }
	        return;
	      }

      // Items
      const itemBtn = target.closest("button[data-item-id]");
      if (itemBtn instanceof HTMLButtonElement) {
        const id = itemBtn.getAttribute("data-item-id");
        if (id) playerUseItem(id);
        return;
      }

      // Gear
      const gearBtn = target.closest("button[data-gear-action]");
      if (gearBtn instanceof HTMLButtonElement) {
        const action = gearBtn.getAttribute("data-gear-action");
        if (action === "unequip-slot") {
          const slot = gearBtn.getAttribute("data-gear-slot");
          if (slot === "weapon" || slot === "armor" || slot === "trinket") {
            playerUnequipGear(slot);
          }
          return;
        }

        const id = gearBtn.getAttribute("data-gear-id");
        if (id) playerEquipGear(id);
      }
    });
  }

  // Dynamic spell menu: buttons are generated each render.
  if (els.magicMenu instanceof HTMLElement) {
    els.magicMenu.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-spell-id]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const id = btn.getAttribute("data-spell-id");
      if (!id) return;
      playerCastSpell(id);
    });

    const preview = (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const btn = target.closest("button[data-spell-id]");
      if (!(btn instanceof HTMLButtonElement)) return;
      const id = btn.getAttribute("data-spell-id");
      if (!id) return;
      const sp = SPELLS_BY_ID[id];
      if (!sp) return;
      const extra = (() => {
        const s = spellHookSummary(sp);
        if (!s || s === "A direct damage spell.") return "";
        return s;
      })();
      setPreviewMove(sp.name, sp.type, sp.baseCost, extra);
    };

    els.magicMenu.addEventListener("mouseover", preview);
    els.magicMenu.addEventListener("focusin", preview);
  }

  if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.addEventListener("click", playerAttack);
  if (els.healBtn instanceof HTMLButtonElement) els.healBtn.addEventListener("click", playerHeal);
  if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.addEventListener("click", playerGuard);
  if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.addEventListener("click", restart);


  if (els.heroBtn instanceof HTMLButtonElement) {
        els.heroBtn.addEventListener("click", () => {
      restartToHeroSelect();
    });
  }


  if (els.defeatRestartBtn instanceof HTMLButtonElement) {
    els.defeatRestartBtn.addEventListener("click", () => {
      restartToHeroSelect();
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
      const baseSpells = startingSpellIdsFor(hero.types);
      saveHeroProgress(id, {
        level: 1,
        xp: 0,
        spells: baseSpells,
        items: { ...STARTING_ITEMS },
        gear: { ...STARTING_GEAR },
        equip: "apprentice_ring",
      });
      addLog(`Progress reset for ${hero.name}.`);

      if (state?.player?.id === id) {
        state.player.level = 1;
        state.player.xp = 0;
        state.player.xpToNext = xpToNext(1);
        state.player.spells = baseSpells;
        state.player.pendingSpellQueue = [];
        state.player.items = { ...STARTING_ITEMS };
        state.player.gear = { ...STARTING_GEAR };
        state.player.equipSlots = { weapon: null, armor: null, trinket: "apprentice_ring" };
        state.player.equip = "apprentice_ring";
        syncPlayerLevel(false);
        syncKnownSpells(false);
      }

      renderHeroChoices();
      setEffectBanner("Hero progress reset.", "neutral");
      render();
    });
  }

  
  // Effectiveness preview (hover/focus shows tiered effectiveness before you click)
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
  // Heal has no type matchup, so it uses a custom preview showing exact HP restored.
  const wireHealPreview = (btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const show = () => showHealPreview();
    btn.addEventListener("mouseenter", show);
    btn.addEventListener("focus", show);
  };
  wireHealPreview(els.healBtn);
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
  syncKnownSpells(false);
  renderIntent(null);
  setEffectBanner("—", "neutral");
  setPhase("hero");
  render();
  openHeroPicker();
}
