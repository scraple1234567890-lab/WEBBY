/**
 * Tiny Turn RPG
 * UI-only, single-player, turn-based battle loop.
 * Runs fully in-browser (no backend).
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
  };

  /** @param {number} min @param {number} max */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** @param {number} value @param {number} min @param {number} max */
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  const INITIAL = {
    player: { hp: 20, max: 20, guarding: false },
    enemy: { hp: 18, max: 18 },
    over: false,
    log: ["A Slime wobbles into view.", "Your turn."],
  };

  let state = (typeof structuredClone === "function") ? structuredClone(INITIAL) : JSON.parse(JSON.stringify(INITIAL));

  /** @param {string} message */
  function addLog(message) {
    state.log.unshift(message);
    if (state.log.length > 12) state.log = state.log.slice(0, 12);
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
      setText(els.enemyStatus, enemyHp <= 0 ? "Dissolved" : "Still" );
    } else {
      setText(els.playerStatus, state.player.guarding ? "Guarding (next hit −50%)" : "Ready");
      setText(els.enemyStatus, "Wobbling");
    }

    if (els.log) {
      els.log.innerHTML = "";
      state.log.forEach((line) => {
        const li = document.createElement("li");
        li.textContent = line;
        els.log.appendChild(li);
      });
    }

    const disableActions = state.over;
    [els.attackBtn, els.healBtn, els.guardBtn].forEach((btn) => {
      if (!(btn instanceof HTMLButtonElement)) return;
      btn.disabled = disableActions;
    });

    if (els.restartBtn instanceof HTMLButtonElement) {
      els.restartBtn.disabled = false;
    }
  }

  function endGame(message) {
    state.over = true;
    addLog(message);
    render();
  }

  function enemyTurn() {
    if (isGameOver()) return;

    const raw = randInt(2, 6);
    let dmg = raw;

    if (state.player.guarding) {
      dmg = Math.floor(raw / 2);
      state.player.guarding = false;
      addLog(`You guard and soften the blow (${raw} → ${dmg}).`);
    }

    state.player.hp = clamp(state.player.hp - dmg, 0, state.player.max);
    addLog(`Slime bonks you for ${dmg} damage.`);

    if (state.player.hp <= 0) {
      endGame("You collapse. Game over.");
      return;
    }

    addLog("Your turn.");
    render();
  }

  function playerAttack() {
    if (isGameOver()) return;

    const dmg = randInt(3, 7);
    state.enemy.hp = clamp(state.enemy.hp - dmg, 0, state.enemy.max);
    addLog(`You strike the Slime for ${dmg} damage.`);

    if (state.enemy.hp <= 0) {
      endGame("The Slime dissolves. You win!");
      return;
    }

    enemyTurn();
  }

  function playerHeal() {
    if (isGameOver()) return;

    const heal = randInt(4, 7);
    const before = state.player.hp;
    state.player.hp = clamp(state.player.hp + heal, 0, state.player.max);
    const actual = state.player.hp - before;

    addLog(actual > 0 ? `You heal for ${actual} HP.` : "You try to heal, but you're already at full HP.");

    enemyTurn();
  }

  function playerGuard() {
    if (isGameOver()) return;

    if (!state.player.guarding) {
      state.player.guarding = true;
      addLog("You raise your guard.");
    } else {
      addLog("You're already guarding.");
    }

    enemyTurn();
  }

  function restart() {
    state = (typeof structuredClone === "function") ? structuredClone(INITIAL) : JSON.parse(JSON.stringify(INITIAL));
    render();
  }

  if (els.attackBtn instanceof HTMLButtonElement) els.attackBtn.addEventListener("click", playerAttack);
  if (els.healBtn instanceof HTMLButtonElement) els.healBtn.addEventListener("click", playerHeal);
  if (els.guardBtn instanceof HTMLButtonElement) els.guardBtn.addEventListener("click", playerGuard);
  if (els.restartBtn instanceof HTMLButtonElement) els.restartBtn.addEventListener("click", restart);

  render();
}
