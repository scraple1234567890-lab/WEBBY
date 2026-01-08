RPG Overworld Prototype (Phase 1) - Embed-Safe Web Component
============================================================

What this is
------------
A small Pokémon-like overworld foundation for the browser:
- Tile-based stepping (32px tiles)
- Collision (blocked tiles)
- Two maps (Town, Route) with doorway + edge transfers
- Interact key (Space/Enter) checks the tile in front and logs a message
- Debug UI inside the component: map name, player (x,y), last 6 log lines

Maximum embed-safety
--------------------
This is a Web Component: <rpg-overworld> with Shadow DOM.
- All markup + CSS is encapsulated inside Shadow DOM.
- No global CSS modifications.
- No external fonts.
- No dependencies. No build step.
- Keyboard input is only processed when the component is focused.

How to run the demo
-------------------
Open overworld/index.html in a local server (recommended) or directly in a modern browser.

Embed into any existing website
-------------------------------
1) Copy the /overworld folder into your site’s public/static folder.
2) Add this script tag on the page where you want the game:

   <script type="module" src="./overworld/rpg-overworld.js"></script>

3) Place the component anywhere in your HTML:

   <rpg-overworld></rpg-overworld>

Notes:
- Click/tap the component to focus it, then use Arrow Keys or WASD to move.
- Because it uses Shadow DOM, CSS conflicts are extremely unlikely.
