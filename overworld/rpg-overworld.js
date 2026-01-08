// /overworld/rpg-overworld.js
// <rpg-overworld> Web Component with Shadow DOM, canvas rendering, discrete tile movement.

import {
  MAPS,
  TILE_SIZE,
  TILE,
  BLOCKED_TILES,
  TILE_COLORS,
} from "./maps.js";

const DIR = Object.freeze({
  UP: "up",
  DOWN: "down",
  LEFT: "left",
  RIGHT: "right",
});

const DIR_VECTORS = Object.freeze({
  [DIR.UP]: { dx: 0, dy: -1 },
  [DIR.DOWN]: { dx: 0, dy: 1 },
  [DIR.LEFT]: { dx: -1, dy: 0 },
  [DIR.RIGHT]: { dx: 1, dy: 0 },
});

// Movement tuning (classic stepping feel)
const MOVE_LOCK_MS = 150; // 120–180ms range
const HOLD_REPEAT_MS = 160; // controlled repeat, not too fast

// Keys mapping (Arrow + WASD)
function dirFromKey(key) {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return DIR.UP;
    case "ArrowDown":
    case "s":
    case "S":
      return DIR.DOWN;
    case "ArrowLeft":
    case "a":
    case "A":
      return DIR.LEFT;
    case "ArrowRight":
    case "d":
    case "D":
      return DIR.RIGHT;
    default:
      return null;
  }
}

function isInteractKey(key) {
  return key === " " || key === "Enter";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

class RPGOverworld extends HTMLElement {
  constructor() {
    super();

    // Shadow DOM for maximum embed-safety
    this._root = this.attachShadow({ mode: "open" });

    // Listener cleanup
    this._abort = new AbortController();

    // RAF
    this._rafId = 0;

    // State
    this._map = MAPS.Town;
    this._player = {
      x: 3,
      y: 3,
      facing: DIR.DOWN,
    };

    this._keysDown = new Set();
    this._lastDirPressed = null;

    this._moveLockedUntil = 0;
    this._nextRepeatAt = 0;

    // UI refs
    this._canvas = null;
    this._ctx = null;
    this._logEl = null;
    this._metaEl = null;

    // Debug log
    this._logs = [];
  }

  connectedCallback() {
    // Make focusable: keyboard input only when focused
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;

    this._renderShell();
    this._wireEvents();
    this._pushLog("Click here to focus. Then move with Arrow Keys / WASD.");

    this._resizeCanvasToMap();
    this._startLoop();
  }

  disconnectedCallback() {
    this._stopLoop();
    this._abort.abort();
  }

  // ---------- Shell / UI ----------

  _renderShell() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: inline-block;
        user-select: none;
        -webkit-user-select: none;
        outline: none;
      }

      .wrap {
        border: 1px solid rgba(0,0,0,0.18);
        border-radius: 14px;
        background: #0f1114;
        box-shadow: 0 8px 24px rgba(0,0,0,0.22);
        overflow: hidden;
        width: max-content;
        max-width: 100%;
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        background: linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.9);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
      }

      .title {
        display: flex;
        align-items: baseline;
        gap: 10px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }

      .hint {
        opacity: 0.8;
        font-weight: 500;
      }

      .stage {
        position: relative;
        padding: 12px;
        background: radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.06), rgba(255,255,255,0.0));
      }

      canvas {
        display: block;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.10);
        background: #000;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        touch-action: none;
      }

      .debug {
        display: grid;
        gap: 8px;
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        color: rgba(255,255,255,0.88);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
      }

      .meta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        opacity: 0.95;
      }

      .pill {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(0,0,0,0.18);
      }

      .label { opacity: 0.75; }
      .value { opacity: 1.0; }

      .log {
        white-space: pre-line;
        line-height: 1.25;
        opacity: 0.9;
      }

      :host(:focus) .wrap {
        border-color: rgba(120, 185, 255, 0.55);
        box-shadow: 0 10px 28px rgba(0,0,0,0.28), 0 0 0 3px rgba(120,185,255,0.18);
      }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    const topbar = document.createElement("div");
    topbar.className = "topbar";

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = `<span>Overworld Prototype</span><span class="hint">Click to focus</span>`;

    this._metaEl = document.createElement("div");
    this._metaEl.className = "meta";

    topbar.append(title, this._metaEl);

    const stage = document.createElement("div");
    stage.className = "stage";

    this._canvas = document.createElement("canvas");
    this._canvas.width = 1;
    this._canvas.height = 1;
    stage.appendChild(this._canvas);

    const debug = document.createElement("div");
    debug.className = "debug";

    this._logEl = document.createElement("div");
    this._logEl.className = "log";

    debug.append(this._logEl);

    wrap.append(topbar, stage, debug);

    this._root.innerHTML = "";
    this._root.append(style, wrap);

    const ctx = this._canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available.");
    this._ctx = ctx;
    this._ctx.imageSmoothingEnabled = false;
  }

  _resizeCanvasToMap() {
    const w = this._map.width * TILE_SIZE;
    const h = this._map.height * TILE_SIZE;

    // Internal pixel buffer (native pixels)
    this._canvas.width = w;
    this._canvas.height = h;

    // CSS scale (integer) for chunky pixel look
    const cssScale = 2;
    this._canvas.style.width = `${w * cssScale}px`;
    this._canvas.style.height = `${h * cssScale}px`;
  }

  // ---------- Events / Input ----------

  _wireEvents() {
    const s = this._abort.signal;

    // Focus on pointerdown (click/tap)
    this.addEventListener(
      "pointerdown",
      (e) => {
        // If embedded on a page, avoid selecting text or dragging images
        e.preventDefault();
        this.focus({ preventScroll: true });
      },
      { signal: s }
    );

    // Only handle keys when this component is focused.
    this.addEventListener(
      "keydown",
      (e) => this._onKeyDown(e),
      { signal: s }
    );
    this.addEventListener(
      "keyup",
      (e) => this._onKeyUp(e),
      { signal: s }
    );

    // If focus is lost, clear held keys so movement doesn't "stick"
    this.addEventListener(
      "blur",
      () => {
        this._keysDown.clear();
        this._lastDirPressed = null;
      },
      { signal: s }
    );
  }

  _onKeyDown(e) {
    const dir = dirFromKey(e.key);

    // Prevent page scroll + reduce conflicts with outer listeners
    if (dir || isInteractKey(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (dir) {
      this._keysDown.add(e.key);
      this._lastDirPressed = dir;

      // Step immediately on initial press (not on OS key repeat)
      if (!e.repeat) {
        const now = performance.now();
        this._tryStep(dir, now);
        this._nextRepeatAt = now + HOLD_REPEAT_MS;
      }
      return;
    }

    if (isInteractKey(e.key) && !e.repeat) {
      this._interact();
      return;
    }
  }

  _onKeyUp(e) {
    const dir = dirFromKey(e.key);
    if (dir || isInteractKey(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (dir) {
      this._keysDown.delete(e.key);
      // If released key was contributing to lastDirPressed, we will re-evaluate in loop.
    }
  }

  _getHeldDir() {
    // Prefer last pressed direction if still held
    if (this._lastDirPressed) {
      const stillHeld = Array.from(this._keysDown).some(
        (k) => dirFromKey(k) === this._lastDirPressed
      );
      if (stillHeld) return this._lastDirPressed;
    }

    // Otherwise pick a stable priority order
    const priority = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
    for (const d of priority) {
      const match = Array.from(this._keysDown).some((k) => dirFromKey(k) === d);
      if (match) return d;
    }
    return null;
  }

  // ---------- Game Logic ----------

  _tileAt(x, y) {
    if (x < 0 || y < 0 || x >= this._map.width || y >= this._map.height) {
      return null;
    }
    return this._map.tiles[y * this._map.width + x];
  }

  _triggerAt(x, y) {
    return this._map.triggers.find((t) => t.x === x && t.y === y) || null;
  }

  _isBlocked(x, y) {
    const t = this._tileAt(x, y);
    if (t == null) return true;
    return BLOCKED_TILES.has(t);
  }

  _tryStep(dir, now) {
    // Update facing regardless (classic feel)
    this._player.facing = dir;

    // Movement lock
    if (now < this._moveLockedUntil) return false;

    const { dx, dy } = DIR_VECTORS[dir];
    const nx = this._player.x + dx;
    const ny = this._player.y + dy;

    // Disallow walking off-map unless you made a trigger tile there (we keep it simple)
    if (nx < 0 || ny < 0 || nx >= this._map.width || ny >= this._map.height) {
      return false;
    }

    if (this._isBlocked(nx, ny)) {
      return false;
    }

    this._player.x = nx;
    this._player.y = ny;

    this._moveLockedUntil = now + MOVE_LOCK_MS;

    // Check triggers on the tile you stepped onto
    const trig = this._triggerAt(nx, ny);
    if (trig) {
      this._pushLog(
        trig.type === "doorway" ? "You step through the doorway…" : "You pass through the gate…"
      );
      this._loadMap(trig.targetMap, trig.targetX, trig.targetY);
    }

    return true;
  }

  _loadMap(name, x, y) {
    const next = MAPS[name];
    if (!next) {
      this._pushLog(`Missing map: ${name}`);
      return;
    }

    this._map = next;
    this._player.x = clamp(x, 0, next.width - 1);
    this._player.y = clamp(y, 0, next.height - 1);

    // Ensure spawn isn't blocked (simple fallback)
    if (this._isBlocked(this._player.x, this._player.y)) {
      this._player.x = 1;
      this._player.y = 1;
    }

    this._resizeCanvasToMap();
    this._pushLog(`Now entering: ${next.name}`);
  }

  _interact() {
    const dir = this._player.facing;
    const { dx, dy } = DIR_VECTORS[dir];
    const tx = this._player.x + dx;
    const ty = this._player.y + dy;

    const trig = this._triggerAt(tx, ty);
    if (trig) {
      this._pushLog("A doorway leads onward.");
      return;
    }

    const tile = this._tileAt(tx, ty);
    if (tile === TILE.WALL) {
      this._pushLog("A tree blocks the way.");
    } else if (tile === TILE.WATER) {
      this._pushLog("The water is calm.");
    } else if (tile == null) {
      this._pushLog("Nothing but the edge of the world.");
    } else {
      this._pushLog("Nothing special here.");
    }
  }

  // ---------- Logging / Debug UI ----------

  _pushLog(line) {
    this._logs.push(String(line));
    if (this._logs.length > 6) this._logs.splice(0, this._logs.length - 6);
    this._paintDebug();
  }

  _paintDebug() {
    if (!this._logEl || !this._metaEl) return;

    this._metaEl.innerHTML = `
      <span class="pill"><span class="label">Map</span><span class="value">${this._map.name}</span></span>
      <span class="pill"><span class="label">Player</span><span class="value">(${this._player.x},${this._player.y})</span></span>
      <span class="pill"><span class="label">Facing</span><span class="value">${this._player.facing}</span></span>
    `;

    this._logEl.textContent = this._logs.join("\n");
  }

  // ---------- Render Loop ----------

  _startLoop() {
    const tick = (t) => {
      this._rafId = requestAnimationFrame(tick);

      // Held-direction repeat stepping (only when focused)
      if (this.matches(":focus")) {
        const heldDir = this._getHeldDir();
        if (heldDir && t >= this._nextRepeatAt) {
          this._tryStep(heldDir, t);
          // Repeat cadence remains consistent whether blocked or not
          this._nextRepeatAt = t + HOLD_REPEAT_MS;
        }
      }

      this._draw();
    };

    this._paintDebug();
    this._rafId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  _draw() {
    const ctx = this._ctx;
    if (!ctx) return;

    const w = this._map.width;
    const h = this._map.height;

    // Tiles
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = this._map.tiles[y * w + x];
        ctx.fillStyle = TILE_COLORS[tile] || "#000";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        // Simple texture hinting: tiny corner dots for grass
        if (tile === TILE.GRASS) {
          ctx.fillStyle = "rgba(0,0,0,0.07)";
          ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, 2, 2);
          ctx.fillRect(x * TILE_SIZE + 22, y * TILE_SIZE + 18, 2, 2);
        }

        // Path: subtle stripe
        if (tile === TILE.PATH) {
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 14, TILE_SIZE - 8, 2);
        }

        // Water: tiny shine
        if (tile === TILE.WATER) {
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 8, 10, 2);
        }
      }
    }

    // Trigger markers (subtle)
    for (const tr of this._map.triggers) {
      const cx = tr.x * TILE_SIZE;
      const cy = tr.y * TILE_SIZE;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(cx + 12, cy + 12, 8, 8);
    }

    // Player
    const px = this._player.x * TILE_SIZE;
    const py = this._player.y * TILE_SIZE;

    // Body
    ctx.fillStyle = "#f0e7d8";
    ctx.fillRect(px + 10, py + 8, 12, 14);

    // Outfit
    ctx.fillStyle = "#d23a3a";
    ctx.fillRect(px + 10, py + 16, 12, 10);

    // Facing "nose" pixel
    ctx.fillStyle = "#1a1a1a";
    const nose = (() => {
      switch (this._player.facing) {
        case DIR.UP:
          return { x: px + 15, y: py + 8 };
        case DIR.DOWN:
          return { x: px + 15, y: py + 21 };
        case DIR.LEFT:
          return { x: px + 10, y: py + 16 };
        case DIR.RIGHT:
          return { x: px + 21, y: py + 16 };
        default:
          return { x: px + 15, y: py + 16 };
      }
    })();
    ctx.fillRect(nose.x, nose.y, 2, 2);

    // Outline for contrast
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.strokeRect(px + 10, py + 8, 12, 18);
  }
}

if (!customElements.get("rpg-overworld")) {
  customElements.define("rpg-overworld", RPGOverworld);
}
