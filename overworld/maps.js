// /overworld/maps.js
// Data-driven maps + tile definitions. Easy to expand.

export const TILE_SIZE = 32;

// Tile IDs:
// 0 grass (walkable)
// 1 tree/wall (blocked)
// 2 path (walkable)
// 3 water (blocked)

export const TILE = Object.freeze({
  GRASS: 0,
  WALL: 1,
  PATH: 2,
  WATER: 3,
});

export const BLOCKED_TILES = new Set([TILE.WALL, TILE.WATER]);

export const TILE_COLORS = Object.freeze({
  [TILE.GRASS]: "#58b957",
  [TILE.WALL]: "#2f6b2f",
  [TILE.PATH]: "#c9b07a",
  [TILE.WATER]: "#3b7dd8",
});

/**
 * Map format:
 * {
 *   name, width, height,
 *   tiles: number[] (length width*height),
 *   triggers: [{ x,y,type,targetMap,targetX,targetY }]
 * }
 */

function idx(x, y, w) {
  return y * w + x;
}

function makeFilled(w, h, value) {
  return Array.from({ length: w * h }, () => value);
}

function paintRect(tiles, w, x0, y0, rw, rh, value) {
  for (let y = y0; y < y0 + rh; y++) {
    for (let x = x0; x < x0 + rw; x++) {
      tiles[idx(x, y, w)] = value;
    }
  }
}

function paintBorderWalls(tiles, w, h) {
  for (let x = 0; x < w; x++) {
    tiles[idx(x, 0, w)] = TILE.WALL;
    tiles[idx(x, h - 1, w)] = TILE.WALL;
  }
  for (let y = 0; y < h; y++) {
    tiles[idx(0, y, w)] = TILE.WALL;
    tiles[idx(w - 1, y, w)] = TILE.WALL;
  }
}

function paintPond(tiles, w, x0, y0, rw, rh) {
  paintRect(tiles, w, x0, y0, rw, rh, TILE.WATER);
  // Outline pond with walls (trees) for a chunky retro look
  for (let y = y0 - 1; y <= y0 + rh; y++) {
    for (let x = x0 - 1; x <= x0 + rw; x++) {
      if (x < 0 || y < 0) continue;
      // Keep pond intact
      const isInside = x >= x0 && x < x0 + rw && y >= y0 && y < y0 + rh;
      if (!isInside) tiles[idx(x, y, w)] = TILE.WALL;
    }
  }
}

function makeTown() {
  const width = 12;
  const height = 10;
  const tiles = makeFilled(width, height, TILE.GRASS);

  // Border trees/walls
  paintBorderWalls(tiles, width, height);

  // A little "town square" path
  paintRect(tiles, width, 2, 2, 7, 1, TILE.PATH);
  paintRect(tiles, width, 5, 2, 1, 6, TILE.PATH);

  // A "doorway" path tile (trigger) near bottom
  tiles[idx(5, 8, width)] = TILE.PATH;

  // A gate on the east edge (edge transfer trigger)
  tiles[idx(width - 1, 4, width)] = TILE.PATH; // open the border at (11,4)

  // Small pond (water + tree outline) upper-right-ish
  paintPond(tiles, width, 8, 2, 2, 2);

  // Extra trees for shape
  tiles[idx(2, 6, width)] = TILE.WALL;
  tiles[idx(3, 6, width)] = TILE.WALL;
  tiles[idx(2, 7, width)] = TILE.WALL;

  return {
    name: "Town",
    width,
    height,
    tiles,
    triggers: [
      // Doorway to Route
      {
        x: 5,
        y: 8,
        type: "doorway",
        targetMap: "Route",
        targetX: 2,
        targetY: 8,
      },
      // East edge gate to Route
      {
        x: width - 1,
        y: 4,
        type: "edge",
        targetMap: "Route",
        targetX: 0,
        targetY: 4,
      },
    ],
  };
}

function makeRoute() {
  const width = 16;
  const height = 10;
  const tiles = makeFilled(width, height, TILE.GRASS);

  // Border trees/walls
  paintBorderWalls(tiles, width, height);

  // A horizontal path across the route
  paintRect(tiles, width, 1, 4, width - 2, 1, TILE.PATH);

  // West edge opening for gate back to Town
  tiles[idx(0, 4, width)] = TILE.PATH;

  // Doorway spot that matches Town's doorway destination
  tiles[idx(2, 8, width)] = TILE.PATH;

  // Some water (blocked) near bottom-right
  paintRect(tiles, width, 12, 6, 2, 2, TILE.WATER);

  // Some walls (trees) sprinkled
  tiles[idx(6, 2, width)] = TILE.WALL;
  tiles[idx(7, 2, width)] = TILE.WALL;
  tiles[idx(8, 2, width)] = TILE.WALL;

  return {
    name: "Route",
    width,
    height,
    tiles,
    triggers: [
      // West gate back to Town
      {
        x: 0,
        y: 4,
        type: "edge",
        targetMap: "Town",
        targetX: 10,
        targetY: 4,
      },
      // Doorway back to Town
      {
        x: 2,
        y: 8,
        type: "doorway",
        targetMap: "Town",
        targetX: 5,
        targetY: 7,
      },
    ],
  };
}

export const MAPS = Object.freeze({
  Town: makeTown(),
  Route: makeRoute(),
});
