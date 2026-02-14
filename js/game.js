/**
 * Tiny Turn RPG
 * UI-only, single-player, turn-based battle loop.
 * Runs fully in-browser (no backend).
 *
 * This version adds:
 * - Two-wave battle: a second enemy appears after the first is defeated.
 * - A simple "Pokemon-like" type system (Wind / Fire / Sight) with effectiveness + STAB.
 * - Existing unpredictability: enemy AI variety, crits, misses, and status effects.
 */

const root = document.getElementById("rpgRoot");

if (root) {
  const els = {
    playerName: document.getElementById("playerName"),
    enemyName: document.getElementById("enemyName"),
    playerTypeText: document.getElementById("playerTypeText"),
    enemyTypeText: document.getElementById("enemyTypeText"),

    playerHpText: document.getElementById("playerHpText"),
    enemyHpText: document.getElementById("enemyHpText"),
    playerHpFill: document.getElementById("playerHpFill"),
    enemyHpFill: document.getElementById("enemyHpFill"),
    playerStatus: document.getElementById("playerStatus"),
    enemyStatus: document.getElementById("enemyStatus"),
    log: document.getElementById("battleLog"),
    attackBtn: document.getElementById("attackBtn"),
    healBtn: document.getElementById("healBtn"),
    guardBtn: document.getElementById("guardBtn"),
    restartBtn: document.getElementById("restartBtn"),
    magicToggle: document.getElementById("magicToggle"),
    magicMenu: document.getElementById("magicMenu"),
    windBtn: document.getElementById("windBtn"),
    fireBtn: document.getElementById("fireBtn"),
    playerSprite: document.getElementById("playerSprite"),
    enemySprite: document.getElementById("enemySprite"),
    playerSpriteImg: document.getElementById("playerSpriteImg"),
    enemySpriteImg: document.getElementById("enemySpriteImg"),

    playerTypePills: document.getElementById("playerTypePills"),
    enemyTypePills: document.getElementById("enemyTypePills"),
    effectBanner: document.getElementById("effectBanner"),
  };

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
   * Magic menu helpers (dropdown)
   */
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMagicMenu();
  });

  /** @param {number} min @param {number} max */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** @param {number} p */
  function chance(p) {
    return Math.random() < p;
  }

  /** @param {number} value @param {number} min @param {number} max */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // --------------------
  // Type system
  // --------------------

  /** @typedef {"Wind"|"Fire"|"Sight"} MagicType */

  /**
   * Type effectiveness chart: attackType -> defenderType -> multiplier.
   * Dual types multiply.
   *
   * Design goal: noticeable, not swingy.
   */
  const TYPE_CHART = /** @type {Record<MagicType, Record<MagicType, number>>} */ ({
    // More noticeable matchups (so types matter at a glance).
    Wind:  { Wind: 1.0, Fire: 1.6, Sight: 0.9 },
    Fire:  { Fire: 0.7, Wind: 1.6, Sight: 0.9 },
    Sight: { Sight: 1.0, Wind: 1.2, Fire: 1.2 },
  });

  /** @param {MagicType} attackType @param {MagicType[]} defenderTypes */
  function typeMultiplier(attackType, defenderTypes) {
    let mult = 1;
    for (const dt of defenderTypes) {
      mult *= TYPE_CHART[attackType]?.[dt] ?? 1;
    }
    return mult;
  }

  /** @param {number} mult */
  function effectivenessText(mult) {
    if (mult >= 1.30) return "It’s super effective!";
    if (mult <= 0.85) return "Not very effective…";
    return "";
  }

  /** @param {MagicType[]} types */
  function formatTypes(types) {
    return `Type: ${types.join(" • ")}`;
  }

  /** @param {number} n */
  function fmtMult(n) {
    // Avoid noisy decimals; 1.44 -> "1.44", 1.2 -> "1.2"
    const s = (Math.round(n * 100) / 100).toString();
    return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
  }

  /** @param {MagicType} moveType @param {"player"|"enemy"} attackerKey @param {MagicType[]} defenderTypes */
  function previewMultiplier(moveType, attackerKey, defenderTypes) {
    const attacker = state[attackerKey];
    const stab = attacker.types.includes(moveType) ? 1.2 : 1.0;
    const eff = typeMultiplier(moveType, defenderTypes);
    return { stab, eff, overall: stab * eff };
  }

  /** @param {HTMLElement|null} el @param {MagicType[]} types */
  function renderTypePills(el, types) {
    if (!(el instanceof HTMLElement)) return;
    el.innerHTML = "";
    for (const t of types) {
      const span = document.createElement("span");
      span.className = `typePill typePill--${t}`;
      span.textContent = t;
      el.appendChild(span);
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
   * Compute typed damage.
   * - Applies STAB (same-type attack bonus) when move type matches attacker types.
   * - Applies effectiveness vs defender types.
   * Returns the scaled base damage (defenses are applied after this).
   */
  function computeTypedDamage(attackerKey, defenderKey, base, moveType) {
    const attacker = state[attackerKey];
    const defender = state[defenderKey];

    const stab = attacker.types.includes(moveType) ? 1.2 : 1.0;
    const eff = typeMultiplier(moveType, defender.types);

    const scaled = Math.max(1, Math.round(base * stab * eff));

    return {
      scaled,
      eff,
      stab,
      overall: stab * eff,
      note: effectivenessText(stab * eff),
    };
  }

  // --------------------
  // Combatants (player + two enemies)
  // --------------------

  const PLAYER_TEMPLATE = {
    name: "Player",
    types: /** @type {MagicType[]} */ (["Wind", "Sight"]),
    maxHp: 20,
    healCharges: 3,
  };

  const ENEMIES = [
    {
      name: "Rival Mage",
      types: /** @type {MagicType[]} */ (["Fire", "Sight"]),
      maxHp: 22,
      healCharges: 2,
      profile: "standard",
      sprite: "./assets/images/enemy-blue.png",
    },
    {
      name: "Cinder Seer",
      types: /** @type {MagicType[]} */ (["Fire", "Sight"]),
      maxHp: 28,
      healCharges: 2,
      profile: "aggressive",
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
      guarding: false,
      gusted: false,
      burn: 0,
      ward: 0, // mirror ward: reduces next hit and reflects a bit
      healCharges: t.healCharges,
      enraged: false,
      profile: t.profile,
      sprite: t.sprite,
    };
  }

  function makeInitialState() {
    return {
      turn: 1,
      wave: 0, // 0-based index into ENEMIES
      player: {
        name: PLAYER_TEMPLATE.name,
        types: PLAYER_TEMPLATE.types,
        hp: PLAYER_TEMPLATE.maxHp,
        max: PLAYER_TEMPLATE.maxHp,
        guarding: false,
        evading: false,
        burn: 0,
        healCharges: PLAYER_TEMPLATE.healCharges,
      },
      enemy: makeEnemy(0),
      over: false,
      log: [
        `Wave 1: ${ENEMIES[0].name} steps into view.`,
        "The air tastes like ozone. Your turn.",
      ],
    };
  }

  const GAME_BUILD = "2026-02-14c";

  let state = makeInitialState();
  addLog(`Build: ${GAME_BUILD}`);

  /** @param {string} message */
  function addLog(message) {
    state.log.unshift(message);
    if (state.log.length > 16) state.log = state.log.slice(0, 16);
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
    if (!state.over && state.player.evading) parts.push("Evasive (next hit may miss)");
    if (!state.over && state.player.burn > 0) parts.push(`Burning (${state.player.burn})`);
    return parts.length ? parts.join(" • ") : "Ready";
  }

  function statusLineForEnemy() {
    const parts = [];
    if (!state.over && state.enemy.enraged) parts.push("Enraged");
    if (!state.over && state.enemy.guarding) parts.push("Ward stance (next hit −50%)");
    if (!state.over && state.enemy.ward > 0) parts.push("Mirror ward (reflect)");
    if (!state.over && state.enemy.gusted) parts.push("Gusted (next hit weakened)");
    if (!state.over && state.enemy.burn > 0) parts.push(`Burning (${state.enemy.burn})`);
    return parts.length ? parts.join(" • ") : "Channeling";
  }

  function setEnemyVisuals() {
    if (!(els.enemySprite instanceof HTMLElement)) return;
    els.enemySprite.classList.toggle("is-phase2", state.wave >= 1);
  }

  function render() {
    const playerHp = clamp(state.player.hp, 0, state.player.max);
    const enemyHp = clamp(state.enemy.hp, 0, state.enemy.max);

    // Names + types
    setText(els.playerName, state.player.name);
    setText(
      els.enemyName,
      `${state.enemy.name} (Wave ${state.wave + 1}/${ENEMIES.length})`
    );
    setText(els.playerTypeText, formatTypes(state.player.types));
    setText(els.enemyTypeText, formatTypes(state.enemy.types));

    // Sprite swap (wave-based enemies)
    if (els.enemySpriteImg instanceof HTMLImageElement && state.enemy.sprite) {
      if (els.enemySpriteImg.getAttribute("src") !== state.enemy.sprite) {
        els.enemySpriteImg.setAttribute("src", state.enemy.sprite);
      }
    }

    // Type pills panel
    renderTypePills(els.playerTypePills, state.player.types);
    renderTypePills(els.enemyTypePills, state.enemy.types);

    // Make type multipliers obvious on the move buttons
    const atkPrev = previewMultiplier("Sight", "player", state.enemy.types);
    const windPrev = previewMultiplier("Wind", "player", state.enemy.types);
    const firePrev = previewMultiplier("Fire", "player", state.enemy.types);

    if (els.attackBtn instanceof HTMLButtonElement) {
      els.attackBtn.textContent = `Attack (Sight x${fmtMult(atkPrev.overall)})`;
    }
    if (els.windBtn instanceof HTMLButtonElement) {
      els.windBtn.textContent = `Wind attack (x${fmtMult(windPrev.overall)})`;
    }
    if (els.fireBtn instanceof HTMLButtonElement) {
      const offType = !state.player.types.includes("Fire");
      const label = offType ? "Fire attack (off-type)" : "Fire attack";
      els.fireBtn.textContent = `${label} (x${fmtMult(firePrev.overall)})`;
    }

    // HP
    setText(els.playerHpText, `HP ${playerHp} / ${state.player.max}`);
    setText(els.enemyHpText, `HP ${enemyHp} / ${state.enemy.max}`);

    setBar(els.playerHpFill, playerHp / state.player.max);
    setBar(els.enemyHpFill, enemyHp / state.enemy.max);

    // Status
    if (state.over) {
      setText(
        els.playerStatus,
        playerHp <= 0 ? "Defeated" : "Victorious"
      );
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

    // Update button labels / availability
    if (els.healBtn instanceof HTMLButtonElement) {
      els.healBtn.textContent = `Heal (${state.player.healCharges})`;
    }

    const disableActions = state.over;
    if (disableActions) closeMagicMenu();

    const healDisabled = state.over || state.player.healCharges <= 0;

    [els.attackBtn, els.guardBtn, els.magicToggle, els.windBtn, els.fireBtn].forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = disableActions;
    });
    if (els.healBtn instanceof HTMLButtonElement) {
      els.healBtn.disabled = healDisabled;
    }

    if (els.restartBtn instanceof HTMLButtonElement) {
      els.restartBtn.disabled = false;
    }
  }

  function endGame(message) {
    state.over = true;
    addLog(message);
    if (state.enemy.hp <= 0) playAnim(els.enemySprite, "rpgAnim-faint");
    if (state.player.hp <= 0) playAnim(els.playerSprite, "rpgAnim-faint");
    render();
  }

  /**
   * Transition to the next wave (second enemy) if available.
   * The player keeps current HP and heal charges, but gets a small "second wind".
   */
  function advanceWave(defeatMessage) {
    // Defeat message from the moment the enemy hits 0.
    addLog(defeatMessage);
    playAnim(els.enemySprite, "rpgAnim-faint");

    const nextIndex = state.wave + 1;
    if (nextIndex >= ENEMIES.length) {
      endGame("The duel ends. You win!");
      return;
    }

    // Small between-wave breather.
    const bonus = 3;
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + bonus, 0, state.player.max);
    const actual = state.player.hp - before;
    if (actual > 0) addLog(`You catch a second wind (+${actual} HP).`);

    // Clear one-turn tactical states.
    state.player.guarding = false;
    state.player.evading = false;

    // Spawn next enemy.
    state.wave = nextIndex;
    state.enemy = makeEnemy(state.wave);

    addLog(`Wave ${state.wave + 1}: ${state.enemy.name} arrives.`);
    addLog("Your turn.");

    setEffectBanner("—", "neutral");
    render();
  }

  /**
   * Apply burn at the start of a unit's turn.
   * Burn ticks for 2 damage and reduces its counter by 1.
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

  /**
   * Roll a hit with miss + crit.
   * @param {object} cfg
   * @param {number} cfg.min
   * @param {number} cfg.max
   * @param {number} cfg.missChance
   * @param {number} cfg.critChance
   * @param {number} cfg.critMult
   * @returns {{hit:boolean, crit:boolean, amount:number}}
   */
  function rollHit({ min, max, missChance, critChance, critMult }) {
    if (chance(missChance)) return { hit: false, crit: false, amount: 0 };
    let amount = randInt(min, max);
    const crit = chance(critChance);
    if (crit) amount = Math.max(1, Math.round(amount * critMult));
    return { hit: true, crit, amount };
  }

  /**
   * Apply defenses on the target (guard/ward) and deal the final damage.
   * Returns {final, reflected}.
   * @param {"player"|"enemy"} targetKey
   * @param {number} incoming
   */
  function applyDefenses(targetKey, incoming) {
    let final = incoming;
    let reflected = 0;

    if (targetKey === "player") {
      if (state.player.guarding) {
        const before = final;
        final = Math.floor(final / 2);
        state.player.guarding = false;
        addLog(`You guard and soften the blow (${before} → ${final}).`);
        playAnim(els.playerSprite, "rpgAnim-guard");
      }
      return { final, reflected };
    }

    // Enemy defenses
    if (state.enemy.ward > 0) {
      const before = final;
      final = Math.ceil(final * 0.6);
      reflected = Math.max(1, Math.floor(before * 0.25));
      state.enemy.ward = 0;
      addLog(
        `A mirror ward bends your strike (${before} → ${final}) and bites back (${reflected}).`
      );
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    if (state.enemy.guarding) {
      const before = final;
      final = Math.floor(final / 2);
      state.enemy.guarding = false;
      addLog(`${state.enemy.name} braces (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    return { final, reflected };
  }

  // --------------------
  // Enemy AI + turn
  // --------------------

  function enemyTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return; // Wave swap safety

    // Start-of-turn effects on enemy
    tickBurn("enemy");
    if (state.enemy.hp <= 0) {
      advanceWave(`${state.enemy.name} crumples from lingering flame.`);
      return;
    }

    // Enrage phase (happens once)
    if (!state.enemy.enraged && state.enemy.hp <= Math.ceil(state.enemy.max * 0.4)) {
      state.enemy.enraged = true;
      addLog(`${state.enemy.name} snarls. Their aura sharpens (enraged).`);
    }

    const e = state.enemy;
    const p = state.player;

    const lowEnemy = e.hp <= Math.ceil(e.max * 0.35);
    const lowPlayer = p.hp <= Math.ceil(p.max * 0.35);

    // Action selection varies by profile.
    let action = "attack";

    if (lowEnemy && e.healCharges > 0 && chance(e.profile === "aggressive" ? 0.55 : 0.6)) {
      action = "heal";
    } else if (lowPlayer && chance(e.profile === "aggressive" ? 0.42 : 0.35)) {
      action = chance(0.55) ? "lance" : "ignite";
    } else {
      const r = Math.random();
      if (e.profile === "aggressive") {
        if (r < 0.12) action = "ward";
        else if (r < 0.26) action = "siphon";
        else if (r < 0.50) action = "ignite";
        else if (r < 0.70) action = "lance";
        else action = "attack";
      } else {
        if (r < 0.10) action = "ward";
        else if (r < 0.25) action = "siphon";
        else if (r < 0.42) action = "ignite";
        else if (r < 0.54) action = "lance";
        else action = "attack";
      }
    }

    // Execute
    if (action === "heal") {
      playAnim(els.enemySprite, "rpgAnim-heal");
      const heal = randInt(4, 7) + (e.enraged ? 1 : 0);
      const before = e.hp;
      e.hp = clamp(e.hp + heal, 0, e.max);
      const actual = e.hp - before;
      e.healCharges = Math.max(0, e.healCharges - 1);
      addLog(
        actual > 0
          ? `${e.name} mends for ${actual} HP.`
          : `${e.name} tries to mend, but is already at full HP.`
      );
      beginPlayerTurn();
      return;
    }

    if (action === "ward") {
      e.ward = 1;
      addLog(`${e.name} conjures a mirror ward.`);
      playAnim(els.enemySprite, "rpgAnim-guard");
      beginPlayerTurn();
      return;
    }

    if (action === "siphon") {
      playAnim(els.enemySprite, "rpgAnim-attack");

      const roll = rollHit({
        min: 2,
        max: 6,
        missChance: 0.10 + (p.evading ? 0.25 : 0),
        critChance: 0.12 + (e.enraged ? 0.05 : 0),
        critMult: 1.8,
      });

      if (p.evading) p.evading = false;

      if (!roll.hit) {
        addLog(`${e.name} reaches for your vitality... and misses.`);
        playAnim(els.playerSprite, "rpgAnim-guard");
        beginPlayerTurn();
        return;
      }

      let base = roll.amount;
      if (e.gusted) {
        base = Math.max(1, base - 2);
        e.gusted = false;
        addLog("A lingering gust throws off the siphon (−2 damage).");
      }

      // Siphon is Sight-type.
      const typed = computeTypedDamage("enemy", "player", base, "Sight");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
      const def = applyDefenses("player", typed.scaled);
      const final = def.final;

      p.hp = clamp(p.hp - final, 0, p.max);
      const heal = Math.max(1, Math.floor(final * 0.6));
      e.hp = clamp(e.hp + heal, 0, e.max);

      addLog(
        roll.crit
          ? `${e.name} lands a critical siphon for ${final} damage and steals ${heal} HP!`
          : `${e.name} siphons ${final} HP and steals ${heal}.`
      );
      if (typed.note) addLog(typed.note);
      setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
      if (!state.over) playAnim(els.playerSprite, "rpgAnim-hit");

      if (p.hp <= 0) {
        endGame("Your strength is drained away. Game over.");
        return;
      }

      beginPlayerTurn();
      return;
    }

    if (action === "ignite") {
      playAnim(els.enemySprite, "rpgAnim-attack");

      const roll = rollHit({
        min: 1,
        max: 5,
        missChance: 0.10 + (p.evading ? 0.25 : 0),
        critChance: 0.10 + (e.enraged ? 0.05 : 0),
        critMult: 2,
      });

      if (p.evading) p.evading = false;

      if (!roll.hit) {
        addLog(`${e.name} snaps their fingers. Sparks fizzle harmlessly.`);
        beginPlayerTurn();
        return;
      }

      let base = roll.amount;
      if (e.gusted) {
        base = Math.max(1, base - 2);
        e.gusted = false;
        addLog("A lingering gust scatters the sparks (−2 damage).");
      }

      // Ignite is Fire-type.
      const typed = computeTypedDamage("enemy", "player", base, "Fire");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
      const def = applyDefenses("player", typed.scaled);
      const final = def.final;

      p.hp = clamp(p.hp - final, 0, p.max);
      addLog(roll.crit ? `A critical ignition scorches you for ${final} damage!` : `Ignition scorches you for ${final} damage.`);
      if (typed.note) addLog(typed.note);
      setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
      playAnim(els.playerSprite, "rpgAnim-hit");

      // 45% chance to apply burn for 2 turns.
      if (chance(0.45)) {
        p.burn = Math.max(p.burn, 2);
        addLog("Flame clings to you (burn).");
      }

      if (p.hp <= 0) {
        endGame("You collapse. Game over.");
        return;
      }

      beginPlayerTurn();
      return;
    }

    // attack or lance
    const isLance = action === "lance";
    playAnim(els.enemySprite, "rpgAnim-attack");

    const roll = rollHit({
      min: isLance ? 4 : 2,
      max: isLance ? 10 : 7,
      missChance: 0.10 + (p.evading ? 0.25 : 0),
      critChance: (isLance ? 0.18 : 0.12) + (e.enraged ? 0.06 : 0),
      critMult: isLance ? 2 : 1.8,
    });

    if (p.evading) p.evading = false;

    if (!roll.hit) {
      addLog(isLance ? `${e.name} fires an arcane lance... but it misses.` : `${e.name} strikes, but misses.`);
      playAnim(els.playerSprite, "rpgAnim-guard");
      beginPlayerTurn();
      return;
    }

    let base = roll.amount + (e.enraged ? 1 : 0);

    if (e.gusted) {
      base = Math.max(1, base - 2);
      e.gusted = false;
      addLog("A lingering gust throws off their aim (−2 damage).");
    }

    // Both attack and lance are Sight-type.
    const typed = computeTypedDamage("enemy", "player", base, "Sight");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    const def = applyDefenses("player", typed.scaled);
    const final = def.final;

    p.hp = clamp(p.hp - final, 0, p.max);
    addLog(
      roll.crit
        ? (isLance ? `A critical arcane lance hits for ${final} damage!` : `A critical strike hits for ${final} damage!`)
        : (isLance ? `Arcane lance hits for ${final} damage.` : `${e.name} hits you for ${final} damage.`)
    );
    if (typed.note) addLog(typed.note);
    playAnim(els.playerSprite, "rpgAnim-hit");

    if (p.hp <= 0) {
      endGame("You collapse. Game over.");
      return;
    }

    beginPlayerTurn();
  }

  /**
   * Begin player turn: apply start-of-turn statuses on player, then render.
   */
  function beginPlayerTurn() {
    if (isGameOver()) return;
    if (state.enemy.hp <= 0) return;

    state.turn += 1;

    tickBurn("player");
    if (state.player.hp <= 0) {
      endGame("The burn finishes you. Game over.");
      return;
    }

    addLog("Your turn.");
    render();
  }

  // --------------------
  // Player actions
  // --------------------

  function onEnemyDown(message) {
    closeMagicMenu();
    if (state.enemy.hp > 0) return;
    advanceWave(message);
  }

  function playerAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    playAnim(els.playerSprite, "rpgAnim-attack");

    // Basic attack is Sight-type (precision / light construct).
    const roll = rollHit({
      min: 3,
      max: 7,
      missChance: 0.08,
      critChance: 0.16,
      critMult: 2,
    });

    if (!roll.hit) {
      addLog("You swing and whiff the air.");
      enemyTurn();
      return;
    }

    const typed = computeTypedDamage("player", "enemy", roll.amount, "Sight");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    const def = applyDefenses("enemy", typed.scaled);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(
      roll.crit
        ? `Critical hit! You strike for ${def.final} damage.`
        : `You strike ${state.enemy.name} for ${def.final} damage.`
    );
    if (typed.note) addLog(typed.note);
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

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerWindAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    playAnim(els.playerSprite, "rpgAnim-attack");

    const roll = rollHit({
      min: 2,
      max: 6,
      missChance: 0.10,
      critChance: 0.14,
      critMult: 1.9,
    });

    if (!roll.hit) {
      addLog("Your wind blade fizzles out before it lands.");
      enemyTurn();
      return;
    }

    const typed = computeTypedDamage("player", "enemy", roll.amount, "Wind");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    const def = applyDefenses("enemy", typed.scaled);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(
      roll.crit
        ? `Critical gust! Wind blade deals ${def.final} damage.`
        : `You send a wind blade for ${def.final} damage.`
    );
    if (typed.note) addLog(typed.note);
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

    // 40% chance to weaken the enemy’s next hit.
    if (chance(0.4)) {
      state.enemy.gusted = true;
      addLog("The gust rattles their focus. Next enemy hit is weakened.");
    }

    // 30% chance to gain evasion for the next enemy attack.
    if (chance(0.3)) {
      state.player.evading = true;
      addLog("You ride the wind and become hard to pin down (evasion).");
    }

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerFireAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    playAnim(els.playerSprite, "rpgAnim-attack");

    const roll = rollHit({
      min: 4,
      max: 9,
      missChance: 0.10,
      critChance: 0.18,
      critMult: 2,
    });

    if (!roll.hit) {
      addLog("Your flame sputters out before it reaches them.");
      enemyTurn();
      return;
    }

    // Off-type Fire: no STAB for the player.
    const typed = computeTypedDamage("player", "enemy", roll.amount, "Fire");
    setEffectBanner(`${typed.note || "Impact"} (x${fmtMult(typed.overall)})`, toneFromMultiplier(typed.overall));
    const def = applyDefenses("enemy", typed.scaled);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(
      roll.crit
        ? `Critical flame! You hurl fire for ${def.final} damage.`
        : `You hurl a burst of flame for ${def.final} damage.`
    );
    if (typed.note) addLog(typed.note);
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

    // 35% chance to apply burn for 2 turns.
    if (chance(0.35)) {
      state.enemy.burn = Math.max(state.enemy.burn, 2);
      addLog(`${state.enemy.name} catches flame (burn).`);
    }

    // Small chance of backlash to keep it spicy.
    if (chance(0.12)) {
      const self = 2;
      state.player.hp = clamp(state.player.hp - self, 0, state.player.max);
      addLog(`Wild sparks bite back for ${self} damage.`);
      playAnim(els.playerSprite, "rpgAnim-hit");
      if (state.player.hp <= 0) {
        endGame("The backlash drops you. Game over.");
        return;
      }
    }

    if (state.enemy.hp <= 0) {
      onEnemyDown(`${state.enemy.name} falls.`);
      return;
    }

    enemyTurn();
  }

  function playerHeal() {
    if (isGameOver()) return;
    closeMagicMenu();

    if (state.player.healCharges <= 0) {
      addLog("Your healing focus is spent.");
      render();
      return;
    }

    playAnim(els.playerSprite, "rpgAnim-heal");

    const heal = randInt(4, 7);
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.max);
    const actual = state.player.hp - before;

    state.player.healCharges = Math.max(0, state.player.healCharges - 1);

    addLog(actual > 0 ? `You heal for ${actual} HP.` : "You try to heal, but you're already at full HP.");

    enemyTurn();
  }

  function playerGuard() {
    if (isGameOver()) return;
    closeMagicMenu();

    if (!state.player.guarding) {
      state.player.guarding = true;
      addLog("You raise your guard.");
      playAnim(els.playerSprite, "rpgAnim-guard");
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

  render();
}
