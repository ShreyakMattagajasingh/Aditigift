import { TILE, MOVE_SPEED, OUTFITS, isTextInputActive, rectsOverlap } from "../shared.js";
import { getInventory, InventoryPanel, transferInventoryItem } from "../systems/Inventory.js";
import { multiplayer } from "../systems/Multiplayer.js";
import { layoutStore } from "../systems/LayoutStore.js";
import { RemotePlayer } from "../systems/RemotePlayer.js";
import { ChatSystem } from "../systems/ChatSystem.js";

const COLS = 9;
const ROWS = 12;

// Perimeter cutouts: 0 = no wall there because a furniture piece supplies its
// own art at that spot.
const TOP_ROW = [1, 1, 1, 0, 0, 0, 1, 1, 1];
const BOTTOM_ROW = [1, 1, 1, 1, 1, 1, 1, 1, 1];
const RIGHT_ROW = [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1];
const LAYOUT_STORAGE_KEY = "aditi-room-layout-v1";

export class RoomScene extends Phaser.Scene {
	constructor() {
		super("Room");
	}

	create() {
		this.game.canvas.classList.remove("game-landscape", "game-standard", "game-widescreen");
		this.game.canvas.classList.add("game-portrait");
		this.scale.setGameSize(288, 384);
		this.scale.refresh();
		if (screen.orientation?.unlock) screen.orientation.unlock();
		this.solids = []; // {x,y,w,h} pixel rects that block movement
		this.interactables = []; // {x,y,w,h,text,opensOutfitMenu}
		this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,G,Q,ESC,SHIFT,X,Z,R");
		this.devKeys = this.input.keyboard.addKeys({
			toggle: Phaser.Input.Keyboard.KeyCodes.F2,
			save: Phaser.Input.Keyboard.KeyCodes.ENTER,
			pageUp: Phaser.Input.Keyboard.KeyCodes.PAGE_UP,
			pageDown: Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN,
			delete: Phaser.Input.Keyboard.KeyCodes.DELETE,
			backspace: Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
		});
		this.roomOwner = this.scene.settings.data?.owner === "Shreyak" ? "Shreyak" : "Aditi";
		this.activePlayer = window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		window.__activePlayer = this.activePlayer;
		this.layoutStorageKey = this.roomOwner === "Shreyak" ? "shreyak-room-layout-v1" : LAYOUT_STORAGE_KEY;
		this.devMode = this._readDevMode();
		this.devAssets = [];
		this.devSelected = null;
		this.savedLayout = this._loadLayout();

		this._drawFloorAndWalls();
		this._placeFurniture();
		this._restoreClones();
		this._createPlayer();
		if (!multiplayer.connected) this._createNPC();
		this.remotePlayer = new RemotePlayer(this, `Room:${this.roomOwner}`);
		this.chatSystem = new ChatSystem(this, `Room:${this.roomOwner}`);
		this._createUI();
		this.inventoryPanel = new InventoryPanel(this);
		this._createDevModeControls();
		this._layoutListener = (event) => {
			if (event.detail.sceneId !== this.layoutStorageKey) return;
			this.savedLayout = event.detail.layout;
			this._applySavedLayout(this.savedLayout);
			this._refreshDevHint();
			this._drawDevOutline();
		};
		window.addEventListener("aditi-multiplayer-layout", this._layoutListener);
		this.events.once("shutdown", () => window.removeEventListener("aditi-multiplayer-layout", this._layoutListener));
		// The server layout is authoritative so a forwarded game never falls back
		// to a different browser's local room arrangement.
		layoutStore.ready.then(() => {
			const persisted = layoutStore.get(this.layoutStorageKey);
			if (persisted) {
				this.savedLayout = persisted;
				this._applySavedLayout(persisted);
				localStorage.setItem(this.layoutStorageKey, JSON.stringify(persisted));
				multiplayer.sendLayout(this.layoutStorageKey, persisted);
			} else if (this.savedLayout.positions && Object.keys(this.savedLayout.positions).length) {
				layoutStore.save(this.layoutStorageKey, this.savedLayout);
			}
			this._refreshDevHint();
			this._drawDevOutline();
		});
		this.input.on("pointerdown", (pointer) => this._selectDevAsset(pointer));
		this.input.keyboard.on("keydown-D", (event) => {
			if (isTextInputActive()) return;
			if (!this.devMode || !event.ctrlKey || !this.devSelected) return;
			event.preventDefault();
			this.devSelected = this._duplicateAsset(this.devSelected);
			this._refreshDevHint();
			this._drawDevOutline();
		});

		this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
	}

	_readDevMode() {
		try {
			return localStorage.getItem("aditi-dev-mode") === "1";
		} catch (err) {
			return false;
		}
	}

	_loadLayout() {
		try {
			const shared = multiplayer.getLayout(this.layoutStorageKey);
			if (shared) return shared;
			let raw = localStorage.getItem(this.layoutStorageKey);
			if (!raw && this.roomOwner === "Shreyak") {
				raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
				if (raw) localStorage.setItem(this.layoutStorageKey, raw);
			}
			const saved = JSON.parse(raw || "{}");
			if (saved.positions || saved.clones || saved.deleted) return { positions: {}, clones: [], deleted: [], ...saved };
			return { positions: saved, clones: [], deleted: [] };
		} catch (err) {
			return { positions: {}, clones: [], deleted: [] };
		}
	}

	_saveLayout() {
		if (!this.devMode) return;
		const layout = { positions: {}, clones: [], deleted: [] };
		for (const asset of this.devAssets) {
			if (asset.deleted) {
				layout.deleted.push(asset.id);
				continue;
			}
			layout.positions[asset.id] = { x: asset.x, y: asset.y, depth: asset.depth, scale: asset.scale, rotation: asset.image.angle };
			if (asset.sourceId && asset.sourceId !== asset.id) {
				layout.clones.push({ id: asset.id, sourceId: asset.sourceId, x: asset.x, y: asset.y, depth: asset.depth, scale: asset.scale, rotation: asset.image.angle });
			}
		}
		try {
			localStorage.setItem(this.layoutStorageKey, JSON.stringify(layout));
		} catch (err) {
			// Layout persistence is optional if browser storage is unavailable.
		}
		multiplayer.sendLayout(this.layoutStorageKey, layout);
		layoutStore.save(this.layoutStorageKey, layout);
	}

	// ---------------- floor / walls ----------------

	_drawFloorAndWalls() {
		const g = this.add.graphics();
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				this._drawCarpetTile(g, col, row);
				if (this._isBoundary(col, row)) {
					this._drawWallTile(g, col, row);
					this._maybeAddWallSolid(col, row);
				}
			}
		}
		this._drawCornerShadows(g);
	}

	_isBoundary(col, row) {
		if (col === COLS - 1 && RIGHT_ROW[row] === 0) return false;
		return row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1;
	}

	_maybeAddWallSolid(col, row) {
		let solid = true;
		if (row === 0) solid = TOP_ROW[col] === 1;
		else if (row === ROWS - 1) solid = BOTTOM_ROW[col] === 1;
		else if (col === COLS - 1) solid = RIGHT_ROW[row] === 1;
		if (solid) {
			this.solids.push({ x: col * TILE, y: row * TILE, w: TILE, h: TILE });
		}
	}

	_drawCarpetTile(g, col, row) {
		const x = col * TILE, y = row * TILE;
		g.fillStyle(0x8f8270, 1);
		g.fillRect(x, y, TILE, TILE);
		const seed = (col * 7 + row * 13) % 11;
		const sx = x + 6 + ((seed * 5) % (TILE - 12));
		const sy = y + 6 + ((seed * 3) % (TILE - 12));
		g.fillStyle(0x6e6252, 0.35);
		g.fillRect(sx, sy, 1, 1);
	}

	_drawWallTile(g, col, row) {
		const x = col * TILE, y = row * TILE;
		g.fillStyle(0xece6d8, 1);
		g.fillRect(x, y, TILE, TILE);
		const baseboard = 0xb8ae96;
		if (row === 0 || row === ROWS - 1) {
			g.fillStyle(0xf6f2e8, 1);
			g.fillRect(x, y, TILE, 3);
			g.fillStyle(baseboard, 1);
			g.fillRect(x, y + TILE - 3, TILE, 3);
		} else if (col === 0) {
			g.fillStyle(baseboard, 1);
			g.fillRect(x + TILE - 3, y, 3, TILE);
		} else if (col === COLS - 1) {
			g.fillStyle(baseboard, 1);
			g.fillRect(x, y, 3, TILE);
		}
	}

	_drawCornerShadows(g) {
		g.fillStyle(0x000000, 0.12);
		const corners = [[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]];
		for (const [cx, cy] of corners) {
			g.fillRect(cx * TILE, cy * TILE, 10, 10);
		}
	}

	// ---------------- furniture ----------------

	_placeFurniture() {
		const bedTexture = this.roomOwner === "Shreyak" ? "shreyakbed" : "pinkbed";
		const deskTexture = this.roomOwner === "Shreyak" ? "shreyakdesk" : "desk_v";
		const diaryTexture = this.roomOwner === "Shreyak" ? "shreyak-diary" : "aditi-diary";
		const canChangeOutfit = this.activePlayer === "Aditi" && this.roomOwner === "Aditi";
		const canBorrowHoodie = this.activePlayer === "Aditi" && this.roomOwner === "Shreyak";
		this._place({ x: 96, y: 0, wt: 3, ht: 2, tex: "blinds", text: this._interactionText("window") });
		this._placeLamp(128, 32);
		this._place({ x: 192, y: 32, wt: 2, ht: 2, tex: "shelves", alignX: 1, solid: false, text: this._interactionText("shelves") });
		this._place({ id: "pinkbed", x: 32, y: 75, wt: 3, ht: 4, tex: bedTexture, alignX: 0, text: this._interactionText("bed") });
		this._place({ id: "desk_v", x: 192, y: 96, wt: 2, ht: 3, tex: deskTexture, text: this._interactionText("desk") });
		this._place({ x: 160, y: 128, wt: 1, ht: 1, tex: "chair", text: this._interactionText("chair") });
		this._place({
			x: 32, y: 224, wt: 2, ht: 3, tex: "cupboard", alignX: 0,
			opensOutfitMenu: canChangeOutfit,
			borrowsHoodie: canBorrowHoodie,
			text: canChangeOutfit || canBorrowHoodie ? "" : this._interactionText("cupboard"),
		});
		this._place({ id: "mirror", x: 224, y: 192, wt: 2, ht: 2, tex: "mirror", alignX: 0.5, solid: false, text: this._interactionText("mirror") });
		this._place({ id: "photoframe", x: 240, y: 32, wt: 1, ht: 2, tex: "photoframe", alignX: 0.5, alignY: 0, solid: false, opensPhotoGallery: true });
		this._place({ id: "diary", x: 216, y: 126, wt: 1, ht: 1, tex: diaryTexture, alignX: 0.5, alignY: 0.5, solid: false, text: this._interactionText("diary") });
		this._placeDoor();
	}

	_interactionText(item) {
		const ownRoom = this.activePlayer === this.roomOwner;
		const owner = this.roomOwner;
		const visitor = this.activePlayer;
		const own = {
			window: "The familiar view outside your window.",
			shelves: "Your shelves, arranged exactly the way you like them.",
			bed: "Your bed. Reliable, comfortable, and difficult to leave.",
			desk: "Your desk, with every project left exactly where you remember it.",
			chair: "Your chair. It is never quite tucked in straight.",
			cupboard: "Your wardrobe. You already know what is inside.",
			mirror: "You check your reflection. Looking good.",
			diary: "Your diary. Every page belongs to you.",
		};
		if (ownRoom) return own[item];
		const visitorLines = {
			window: `${owner}'s view of the city feels a little different from here.`,
			shelves: `${owner}'s shelves. You resist the urge to inspect everything.`,
			bed: `${owner}'s bed. ${visitor === "Shreyak" ? "Definitely ask before sitting." : "It looks comfier than he admits."}`,
			desk: `${owner}'s desk. ${visitor === "Shreyak" ? "Her art supplies make perfect sense to her, somehow." : "His setup is tidier than expected."}`,
			chair: `${owner}'s chair. You leave it where it is.`,
			cupboard: `${owner}'s wardrobe. Opening it would be a little too nosy.`,
			mirror: `${owner}'s mirror catches you looking around the room.`,
			diary: `${owner}'s diary. Private means private, so you leave it closed.`,
		};
		return visitorLines[item];
	}

	_placeDoor() {
		const saved = this.savedLayout.positions.door || {};
		const asset = {
			id: "door", sourceId: "door", x: saved.x ?? 272, y: saved.y ?? 320,
			w: 32, h: 64, baseW: 32, baseH: 64, baseDisplayWidth: 64, baseDisplayHeight: 32,
			center: true, depth: saved.depth ?? 1, scale: saved.scale ?? 1, rotation: saved.rotation ?? 90,
		};
		asset.image = this.add.image(asset.x, asset.y, "door")
			.setOrigin(0.5)
			.setDisplaySize(asset.baseDisplayWidth * asset.scale, asset.baseDisplayHeight * asset.scale)
			.setAngle(asset.rotation)
			.setDepth(asset.depth);
		this.devAssets.push(asset);

		this.interactables.push({
			x: asset.x - 16,
			y: asset.y - 32,
			w: asset.w,
			h: asset.h,
			text: "The door out to Frances St. (The rest of the map is being rebuilt for the web version — for now, this just leads back to itself.)",
		});
		asset.interactable = this.interactables[this.interactables.length - 1];
		asset.interactable.scene = "Corridor";
		asset.interactable.data = this.scene.settings.data?.owner === "Shreyak"
			? { spawnNearAsset: "door-bottom-112" }
			: { spawnNearAsset: "door-top-528" };
		asset.interactable.isExitDoor = true;
		this.exitDoor = asset.interactable;
		asset.interactionData = { text: asset.interactable.text, opensOutfitMenu: false };
		this._applyAssetScale(asset);
	}

	// Scales the sprite to fit inside its tile footprint (no distortion) and
	// aligns it within that box — same approach as the Godot Furniture.gd.
	_place({ id, x, y, wt, ht, tex, alignX = 0.5, alignY = 1, solid = true, text = "", opensOutfitMenu = false, borrowsHoodie = false, opensPhotoGallery = false }) {
		id = id || tex;
		const saved = this.savedLayout.positions[id] || {};
		x = saved.x ?? x;
		y = saved.y ?? y;
		const w = wt * TILE, h = ht * TILE;
		const src = this.textures.get(tex).getSourceImage();
		const scale = Math.min(w / src.width, h / src.height);
		const dw = src.width * scale, dh = src.height * scale;
		const px = x + (w - dw) * alignX;
		const py = y + (h - dh) * alignY;
		const asset = {
			id, sourceId: id, x, y, w, h, baseW: w, baseH: h,
			baseDisplayWidth: dw, baseDisplayHeight: dh,
			baseOffsetX: px - x, baseOffsetY: py - y,
			depth: saved.depth ?? 1, scale: saved.scale ?? 1, rotation: saved.rotation ?? 0,
			image: this.add.image(px, py, tex).setOrigin(0, 0).setDisplaySize(dw, dh).setDepth(saved.depth ?? 1).setAngle(saved.rotation ?? 0),
		};
		this.devAssets.push(asset);

		if (solid) {
			asset.solidRect = { x, y, w, h };
			this.solids.push(asset.solidRect);
		}
		if (text || opensOutfitMenu || borrowsHoodie || opensPhotoGallery) {
			this.interactables.push({ x, y, w, h, text, opensOutfitMenu, borrowsHoodie, opensPhotoGallery });
			asset.interactable = this.interactables[this.interactables.length - 1];
			asset.interactionData = { text, opensOutfitMenu, borrowsHoodie, opensPhotoGallery };
		}
		asset.solid = solid;
		this._applyAssetScale(asset);
	}

	_restoreClones() {
		this._applySavedLayout(this.savedLayout);
	}

	_applySavedLayout(layout) {
		for (const asset of this.devAssets.filter((entry) => entry.sourceId !== entry.id)) {
			this._removeAssetCollisionAndInteraction(asset);
			asset.image.destroy();
		}
		this.devAssets = this.devAssets.filter((entry) => entry.sourceId === entry.id);
		const deletedIds = new Set(layout?.deleted || []);
		for (const asset of this.devAssets) {
			asset.deleted = deletedIds.has(asset.id);
			const saved = layout?.positions?.[asset.id];
			if (saved) {
				asset.x = saved.x ?? asset.x;
				asset.y = saved.y ?? asset.y;
				asset.depth = saved.depth ?? asset.depth;
				asset.scale = saved.scale ?? asset.scale;
				asset.rotation = saved.rotation ?? asset.rotation;
			}
			asset.image.setVisible(!asset.deleted);
			if (asset.deleted) this._removeAssetCollisionAndInteraction(asset);
			else this._restoreAssetCollisionAndInteraction(asset);
			this._applyAssetScale(asset);
		}
		for (const savedClone of layout?.clones || []) {
			const source = this.devAssets.find((asset) => asset.id === savedClone.sourceId && !asset.deleted);
			if (source) this._duplicateAsset(source, savedClone, false);
		}
	}

	_removeAssetCollisionAndInteraction(asset) {
		if (asset.solidRect) this.solids = this.solids.filter((solid) => solid !== asset.solidRect);
		if (asset.interactable) this.interactables = this.interactables.filter((item) => item !== asset.interactable);
	}

	_restoreAssetCollisionAndInteraction(asset) {
		if (asset.solidRect && !this.solids.includes(asset.solidRect)) this.solids.push(asset.solidRect);
		if (asset.interactable && !this.interactables.includes(asset.interactable)) this.interactables.push(asset.interactable);
	}

	_duplicateAsset(source, saved = null, persist = true) {
		const id = saved?.id || `${source.id}-copy-${Date.now()}-${this.devAssets.length}`;
		const copy = {
			id,
			sourceId: source.sourceId || source.id,
			x: saved?.x ?? source.x + TILE,
			y: saved?.y ?? source.y + TILE,
			w: source.w,
			h: source.h,
			baseW: source.baseW,
			baseH: source.baseH,
			baseDisplayWidth: source.baseDisplayWidth,
			baseDisplayHeight: source.baseDisplayHeight,
			baseOffsetX: source.baseOffsetX,
			baseOffsetY: source.baseOffsetY,
			center: source.center,
			offsetX: source.offsetX,
			offsetY: source.offsetY,
			depth: saved?.depth ?? Math.max(...this.devAssets.map((asset) => asset.depth), 0) + 1,
			scale: saved?.scale ?? source.scale,
			rotation: saved?.rotation ?? source.image.angle,
		};
		copy.image = this.add.image(0, 0, source.image.texture.key)
			.setOrigin(source.image.originX, source.image.originY)
			.setAngle(copy.rotation)
			.setDepth(copy.depth);
		this._applyAssetScale(copy);
		this.devAssets.push(copy);

		if (source.solidRect) {
			copy.solidRect = { x: copy.x, y: copy.y, w: copy.w, h: copy.h };
			this.solids.push(copy.solidRect);
		}
		if (source.interactionData) {
			copy.interactable = { ...source.interactionData, x: copy.x, y: copy.y, w: copy.w, h: copy.h };
			if (copy.center) {
				copy.interactable.x = copy.x - copy.w / 2;
				copy.interactable.y = copy.y - copy.h / 2;
			}
			this.interactables.push(copy.interactable);
			copy.interactionData = { ...source.interactionData };
		}
		this._applyAssetScale(copy);
		this._syncAssetVisual(copy);
		if (persist) this._saveLayout();
		return copy;
	}

	_syncAssetVisual(asset) {
		if (asset.center) asset.image.setPosition(asset.x, asset.y);
		else asset.image.setPosition(asset.x + asset.offsetX, asset.y + asset.offsetY);
	}

	_applyAssetScale(asset) {
		asset.w = asset.baseW * asset.scale;
		asset.h = asset.baseH * asset.scale;
		asset.offsetX = (asset.baseOffsetX || 0) * asset.scale;
		asset.offsetY = (asset.baseOffsetY || 0) * asset.scale;
		asset.image.setDisplaySize(asset.baseDisplayWidth * asset.scale, asset.baseDisplayHeight * asset.scale);
		this._syncAssetVisual(asset);
		const rotated = Math.abs(asset.image.angle % 360) > 0.01;
		const bounds = rotated ? asset.image.getBounds() : null;
		if (asset.interactable) {
			if (rotated) {
				asset.interactable.x = bounds.x;
				asset.interactable.y = bounds.y;
			} else if (asset.center) {
				asset.interactable.x = asset.x - asset.w / 2;
				asset.interactable.y = asset.y - asset.h / 2;
			} else {
				asset.interactable.x = asset.x;
				asset.interactable.y = asset.y;
			}
			asset.interactable.w = rotated ? bounds.width : asset.w;
			asset.interactable.h = rotated ? bounds.height : asset.h;
		}
		if (asset.solidRect) {
			asset.solidRect.x = rotated ? bounds.x : (asset.center ? asset.x - asset.w / 2 : asset.x);
			asset.solidRect.y = rotated ? bounds.y : (asset.center ? asset.y - asset.h / 2 : asset.y);
			asset.solidRect.w = rotated ? bounds.width : asset.w;
			asset.solidRect.h = rotated ? bounds.height : asset.h;
		}
	}

	// Purely decorative warm glow under the ceiling light (no sprite, no
	// collision, no interaction) — same effect as the Godot Lamp piece.
	_placeLamp(x, y) {
		const g = this.add.graphics().setDepth(1);
		const cx = x + TILE / 2, cy = y + TILE / 2;
		for (let i = 5; i >= 1; i--) {
			const r = i * 10;
			const a = 0.04 + (5 - i) * 0.03;
			g.fillStyle(0xfff6d8, a);
			g.fillCircle(cx, cy, r);
		}
		g.fillStyle(0xfff6d8, 1);
		g.fillCircle(cx, cy, 3);
	}

	// ---------------- player ----------------

	_createPlayer() {
		const spawn = this._resolveSpawn(this.scene.settings.data || {});
		this.gx = spawn.x;
		this.gy = spawn.y;
		this.dirName = window.__playerFacing || "down";
		this.dirRow = { down: 0, up: 1, left: 2, right: 3 };
		this.walkCycle = [1, 0, 2, 0];
		this.frameIdx = 0;
		this.frameTimer = 0;
		this.moving = false;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this.outfit = this.activePlayer === "Aditi" ? (localStorage.getItem("aditi-outfit") || "badger") : "shreyak";
		const playerTexture = this.activePlayer === "Shreyak"
			? "npc_shreyak"
			: (OUTFITS.find((outfit) => outfit.key === this.outfit)?.tex || "player_badger");

		this.shadow = this.add.ellipse(this.gx, this.gy + 14, 20, 4, 0x000000, 0.22).setDepth(9);
		this.player = this.add.sprite(this.gx - 20, this.gy - 34, playerTexture, 0).setOrigin(0, 0).setDepth(10);

		this.cameras.main.startFollow({ x: this.gx, y: this.gy }, false);
		// Room fits the viewport exactly, so following is a no-op here, but
		// this keeps the camera correctly anchored if the room ever grows.
	}

	_resolveSpawn(request) {
		let origin = request.spawn || { x: 144, y: 304 };
		if (request.spawnNearAsset) {
			const asset = this.devAssets.find((entry) => entry.id === request.spawnNearAsset);
			if (asset) origin = { x: asset.x - TILE, y: asset.y };
		}
		return this._findNearestWalkableSpawn(origin);
	}

	_findNearestWalkableSpawn(origin) {
		const canSpawnAt = (x, y) => {
			const feet = this._playerFeetBox(x, y);
			if (feet.x < 0 || feet.y < 0 || feet.x + feet.w > COLS * TILE || feet.y + feet.h > ROWS * TILE) return false;
			if (this.exitDoor && rectsOverlap(feet, this.exitDoor)) return false;
			return !this.solids.some((solid) => rectsOverlap(feet, solid));
		};
		const center = {
			x: Phaser.Math.Clamp(Math.round(origin.x), 16, COLS * TILE - 16),
			y: Phaser.Math.Clamp(Math.round(origin.y), 16, ROWS * TILE - 24),
		};
		if (canSpawnAt(center.x, center.y)) return center;
		for (let radius = 8; radius <= 160; radius += 8) {
			for (let offset = -radius; offset <= radius; offset += 8) {
				for (const candidate of [
					{ x: center.x - radius, y: center.y + offset },
					{ x: center.x + offset, y: center.y - radius },
					{ x: center.x + offset, y: center.y + radius },
					{ x: center.x + radius, y: center.y + offset },
				]) {
					if (canSpawnAt(candidate.x, candidate.y)) return candidate;
				}
			}
		}
		return { x: 144, y: 304 };
	}

	setOutfit(key) {
		if (this.activePlayer !== "Aditi") return;
		const o = OUTFITS.find((o) => o.key === key);
		if (!o) return;
		this.outfit = key;
		localStorage.setItem("aditi-outfit", key);
		this.player.setTexture(o.tex, this.player.frame.name);
	}

	_applyPlayerFrame() {
		const col = this.moving ? this.walkCycle[this.frameIdx] : 0;
		const row = this.dirRow[this.dirName];
		this.player.setFrame(row * 3 + col);
	}

	// Small collision box near the feet, kept within +/-16px of the tile
	// center on every edge (half a tile) so standing in a tile adjacent to a
	// wall never spills 1-2px into the neighboring tile and falsely blocks
	// entry into it.
	_playerFeetBox(gx, gy) {
		return { x: gx - 8, y: gy + 6, w: 16, h: 10 };
	}

	_atExitDoor() {
		return !!this.exitDoor && rectsOverlap(this._playerFeetBox(this.gx, this.gy), this.exitDoor);
	}

	_exitToCorridor() {
		this.scene.start("Corridor", this.exitDoor.data || {});
	}

	_findNearbyInteractable() {
		const maxDistance = TILE * 1.25;
		let nearest = null;
		let nearestDistance = Infinity;

		for (const interactable of this.interactables) {
			const closestX = Phaser.Math.Clamp(this.gx, interactable.x, interactable.x + interactable.w);
			const closestY = Phaser.Math.Clamp(this.gy, interactable.y, interactable.y + interactable.h);
			const distance = Phaser.Math.Distance.Between(this.gx, this.gy, closestX, closestY);
			if (distance <= maxDistance && distance < nearestDistance) {
				nearest = interactable;
				nearestDistance = distance;
			}
		}

		return nearest;
	}

	// ---------------- NPC ----------------

	_createNPC() {
		const x = 144, y = 208;
		const npcIsAditi = this.activePlayer === "Shreyak";
		const npcTexture = npcIsAditi ? "player_badger" : "npc_shreyak";
		const dialogue = this._npcDialogue();
		this.add.ellipse(x, y + 14, 20, 4, 0x000000, 0.22).setDepth(9);
		this.npcSprite = this.add.sprite(x - 20, y - 34, npcTexture, 0).setOrigin(0, 0).setDepth(10);
		this.solids.push({ x: x - 8, y: y + 8, w: 16, h: 10 });
		this.interactables.push({
			x: x - 16, y: y - 16, w: 32, h: 32,
			text: dialogue,
			giveTarget: true,
		});
	}

	_npcDialogue() {
		if (this.activePlayer === "Aditi" && this.roomOwner === "Aditi") {
			return "Shreyak: \"Happy I get to be in your room, even if it is just pixels. Made this for you.\"";
		}
		if (this.activePlayer === "Aditi" && this.roomOwner === "Shreyak") {
			return "Shreyak: \"Welcome to my room. Yes, I cleaned before you got here. Mostly.\"";
		}
		if (this.activePlayer === "Shreyak" && this.roomOwner === "Aditi") {
			return "Aditi: \"You are in my room now. Be nice to my things, okay?\"";
		}
		return "Aditi: \"Your room actually looks good. I am impressed.\"";
	}

	// ---------------- UI: dialogue, outfit menu, interact prompt ----------------

	_createUI() {
		const ui = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

		// Dialogue box
		this.dialogueBox = this.add.rectangle(4, 384 - 74, 280, 66, 0x1a1410, 0.92).setOrigin(0, 0).setVisible(false);
		this.dialogueText = this.add.text(12, 384 - 66, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2ece0", wordWrap: { width: 264 } }).setVisible(false);
		ui.add([this.dialogueBox, this.dialogueText]);

		// Outfit menu
		this.outfitBox = this.add.rectangle(144, 192, 180, 140, 0x1a1410, 0.94).setVisible(false);
		this.outfitText = this.add.text(144, 192, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2ece0", align: "left" }).setOrigin(0.5).setVisible(false);
		ui.add([this.outfitBox, this.outfitText]);
		this.outfitIndex = 0;
		this.outfitOpen = false;
		this.giftBox = this.add.rectangle(144, 192, 236, 150, 0x1a1410, 0.96).setStrokeStyle(2, 0xc28b3c, 1).setVisible(false);
		this.giftText = this.add.text(144, 192, "", { fontFamily: "monospace", fontSize: "11px", color: "#f2ece0", align: "left", lineSpacing: 7, wordWrap: { width: 210 } }).setOrigin(0.5).setVisible(false);
		ui.add([this.giftBox, this.giftText]);
		this.giftOpen = false;
		this.giftItems = [];
		this.giftIndex = 0;

		// "Press E" prompt
		this.promptText = this.add.text(144, 384 - 20, "Press E to interact", { fontFamily: "monospace", fontSize: "10px", color: "#ffffff" }).setOrigin(0.5).setVisible(false);
		this.promptText.setStroke("#000000", 3);
		ui.add(this.promptText);

		this.dialogueActive = false;
		this.dialogueTyping = false;
		this.dialogueFullText = "";
		this.dialogueIndex = 0;
		this.dialogueTypeTimer = 0;
	}

	_refreshOutfitMenu() {
		let text = "Pick an outfit:\n\n";
		this.menuOutfits.forEach((o, i) => {
			text += (i === this.outfitIndex ? "> " : "   ") + o.label + "\n";
		});
		text += (this.outfitIndex === this.menuOutfits.length ? "> " : "   ") + "Close";
		this.outfitText.setText(text);
	}

	openOutfitMenu() {
		this.outfitOpen = true;
		this.menuOutfits = OUTFITS.filter((outfit) => outfit.key !== "borrowed_hoodie" || localStorage.getItem("aditi-borrowed-hoodie") === "1");
		this.outfitIndex = 0;
		this.outfitBox.setVisible(true);
		this.outfitText.setVisible(true);
		this._refreshOutfitMenu();
	}

	closeOutfitMenu() {
		this.outfitOpen = false;
		this.outfitBox.setVisible(false);
		this.outfitText.setVisible(false);
	}

	_refreshGiftMenu() {
		let text = `Give to ${this.activePlayer === "Aditi" ? "Shreyak" : "Aditi"}:\n\n`;
		this.giftItems.forEach((item, index) => {
			text += (index === this.giftIndex ? "> " : "  ") + `${item.name} x${item.count}\n`;
		});
		text += "\nE  give    Esc  close";
		this.giftText.setText(text);
	}

	_openGiftMenu() {
		this.giftItems = getInventory(this.activePlayer);
		if (!this.giftItems.length) {
			this.showDialogue("Your bag is empty. Find something to share first.");
			return;
		}
		this.giftOpen = true;
		this.giftIndex = 0;
		this.giftBox.setVisible(true);
		this.giftText.setVisible(true);
		this._refreshGiftMenu();
	}

	_closeGiftMenu() {
		this.giftOpen = false;
		this.giftBox.setVisible(false);
		this.giftText.setVisible(false);
	}

	_giveSelectedItem() {
		const item = this.giftItems[this.giftIndex];
		if (!item) return;
		const target = this.activePlayer === "Aditi" ? "Shreyak" : "Aditi";
		if (transferInventoryItem(this.activePlayer, target, item.name)) {
			this._closeGiftMenu();
			this.showDialogue(`${this.activePlayer} gave ${item.name} to ${target}.`);
		}
	}

	showDialogue(text) {
		this.dialogueActive = true;
		this.dialogueTyping = true;
		this.dialogueFullText = text;
		this.dialogueIndex = 0;
		this.dialogueTypeTimer = 0;
		this.dialogueBox.setVisible(true);
		this.dialogueText.setVisible(true);
		this.dialogueText.setText("");
	}

	closeDialogue() {
		this.dialogueActive = false;
		this.dialogueTyping = false;
		this.dialogueBox.setVisible(false);
		this.dialogueText.setVisible(false);
	}

	_finishDialogueTyping() {
		this.dialogueIndex = this.dialogueFullText.length;
		this.dialogueTyping = false;
		this.dialogueText.setText(this.dialogueFullText);
	}

	_updateDialogueTyping(delta) {
		if (!this.dialogueTyping) return;

		this.dialogueTypeTimer += delta;
		const charactersPerSecond = 42;
		const charactersToAdd = Math.floor(this.dialogueTypeTimer / (1000 / charactersPerSecond));
		if (charactersToAdd <= 0) return;

		this.dialogueTypeTimer = 0;
		this.dialogueIndex = Math.min(this.dialogueIndex + charactersToAdd, this.dialogueFullText.length);
		this.dialogueText.setText(this.dialogueFullText.slice(0, this.dialogueIndex));
		if (this.dialogueIndex >= this.dialogueFullText.length) this.dialogueTyping = false;
	}

	// ---------------- main loop ----------------

	update(time, delta) {
		if (isTextInputActive()) return;
		this._syncMultiplayer();
		this.chatSystem?.update(delta, { x: this.gx, y: this.gy }, this.remotePlayer?.getPosition());
		if (this.chatSystem?.typing) return;
		const justPressed = (k) => Phaser.Input.Keyboard.JustDown(this.keys[k]);
		const interactPressed = justPressed("E");
		const givePressed = justPressed("G");
		if (justPressed("Q")) this.inventoryPanel.toggle(this.activePlayer);
		this._updateDialogueTyping(delta);
		if (window.__roomGalleryOpen) return;
		if (this.inventoryPanel.update(this.activePlayer)) return;
		const closePressed = justPressed("ESC");

		if (Phaser.Input.Keyboard.JustDown(this.devKeys.toggle)) this._toggleDevMode();
		if (this.devMode) {
			this._updateDevEditor(delta);
			return;
		}

		if (this.outfitOpen) {
			if (closePressed) this.closeOutfitMenu();
			else if (justPressed("UP") || justPressed("W")) {
				this.outfitIndex = (this.outfitIndex - 1 + (this.menuOutfits.length + 1)) % (this.menuOutfits.length + 1);
				this._refreshOutfitMenu();
			} else if (justPressed("DOWN") || justPressed("S")) {
				this.outfitIndex = (this.outfitIndex + 1) % (this.menuOutfits.length + 1);
				this._refreshOutfitMenu();
			} else if (interactPressed) {
				if (this.outfitIndex < this.menuOutfits.length) this.setOutfit(this.menuOutfits[this.outfitIndex].key);
				this.closeOutfitMenu();
			}
			return;
		}

		if (this.giftOpen) {
			if (closePressed) this._closeGiftMenu();
			else if (justPressed("UP") || justPressed("W")) {
				this.giftIndex = (this.giftIndex - 1 + this.giftItems.length) % this.giftItems.length;
				this._refreshGiftMenu();
			} else if (justPressed("DOWN") || justPressed("S")) {
				this.giftIndex = (this.giftIndex + 1) % this.giftItems.length;
				this._refreshGiftMenu();
			} else if (interactPressed) this._giveSelectedItem();
			return;
		}

		if (this.dialogueActive) {
			if (interactPressed) {
				if (this.dialogueTyping) this._finishDialogueTyping();
				else this.closeDialogue();
			}
			return;
		}

		const dt = delta / 1000;
		if (this.moving) {
			const dx = this.targetX - this.gx, dy = this.targetY - this.gy;
			const dist = Math.hypot(dx, dy);
			const step = MOVE_SPEED * dt;
			if (dist <= step) {
				this.gx = this.targetX;
				this.gy = this.targetY;
				this.moving = false;
				this.frameIdx = 0;
			} else {
				this.gx += (dx / dist) * step;
				this.gy += (dy / dist) * step;
				this.frameTimer += dt;
				if (this.frameTimer > 0.09) {
					this.frameTimer = 0;
					this.frameIdx = (this.frameIdx + 1) % 4;
				}
			}
			this._syncPlayerVisual();
			this._updatePrompt();
			if (!this.moving && this._atExitDoor()) this._exitToCorridor();
			return;
		}

		let dirName = null, dx = 0, dy = 0;
		if (this.keys.DOWN.isDown || this.keys.S.isDown) { dirName = "down"; dx = 0; dy = 1; }
		else if (this.keys.UP.isDown || this.keys.W.isDown) { dirName = "up"; dx = 0; dy = -1; }
		else if (this.keys.LEFT.isDown || this.keys.A.isDown) { dirName = "left"; dx = -1; dy = 0; }
		else if (this.keys.RIGHT.isDown || this.keys.D.isDown) { dirName = "right"; dx = 1; dy = 0; }

		if (dirName) {
			this.dirName = dirName;
			window.__playerFacing = dirName;
			const nx = this.gx + dx * TILE, ny = this.gy + dy * TILE;
			const feet = this._playerFeetBox(nx, ny);
			const blocked = this.solids.some((s) => rectsOverlap(feet, s));
			if (!blocked) {
				this.targetX = nx;
				this.targetY = ny;
				this.moving = true;
			}
		} else {
			this.frameIdx = 0;
		}
		this._applyPlayerFrame();
		this._syncPlayerVisual();
		this._updatePrompt();
		if (this._atExitDoor()) {
			this._exitToCorridor();
			return;
		}
		if (givePressed) {
			const hit = this._findNearbyInteractable();
			const remote = this.remotePlayer?.getPosition();
			const remoteIsNearby = remote && Phaser.Math.Distance.Between(this.gx, this.gy, remote.x, remote.y) <= TILE * 1.5;
			if (hit?.giveTarget || remoteIsNearby) this._openGiftMenu();
			return;
		}

		if (interactPressed) {
			const hit = this._findNearbyInteractable();
			if (hit) {
				if (hit.opensOutfitMenu) this.openOutfitMenu();
				else if (hit.borrowsHoodie) {
					localStorage.setItem("aditi-borrowed-hoodie", "1");
					this.setOutfit("borrowed_hoodie");
					this.showDialogue("Aditi borrows one of Shreyak's hoodies. It is oversized, comfortable, and she is keeping it for a while.");
				}
				else if (hit.opensPhotoGallery) window.__openPhotoGallery?.(this.roomOwner);
				else if (hit.scene) this.scene.start(hit.scene, hit.data || {});
				else if (hit.text) this.showDialogue(hit.text);
			}
		}
	}

	_syncMultiplayer() {
		this.remotePlayer?.update({
			x: this.gx,
			y: this.gy,
			dir: this.dirName,
			moving: this.moving,
			frame: Number(this.player.frame.name) || 0,
			outfit: this.outfit,
		});
	}

	_syncPlayerVisual() {
		this.player.x = this.gx - 20;
		this.player.y = this.gy - 34;
		this._applyPlayerFrame();
		this.shadow.x = this.gx;
		this.shadow.y = this.gy + 14;
	}

	_updatePrompt() {
		const hit = this._findNearbyInteractable();
		this.promptText.setVisible(!!hit);
	}

	_createDevModeControls() {
		this.devHint = this.add.text(8, 8, "", {
			fontFamily: "monospace",
			fontSize: "9px",
			color: "#fff6d8",
			backgroundColor: "#1a1410",
			padding: { x: 6, y: 5 },
		}).setScrollFactor(0).setDepth(200).setVisible(this.devMode);
		this.devOutline = this.add.graphics().setDepth(99).setVisible(false);
		this._refreshDevHint();
	}

	_toggleDevMode() {
		this.devMode = !this.devMode;
		this.devSelected = null;
		this.devOutline.setVisible(false);
		this.devHint.setVisible(this.devMode);
		try {
			localStorage.setItem("aditi-dev-mode", this.devMode ? "1" : "0");
		} catch (err) {
			// Dev mode still works for the current session without storage.
		}
		this._refreshDevHint();
	}

	_refreshDevHint() {
		if (!this.devHint) return;
		this.devHint.setText(this.devMode
			? `DEV MODE  |  ${this.roomOwner}'s room  |  arrows move  |  X/Z resize  |  R rotate  |  PgUp/PgDn layer  |  Ctrl+D duplicate  |  Del delete  |  F2 exit${this.devSelected ? `  |  selected: ${this.devSelected.id}` : ""}`
			: "");
	}

	_selectDevAsset(pointer) {
		if (!this.devMode) return;
		const matches = this.devAssets
			.filter((asset) => !asset.deleted && asset.image.visible && asset.image.getBounds().contains(pointer.worldX, pointer.worldY))
			.sort((a, b) => b.depth - a.depth);
		if (!matches.length) return;
		this.devSelected = matches[0];
		this._refreshDevHint();
		this._drawDevOutline();
	}

	_drawDevOutline() {
		this.devOutline.clear();
		if (!this.devSelected) {
			this.devOutline.setVisible(false);
			return;
		}
		const bounds = this.devSelected.image.getBounds();
		this.devOutline.lineStyle(1, 0xffd66e, 1);
		this.devOutline.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
		this.devOutline.setVisible(true);
	}

	_moveSelectedAsset(dx, dy) {
		const asset = this.devSelected;
		if (!asset) return;
		if (asset.center) {
			asset.x = Phaser.Math.Clamp(asset.x + dx, 16, COLS * TILE - 16);
			asset.y = Phaser.Math.Clamp(asset.y + dy, 32, ROWS * TILE - 32);
			asset.interactable.x = asset.x - asset.w / 2;
			asset.interactable.y = asset.y - asset.h / 2;
		} else {
			asset.x = Phaser.Math.Clamp(asset.x + dx, 0, COLS * TILE - asset.w);
			asset.y = Phaser.Math.Clamp(asset.y + dy, 0, ROWS * TILE - asset.h);
			if (asset.interactable) {
				asset.interactable.x = asset.x;
				asset.interactable.y = asset.y;
			}
		}
		this._applyAssetScale(asset);
		this._saveLayout();
		this._drawDevOutline();
	}

	_bringSelectedForward(direction) {
		if (!this.devSelected) return;
		const delta = direction > 0 ? 1 : -1;
		this.devSelected.depth = Math.max(0, this.devSelected.depth + delta);
		this.devSelected.image.setDepth(this.devSelected.depth);
		this._saveLayout();
		this._refreshDevHint();
	}

	_resizeSelectedAsset(factor) {
		if (!this.devSelected) return;
		this.devSelected.scale = Phaser.Math.Clamp(this.devSelected.scale * factor, 0.25, 4);
		this._applyAssetScale(this.devSelected);
		this._saveLayout();
		this._drawDevOutline();
	}

	_rotateSelectedAsset(degrees) {
		if (!this.devSelected) return;
		this.devSelected.rotation = Phaser.Math.Wrap(this.devSelected.image.angle + degrees, -180, 180);
		this.devSelected.image.setAngle(this.devSelected.rotation);
		this._applyAssetScale(this.devSelected);
		this._saveLayout();
		this._drawDevOutline();
	}

	_deleteSelectedAsset() {
		const asset = this.devSelected;
		if (!asset || asset.id === "door") return;
		this._removeAssetCollisionAndInteraction(asset);
		if (asset.sourceId === asset.id) {
			asset.deleted = true;
			asset.image.setVisible(false);
		} else {
			asset.image.destroy();
			this.devAssets = this.devAssets.filter((entry) => entry !== asset);
		}
		this.devSelected = null;
		this._saveLayout();
		this._refreshDevHint();
		this._drawDevOutline();
	}

	_updateDevEditor(delta) {
		if (!this.devSelected) return;
		if (Phaser.Input.Keyboard.JustDown(this.devKeys.delete) || Phaser.Input.Keyboard.JustDown(this.devKeys.backspace)) {
			this._deleteSelectedAsset();
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.E) && this.devSelected.id === "photoframe") {
			window.__openPhotoGallery?.(this.roomOwner);
			return;
		}
		if (Phaser.Input.Keyboard.JustDown(this.devKeys.pageUp)) this._bringSelectedForward(1);
		if (Phaser.Input.Keyboard.JustDown(this.devKeys.pageDown)) this._bringSelectedForward(-1);
		if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this._resizeSelectedAsset(1.1);
		if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) this._resizeSelectedAsset(0.9);
		if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this._rotateSelectedAsset(this.keys.SHIFT.isDown ? -15 : 15);
		const speed = this.keys.SHIFT?.isDown ? 8 : 2;
		let dx = 0, dy = 0;
		if (this.keys.LEFT.isDown) dx -= speed * delta / 16.67;
		if (this.keys.RIGHT.isDown) dx += speed * delta / 16.67;
		if (this.keys.UP.isDown) dy -= speed * delta / 16.67;
		if (this.keys.DOWN.isDown) dy += speed * delta / 16.67;
		if (dx || dy) this._moveSelectedAsset(dx, dy);
		if (Phaser.Input.Keyboard.JustDown(this.devKeys.save)) this._saveLayout();
	}
}
