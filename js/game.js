/**
 * Tiny Turn RPG
 * UI-only, single-player, turn-based battle loop.
 * Runs fully in-browser (no backend).
 *
 * Updates in this version:
 * - More varied enemy AI (attack / ignite / siphon / ward / heal).
 * - Status effects (burn, evasion, gust) + crits + misses for unpredictability.
 * - Limited player heals (charges) so wins aren't automatic.
 */

const root = document.getElementById("rpgRoot");

if (root) {
  const els = {
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

  const INITIAL = {
    turn: 1,
    player: {
      hp: 20,
      max: 20,
      guarding: false,
      evading: false,
      burn: 0,
      healCharges: 3,
    },
    enemy: {
      hp: 22,
      max: 22,
      guarding: false,
      gusted: false,
      burn: 0,
      ward: 0, // mirror ward: reduces next hit and reflects a bit
      healCharges: 2,
      enraged: false,
    },
    over: false,
    log: [
      "A rival mage steps into view.",
      "The air tastes like ozone. Your turn.",
    ],
  };

  let state =
    typeof structuredClone === "function"
      ? structuredClone(INITIAL)
      : JSON.parse(JSON.stringify(INITIAL));

  /** @param {string} message */
  function addLog(message) {
    state.log.unshift(message);
    if (state.log.length > 14) state.log = state.log.slice(0, 14);
  }

  function isGameOver() {
    return state.over || state.player.hp <= 0 || state.enemy.hp <= 0;
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

  function render() {
    const playerHp = clamp(state.player.hp, 0, state.player.max);
    const enemyHp = clamp(state.enemy.hp, 0, state.enemy.max);

    setText(els.playerHpText, `HP ${playerHp} / ${state.player.max}`);
    setText(els.enemyHpText, `HP ${enemyHp} / ${state.enemy.max}`);

    setBar(els.playerHpFill, playerHp / state.player.max);
    setBar(els.enemyHpFill, enemyHp / state.enemy.max);

    if (state.over) {
      setText(
        els.playerStatus,
        playerHp <= 0 ? "Defeated" : state.enemy.hp <= 0 ? "Victorious" : "Finished"
      );
      setText(els.enemyStatus, enemyHp <= 0 ? "Defeated" : "Silent");
    } else {
      setText(els.playerStatus, statusLineForPlayer());
      setText(els.enemyStatus, statusLineForEnemy());
    }

    if (els.playerSprite) {
      els.playerSprite.classList.toggle("is-guarding", !state.over && state.player.guarding);
    }
    if (els.enemySprite) {
      els.enemySprite.classList.toggle("is-guarding", !state.over && state.enemy.guarding);
    }

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

    // Disable heal when out of charges.
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

    const label = who === "player" ? "You" : "Rival Mage";
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
      // Guard halves the next hit.
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
      addLog(`A mirror ward bends your strike (${before} → ${final}) and bites back (${reflected}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    if (state.enemy.guarding) {
      const before = final;
      final = Math.floor(final / 2);
      state.enemy.guarding = false;
      addLog(`The Rival Mage braces (${before} → ${final}).`);
      playAnim(els.enemySprite, "rpgAnim-guard");
    }

    return { final, reflected };
  }

  /**
   * Enemy turn logic (apply statuses, choose an action, execute it).
   */
  function enemyTurn() {
    if (isGameOver()) return;

    // Start-of-turn effects on enemy
    tickBurn("enemy");
    if (state.enemy.hp <= 0) {
      endGame("The Rival Mage crumples from lingering flame. You win!");
      return;
    }

    // Enrage phase (happens once)
    if (!state.enemy.enraged && state.enemy.hp <= Math.ceil(state.enemy.max * 0.4)) {
      state.enemy.enraged = true;
      addLog("The Rival Mage snarls. Their aura sharpens (enraged).");
    }

    // Decide action
    const e = state.enemy;
    const p = state.player;

    // Heals are a big swing, but limited.
    const lowEnemy = e.hp <= Math.ceil(e.max * 0.35);
    const lowPlayer = p.hp <= Math.ceil(p.max * 0.35);

    let action = "attack";
    if (lowEnemy && e.healCharges > 0 && chance(0.6)) action = "heal";
    else if (lowPlayer && chance(0.35)) action = chance(0.5) ? "lance" : "ignite";
    else {
      const r = Math.random();
      if (r < 0.10) action = "ward";
      else if (r < 0.25) action = "siphon";
      else if (r < 0.42) action = "ignite";
      else if (r < 0.54) action = "lance";
      else action = "attack";
    }

    // Execute
    if (action === "heal") {
      playAnim(els.enemySprite, "rpgAnim-heal");
      const heal = randInt(4, 7) + (e.enraged ? 1 : 0);
      const before = e.hp;
      e.hp = clamp(e.hp + heal, 0, e.max);
      const actual = e.hp - before;
      e.healCharges = Math.max(0, e.healCharges - 1);
      addLog(actual > 0 ? `Rival Mage mends for ${actual} HP.` : "Rival Mage tries to mend, but is already at full HP.");
      beginPlayerTurn();
      return;
    }

    if (action === "ward") {
      e.ward = 1;
      addLog("Rival Mage conjures a mirror ward.");
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

      // Evasion only applies to one enemy move, hit or miss.
      if (p.evading) p.evading = false;

      if (!roll.hit) {
        addLog("Rival Mage reaches for your vitality... and misses.");
        playAnim(els.playerSprite, "rpgAnim-guard");
        beginPlayerTurn();
        return;
      }

      let dmg = roll.amount;
      if (e.gusted) {
        dmg = Math.max(1, dmg - 2);
        e.gusted = false;
        addLog("A lingering gust throws off the siphon (−2 damage).");
      }

      const def = applyDefenses("player", dmg);
      const final = def.final;

      p.hp = clamp(p.hp - final, 0, p.max);
      const heal = Math.max(1, Math.floor(final * 0.6));
      e.hp = clamp(e.hp + heal, 0, e.max);

      addLog(roll.crit ? `Rival Mage lands a critical siphon for ${final} damage and steals ${heal} HP!` : `Rival Mage siphons ${final} HP and steals ${heal}.`);
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
        addLog("Rival Mage snaps their fingers. Sparks fizzle harmlessly.");
        beginPlayerTurn();
        return;
      }

      let dmg = roll.amount;
      if (e.gusted) {
        dmg = Math.max(1, dmg - 2);
        e.gusted = false;
        addLog("A lingering gust scatters the sparks (−2 damage).");
      }

      const def = applyDefenses("player", dmg);
      const final = def.final;

      p.hp = clamp(p.hp - final, 0, p.max);
      addLog(roll.crit ? `A critical ignition scorches you for ${final} damage!` : `Ignition scorches you for ${final} damage.`);
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
      addLog(isLance ? "Rival Mage fires an arcane lance... but it misses." : "Rival Mage strikes, but misses.");
      playAnim(els.playerSprite, "rpgAnim-guard");
      beginPlayerTurn();
      return;
    }

    let dmg = roll.amount + (e.enraged ? 1 : 0);

    if (e.gusted) {
      dmg = Math.max(1, dmg - 2);
      e.gusted = false;
      addLog("A lingering gust throws off the Rival Mage’s aim (−2 damage).");
    }

    const def = applyDefenses("player", dmg);
    const final = def.final;

    p.hp = clamp(p.hp - final, 0, p.max);
    addLog(
      roll.crit
        ? (isLance
            ? `A critical arcane lance hits for ${final} damage!`
            : `A critical strike hits for ${final} damage!`)
        : (isLance
            ? `Arcane lance hits for ${final} damage.`
            : `Rival Mage hits you for ${final} damage.`)
    );
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

    state.turn += 1;

    tickBurn("player");
    if (state.player.hp <= 0) {
      endGame("The burn finishes you. Game over.");
      return;
    }

    addLog("Your turn.");
    render();
  }

  function playerAttack() {
    if (isGameOver()) return;
    closeMagicMenu();

    playAnim(els.playerSprite, "rpgAnim-attack");

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

    let dmg = roll.amount;
    const def = applyDefenses("enemy", dmg);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(
      roll.crit
        ? `Critical hit! You strike for ${def.final} damage.`
        : `You strike the Rival Mage for ${def.final} damage.`
    );
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
      endGame("The Rival Mage falls. You win!");
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

    const def = applyDefenses("enemy", roll.amount);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(roll.crit ? `Critical gust! Wind blade deals ${def.final} damage.` : `You send a wind blade for ${def.final} damage.`);
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
      endGame("The Rival Mage falls. You win!");
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

    const def = applyDefenses("enemy", roll.amount);
    state.enemy.hp = clamp(state.enemy.hp - def.final, 0, state.enemy.max);

    addLog(roll.crit ? `Critical flame! You hurl fire for ${def.final} damage.` : `You hurl a burst of flame for ${def.final} damage.`);
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
      addLog("The Rival Mage catches flame (burn).");
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
      endGame("The Rival Mage falls. You win!");
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
    state =
      typeof structuredClone === "function"
        ? structuredClone(INITIAL)
        : JSON.parse(JSON.stringify(INITIAL));

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
    }
    if (els.playerSprite instanceof HTMLElement) {
      clear.forEach((c) => els.playerSprite.classList.remove(c));
      els.playerSprite.classList.remove("is-guarding");
    }
    render();
  }

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
