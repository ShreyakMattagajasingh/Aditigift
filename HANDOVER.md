# HANDOVER: A Gift for Aditi

Last updated: 2026-07-24

This is the current continuation guide for the browser game in this directory.
Read it before changing scenes, persistence, multiplayer, or asset placement.
The old handover had become historical and contradicted the implementation;
this document describes the code that exists now.

## 1. Project Summary

`A Gift for Aditi` is a Pokemon-inspired top-down pixel-art game set around
Saxony Apartments and nearby Madison locations. It is a personal gift from
Shreyak to Aditi.

The game currently supports:

- Aditi and Shreyak as playable characters.
- Solo play and two-player online play.
- Separate Aditi and Shreyak bedrooms.
- The Sax Apartments corridor.
- A camera-following outside neighborhood map.
- Kung Fu Tea and Chocolate Shoppe interiors.
- Shared movement, outfits, chat bubbles, and dev layouts online.
- Inventories and item gifting.
- Photo galleries, editable notes, uploads, and a photo booth.
- A server-backed two-player Connect Four game.
- A timed claw-machine game with inventory prizes.
- Persistent in-game asset placement through Dev Mode.

Character canon:

- Aditi is the girl character.
- Shreyak is the guy character with short hair.
- Madison is the city, never a character name.
- Online host is Aditi and online joiner is Shreyak.
- The server intentionally allows only those two roles in a room.

## 2. Technology

- Vanilla JavaScript with native ES modules.
- Phaser 3.70, vendored as `js/phaser.min.js`.
- Node.js HTTP and WebSocket server in `server.js`.
- `ws` for multiplayer transport.
- `connect-four` for Connect Four rules.
- No bundler and no compile step.
- Pixel assets are loaded directly from `assets/`.

Important entry points:

- `index.html`: landing page, HTML overlays, photo galleries, character
  selection, fullscreen request, and multiplayer lobby controls.
- `js/main.js`: Phaser configuration and scene registration.
- `js/scenes/Boot.js`: asset loading and runtime image cleanup.
- `server.js`: static hosting, persistent layout API, WebSocket multiplayer,
  and authoritative Connect Four state.

## 3. Running The Game

Install dependencies once:

```powershell
npm install
```

Run the full game:

```powershell
npm start
```

Default URL:

```text
http://localhost:8934/
```

Use the Node server for normal development. It provides all of these from one
origin:

- Static files.
- `GET /api/layouts`.
- `PUT /api/layouts/:sceneId`.
- WebSocket endpoint `/multiplayer`.

The port can be changed:

```powershell
$env:PORT=9000
npm start
```

Static hosting such as `python -m http.server 8934` supports basic solo play,
but it does not provide multiplayer or server-persisted layouts.

Do not open `index.html` through `file://`; browser asset loading will fail.

### VS Code Port Forwarding

1. Start the Node server first.
2. Confirm `http://localhost:8934/` works locally.
3. Open the VS Code `PORTS` panel.
4. Forward the same running port, normally `8934`.
5. Set visibility to Public if a friend must access it.

An HTTP 502 from `*.use.devtunnels.ms` usually means the tunnel exists but no
process is listening on that exact port, or the Node process stopped. The
`Running Process` column in VS Code should show the Node process.

Do not start a second server on port 8934 if one is already running.

## 4. Player Controls

General:

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move |
| E | Interact, advance dialogue, or finish typed dialogue |
| Q | Open or close inventory |
| Escape | Close the active menu or minigame |
| T | Open retro chat input |
| Enter | Send chat message |
| G | Open the give-item menu near the other character in a bedroom |
| F2 | Toggle Dev Mode |

Inventory:

- Items display an icon next to the item name.
- Coffee, M&M, and KitKat use generated pixel icons.
- Claw prizes use their real toy textures.
- Six item types are shown per page.
- Left and right arrows change inventory pages.
- `Q` or `Escape` closes the inventory.

Connect Four:

| Control | Action |
| --- | --- |
| Left / Right | Select column |
| E / Space | Drop piece |
| R | Rematch after a win or draw |
| Escape | Leave table |

Claw machine:

| Control | Action |
| --- | --- |
| A/D or Left/Right | Move claw with acceleration and momentum |
| Space | Drop claw or start another round |
| Escape | Leave claw game |
| F2 | Enter or leave toy arrangement mode |

## 5. Scene Flow

Registered Phaser scenes:

1. `Boot`
2. `Room`
3. `Corridor`
4. `Outside`
5. `KungFuTea`
6. `ChocolateShoppe`

Main route:

```text
Landing
  -> Room
  -> Corridor
  -> Outside
  -> KungFuTea or ChocolateShoppe
```

Specific transitions:

- A bedroom exit door starts `Corridor`.
- Aditi's corridor door starts `Room` for Aditi.
- Shreyak's corridor door starts `Room` with `owner: "Shreyak"`.
- The corridor elevator starts `Outside` near `saxony-305n`.
- The Saxony outside building starts `Corridor` near the elevator.
- Kung Fu Tea starts its interior scene.
- Kung Fu Tea's red exit returns to `Outside` near `kung-fu-tea`.
- Chocolate Shoppe starts its interior scene.
- Chocolate Shoppe's exit returns to `Outside` near
  `chocolate-shoppe-ice-cream`.

Transition payloads use one of these forms:

```js
{ spawn: { x, y } }
{ spawnNearAsset: "asset-id" }
{ owner: "Shreyak", spawnNearAsset: "door" }
```

Both `Corridor` and `Outside` resolve `spawnNearAsset` after applying the
saved Dev Mode layout. They then search for the nearest walkable point. This
keeps spawn positions correct when a door or building has been moved.

## 6. Scene Details

### Boot

`js/scenes/Boot.js`

- Loads all room, corridor, outside, shop, minigame, and character assets.
- Character sheets are 40x48 frames.
- Sheets have 3 columns and 4 direction rows:
  `down`, `up`, `left`, `right`.
- Removes checkerboard, white, or gray source backgrounds at runtime.
- Creates cleaned Phaser canvas textures and removes source textures.
- Stores the cleaned photo-booth print as a data URL.
- Starts the selected player's bedroom.

When adding a new image that needs cleanup, load it under a `-source` key and
run the appropriate Boot cleanup helper before any scene uses the final key.

### Room

`js/scenes/Room.js`

- Native portrait size: 288x384.
- Uses a custom room layout/editor implementation rather than
  `SceneDevEditor`.
- Aditi and Shreyak use independent room layout keys.
- Shreyak's room starts as a related layout but has independent assets and
  persistence.
- Both characters are fully playable.
- Interactions depend on the active player and room owner.
- Aditi can borrow Shreyak's hoodie from his wardrobe.
- Borrowed hoodie color/art is in
  `assets/characters/player_borrowed_hoodie_v3.png`.
- Outfit selection is available from Aditi's wardrobe.
- Photo frames open owner-specific galleries.
- Walking into the exit door automatically starts the corridor.
- The room exit door is protected from Dev Mode deletion.
- `G` opens item gifting when the other character is nearby.

Room layout code is large and specialized. Be careful when changing its asset
schema because it handles clones, interactions, collision, followers, and
room ownership itself.

### Corridor

`js/scenes/Corridor.js`

- Landscape size: 640x384.
- Bright yellow walls, corridor floor, dark room doors, elevator, vending
  machine, and photo frame.
- Uses `SceneDevEditor` with key `aditi-corridor-layout-v1`.
- Doors to Aditi's and Shreyak's rooms work.
- Other apartment doors currently show locked/no-answer dialogue.
- Elevator goes to Outside.
- The corridor photo frame uses the `Corridor` gallery data set.

Vending behavior:

- Aditi receives `Dunkin coffee`.
- Shreyak receives `M&M`.
- Shreyak also sends Aditi either `Dunkin coffee` or `KitKat`.
- Online gifts are relayed to the intended player's browser.

### Outside

`js/scenes/Outside.js`

- World size: 1086x1448.
- Normal play viewport: 640x512 with camera follow.
- Dev Mode viewport: complete 1086x1448 map for placement.
- Base map texture: `assets/outsidesax/outsidesaxmap.png`.
- Layout key: `aditi-outside-saxony-layout-v6`.
- Green map pixels are treated as grass and are unwalkable.
- Other map colors are generally walkable unless blocked by bounds.
- Spawn search samples the current map and finds the nearest walkable point.
- Building interactions follow moved/scaled/rotated assets.
- Labels are followers and move with their building.

Current outside assets include Saxony, Ian's, Kung Fu Tea, Chocolate Shoppe,
Colectivo, Colectivo chairs, and a bus stop, plus earlier Frances Street
placeholder buildings.

The map is in an active placement phase. Real-world geography and user-provided
map references override invented layout assumptions.

Critical scene-reuse rule:

Phaser reuses a Scene instance when it is restarted. At the beginning of
`Outside.create()`, old UI references must be set to `null` before the first
viewport layout pass. Otherwise a second return from any building attempts to
resize destroyed Phaser objects and stops scene creation with:

```text
TypeError: Cannot read properties of null (reading 'setSize')
```

The current code clears `player`, dialogue UI, prompt, chat system, and
inventory panel references before calling `_configureViewport()`. Preserve
that ordering.

### Kung Fu Tea

`js/scenes/KungFuTea.js`

- Size: 640x512.
- Interior texture: `inside-kung-fu-tea`.
- Layout key: `aditi-kung-fu-tea-layout-v1`.
- Walkable area is defined by a polygon.
- Tables are explicit solid rectangles.
- Includes Connect Four, a photo frame, and a photo booth.
- The red door returns to Outside.

Connect Four:

- Requires an online multiplayer room.
- First player joins and waits.
- The nearby second player is invited automatically.
- Server owns board state, turn state, win/draw status, and rematches.
- Aditi uses red pieces; Shreyak uses yellow.
- Rules come from the `connect-four` package.

Photo booth:

- Interaction runs a short flash/scale animation.
- Opens an HTML overlay.
- Shows `assets/insidekungfutea/photoboothimage.png`.
- The print can be downloaded.

### Chocolate Shoppe

`js/scenes/ChocolateShoppe.js`

- Size: 640x512.
- Layout key: `aditi-chocolate-shoppe-layout-v1`.
- Includes a movable chair, photo frame, and claw-machine asset.
- The shop exit returns to Outside.
- Interacting with the claw machine opens `ClawMachinePanel`.

Claw game:

- Turn duration is 7000 ms.
- Claw movement uses acceleration, max speed, friction, and tilt.
- The claw starts at the lower-left chute, rises, then moves toward center.
- A catch is based on horizontal distance from a visible toy center.
- A caught toy has a 40 percent chance to slip.
- A successful toy is carried to the bottom-left chute.
- The prize is added to the active player's inventory.
- Open and closed claw textures are both used.
- All fourteen toy assets load together.

Toy layout:

- Key: `aditi-claw-game-toys-layout-v1`.
- In Dev Mode, click a toy to select it.
- Arrows/WASD move the selected toy.
- Shift moves faster.
- X/Z resize.
- Positions and scale are persisted locally, to the server, and to the other
  multiplayer client.

## 7. Shared Systems

### Inventory

`js/systems/Inventory.js`

Storage key:

```text
aditi-inventory-v1
```

Shape:

```js
{
  Aditi: [{ name: "Dunkin coffee", count: 1 }],
  Shreyak: [{ name: "M&M", count: 1 }]
}
```

Inventory is browser-local. Online gifts are events delivered to the recipient
and then saved in that recipient's local storage. There is no canonical
server inventory or login account.

Important functions:

- `getInventory(player)`
- `addInventoryItem(player, name)`
- `deliverInventoryItem(player, name)`
- `transferInventoryItem(from, to, name)`

New item names automatically receive a generic bag icon. Add a mapping in
`ITEM_TEXTURES` when a specific icon is available.

### Chat

`js/systems/ChatSystem.js`

- `T` begins typing.
- `Enter` sends.
- `Escape` cancels.
- Messages are limited to 120 characters.
- Local and remote messages appear in retro bubbles above the character.
- Bubble lifetime is 4500 ms.
- Chat is scene-scoped; players in different scenes do not see each other's
  bubble.

### Remote Players

`js/systems/RemotePlayer.js`

- Sends local scene, position, direction, movement frame, and outfit.
- Displays the peer only when both players have the same `sceneId`.
- Smooths peer movement with interpolation.
- Uses `npc_shreyak` for Shreyak and outfit textures for Aditi.

### Scene Dev Editor

`js/systems/SceneDevEditor.js`

Used by Corridor, Outside, Kung Fu Tea, and Chocolate Shoppe.

Controls:

| Control | Action |
| --- | --- |
| Click | Select topmost visible asset |
| Arrows | Move selected asset |
| Shift + arrows | Move faster |
| X / Z | Enlarge / shrink |
| R | Rotate 15 degrees |
| Shift + R | Rotate -15 degrees |
| Page Up / Page Down | Change depth |
| Ctrl+D | Duplicate |
| Delete / Backspace | Delete |
| F2 | Leave or enter Dev Mode |

Each editable asset can have:

- `id`
- `sourceId`
- Phaser `image`
- `interaction`
- `followers`
- base dimensions, scale, depth, rotation, and deleted state

Moving, rotating, or resizing an asset updates its interaction bounds. Followers
such as labels move with the asset.

### Layout Store

`js/systems/LayoutStore.js`

Layout precedence when a scene starts:

1. Browser local storage is read immediately.
2. Multiplayer room layout overrides local layout when available.
3. Server-persisted layout from `/api/layouts` is applied after the API loads.

Every new Dev Mode save writes to:

- Browser local storage.
- Current multiplayer room state.
- `data/layouts.json` through the layout API.

This is why layouts remain the same for both players and survive VS Code port
forwarding. The server file is the cross-browser source of truth.

Current persisted layout keys:

- `aditi-room-layout-v1`
- `shreyak-room-layout-v1`
- `aditi-corridor-layout-v1`
- `aditi-outside-saxony-layout-v6`
- `aditi-kung-fu-tea-layout-v1`
- `aditi-chocolate-shoppe-layout-v1`
- `aditi-claw-game-toys-layout-v1`

Do not rename a layout key casually. A new key makes the scene appear to reset
because it no longer reads the saved record.

## 8. Multiplayer

Client:

```text
js/systems/Multiplayer.js
```

Server:

```text
server.js
```

Transport:

```text
ws://host/multiplayer
wss://host/multiplayer when the page uses HTTPS
```

Room rules:

- Six-character uppercase room code.
- Maximum two players.
- Aditi must host before Shreyak can join.
- Duplicate role connections are rejected.

Relayed messages:

- `state`
- `layout`
- `chat`
- `inventory-gift`
- `connect4-join`
- `connect4-move`
- `connect4-restart`
- `connect4-leave`

Server-authoritative data:

- Connect Four board and turn state.
- Persistent Dev Mode layouts in `data/layouts.json`.

Client-authoritative or browser-local data:

- Player movement.
- Outfit selection.
- Inventory contents.
- Gallery notes and uploaded photos.

This is friendly co-op, not cheat-resistant networking.

## 9. HTML Overlays And Galleries

Gallery and photo-booth UI live in `index.html`, outside Phaser.

Gallery owners:

- `Aditi`: `assets/bedroom/images`
- `Shreyak`: `assets/shreyakbedroom/images`
- `Corridor`: `assets/insidesax/images`
- `KungFuTea`: `assets/insidekungfutea/images`
- `ChocolateShoppe`: `assets/insidechocolateshoppe/images`

Bundled photo lists are currently declared manually in `index.html`. Adding a
file to a folder does not automatically add it to the gallery; add the file
name to the matching `photoSets` entry.

Notes and user-added photos are stored in browser local storage. Uploaded
photos are encoded as data URLs, so large files can exhaust local-storage
quota. They are not synchronized between players.

Global overlay flags used by Phaser:

- `window.__roomGalleryOpen`
- `window.__photoBoothOpen`
- `window.__openPhotoGallery`
- `window.__openPhotoBooth`

## 10. Persistence Reference

Important browser keys:

| Key | Purpose |
| --- | --- |
| `aditi-active-player` | Selected playable character |
| `aditi-outfit` | Aditi's current outfit |
| `aditi-borrowed-hoodie` | Hoodie unlocked flag |
| `aditi-dev-mode` | Global Dev Mode enabled flag |
| `aditi-inventory-v1` | Both browser-local inventories |
| Scene layout keys | Asset position, scale, angle, depth, clones, deletion |
| Gallery note keys | Editable note text |
| Gallery upload keys | User-added data URL photos |

Persistent server file:

```text
data/layouts.json
```

Back up this file before intentionally resetting or migrating layout schemas.
Never delete it as a generic cleanup step.

## 11. Asset Organization

Main folders:

- `assets/bedroom`
- `assets/shreyakbedroom`
- `assets/insidesax`
- `assets/outsidesax`
- `assets/insidekungfutea`
- `assets/insidechocolateshoppe`
- `assets/characters`
- `assets/frances`
- `assets/town`
- `assets/layout`

Naming is not fully normalized. Some historical source files contain typos,
spaces, versioned duplicates, or unclean backgrounds. Use the exact path in
Boot rather than assuming a corrected filename.

Asset rules:

- Preserve pixel-art rendering.
- Avoid browser smoothing.
- Character sprite sheets must stay 40x48 per frame.
- Keep all four direction rows the same apparent character size.
- Prefer a new cache-busting query such as `?v=2` when replacing an asset at
  the same URL.
- Do not overwrite the player's currently positioned asset with a different
  intrinsic crop without checking its saved scale and interaction bounds.

The `tools/` folder contains Python scripts used to generate or clean older
pixel assets. Keep it intact.

## 12. Testing Checklist

Syntax-check all JavaScript:

```powershell
Get-ChildItem js -Recurse -Filter *.js |
  ForEach-Object { node --check $_.FullName }
node --check server.js
```

Basic server checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8934/
Invoke-WebRequest -UseBasicParsing http://localhost:8934/api/layouts
```

Manual regression route:

1. Start as Aditi.
2. Move in all four directions and check equal sprite size.
3. Exit Aditi's room into Corridor.
4. Enter and exit Shreyak's room.
5. Use the elevator to Outside.
6. Enter and exit Kung Fu Tea.
7. Enter and exit Chocolate Shoppe.
8. Re-enter both buildings a second time.
9. Open inventory and verify item icons and pagination.
10. Toggle Dev Mode in every scene.
11. Move an asset, reload, and verify the position persists.
12. Repeat using the forwarded URL in a second browser.

Two-player regression:

1. Host as Aditi and join as Shreyak with the same room code.
2. Confirm both avatars appear in the same scene.
3. Confirm scene changes hide the peer until both are together again.
4. Send chat with `T`.
5. Move an asset in Dev Mode and verify the other client updates.
6. Give an inventory item in a bedroom.
7. Collect vending-machine rewards.
8. Join Connect Four from both clients and finish a game.

Claw regression:

1. Verify all fourteen toys render together.
2. Verify the claw starts at the chute and completes its intro.
3. Test misses, catches, slips, chute delivery, timeout, replay, and Escape.
4. In Dev Mode, move and resize several toys.
5. Reload and verify every toy returns to its saved position and scale.

Always check browser console errors during scene transitions. Phaser can stop a
scene during `create()` while leaving the previous canvas visible, which can
look like frozen input rather than an obvious exception.

## 13. Recent Fixes

### Inventory icons

`InventoryPanel` now renders an icon beside every inventory item. Plush prizes
reuse actual claw-game textures. Coffee and candy use generated pixel icons.
Unknown item names fall back to a bag icon. The inventory paginates after six
item types.

### Building exit crash

Returning to Outside a second time previously crashed during
`Outside.create()`. Phaser reused the Scene instance, and the early viewport
layout pass found references to UI objects destroyed during the previous
shutdown.

Fix:

- Clear stale player and UI references at the start of `Outside.create()`.
- Then call `_configureViewport()`.
- Rebuild all scene objects afterward.

This was reproduced and verified with repeated transitions through Room,
Corridor, Outside, Kung Fu Tea, and Chocolate Shoppe, including Dev Mode and
a populated inventory.

### Landscape shop interiors

Kung Fu Tea and Chocolate Shoppe now use a fixed `800x450` 16:9 viewport and
room world. Their square source artwork is scaled proportionally and centered
so its meaningful top and bottom remain visible without camera cropping. Both
canvases use the `game-widescreen` class.

The old `640x512` and interim enlarged Dev Mode layouts are migrated once by
`SceneDevEditor`. Both shop layouts now carry
`layoutVersion: "landscape-fit-v3"`; do not remove that field or the
coordinates will be transformed a second time. The migrated layouts remain
server-persisted and shared by both players.

Connect Four and the claw-machine overlay are scaled and centered within the
new landscape viewport. Their backgrounds cover the full screen and their
footer controls remain visible.

Verified at `1600x900`:

- Both shops render at `800x450` with undistorted artwork.
- Both default spawns are walkable and allow movement.
- Both exits return to Outside.
- Connect Four and the claw game fit without clipped controls.

## 14. Known Limitations And Technical Debt

- Movement and dialogue logic are duplicated across scenes.
- `Room` has a separate editor implementation from `SceneDevEditor`.
- Inventories are not server-authoritative.
- Gallery uploads and notes are not multiplayer-synchronized.
- Uploaded data URLs can exceed local-storage quota.
- Outside walkability is color-derived and can misclassify future map art if
  its green palette changes.
- Building collision outside is mostly interaction and map driven rather than
  a complete physical footprint system.
- Connect Four requires online multiplayer and has no local two-controller
  mode.
- The landing page and all overlay logic are concentrated in `index.html`.
- There is no automated test suite committed to the repository.
- Phaser Scene instances are reused. Any property accessed before it is
  rebuilt must not point to a destroyed Game Object from the previous run.

Do not begin with a large refactor. Continue the game in small, verified steps.
The current duplicated scene code is imperfect but understandable and working.

## 15. Recommended Next Work

Highest-value next steps:

1. Continue placing and validating Outside assets against the user's annotated
   real-world map.
2. Add interiors only after their outside entrances and return spawns are
   correct.
3. Add a small shared transition helper that validates destination scene and
   spawn data, without rewriting every scene.
4. Add browser smoke tests for repeated scene transitions.
5. Add server-backed shared gallery data only if cross-device memories become
   a requirement.
6. Extract shared movement only after behavior is covered by regression tests.

For every new building:

1. Add its outside texture in Boot.
2. Add an editable outside asset with a stable ID.
3. Add its scene to `js/main.js`.
4. Add an entrance payload.
5. Add a return payload using `spawnNearAsset`.
6. Give the interior a unique layout storage key.
7. Test first entry, first exit, second entry, and second exit.
8. Test with Dev Mode both enabled and disabled.

## 16. Working Agreements

- Treat annotated screenshots as implementation requirements.
- Real-world layout accuracy matters more than decorative invention.
- Always inspect newly added asset files rather than assuming their crop or
  transparency is correct.
- Preserve user-created Dev Mode layouts and unrelated file changes.
- Do not reset `data/layouts.json` to solve a rendering problem.
- Test the forwarded URL when a feature depends on cross-browser persistence.
- Verify both Aditi and Shreyak whenever character art or interactions change.
- Keep UI and controls in the same retro visual language as the game.
- Report tests actually run; do not claim browser verification from syntax
  checks alone.
