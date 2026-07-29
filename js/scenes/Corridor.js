import { SceneDevEditor } from "../systems/SceneDevEditor.js";
import { isTextInputActive } from "../shared.js";
import { addInventoryItem, deliverInventoryItem, InventoryPanel } from "../systems/Inventory.js";
import { RemotePlayer } from "../systems/RemotePlayer.js";
import { ChatSystem } from "../systems/ChatSystem.js";

const WIDTH = 640;
const HEIGHT = 384;
const FLOOR_TOP = 96;
const FLOOR_BOTTOM = 288;
const MOVE_SPEED = 200;
const OUTFITS_TEXTURES = {
	badger: "player_badger",
	black_dress: "player_black_dress",
	white_sundress: "player_white_sundress",
	casual: "player_casual",
	borrowed_hoodie: "player_borrowed_hoodie",
};

export class CorridorScene extends Phaser.Scene {
	constructor() {
		super("Corridor");
	}

	create() {
		this.game.canvas.classList.remove("game-portrait", "game-standard", "game-widescreen");
		this.game.canvas.classList.add("game-landscape");
		this.scale.setGameSize(WIDTH, HEIGHT);
		this.scale.refresh();
		if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});
		const spawnRequest = this.scene.settings.data || {};
		const spawn = spawnRequest.spawn || { x: 320, y: 192 };
		this.activePlayer = window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		this.gx = spawn.x;
		this.gy = spawn.y;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this.moving = false;
		this.dirName = window.__playerFacing || "down";
		this.dirRows = { down: 0, up: 1, left: 2, right: 3 };
		this.walkCycle = [1, 0, 2, 0];
		this.frameIdx = 0;
		this.frameTimer = 0;
		this.solids = [
			{ x: 0, y: 0, w: WIDTH, h: FLOOR_TOP },
			{ x: 0, y: FLOOR_BOTTOM, w: WIDTH, h: HEIGHT - FLOOR_BOTTOM },
			{ x: 0, y: 0, w: 16, h: HEIGHT },
			{ x: WIDTH - 16, y: 0, w: 16, h: HEIGHT },
		];
		this.interactables = [];
		this.editableAssets = [];
		this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q");

		this._drawCorridor();
		this._placeDoors();
		this._placeElevator();
		this._placeVendingMachine();
		this._placePhotoFrame();
		this.devEditor = new SceneDevEditor(this, "aditi-corridor-layout-v1", this.editableAssets);
		const resolvedSpawn = this._resolveSpawn(spawnRequest);
		this.gx = resolvedSpawn.x;
		this.gy = resolvedSpawn.y;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this._createPlayer();
		this.remotePlayer = new RemotePlayer(this, "Corridor");
		this.chatSystem = new ChatSystem(this, "Corridor");
		this._createUI();
		this.inventoryPanel = new InventoryPanel(this);

		this.cameras.main.setBounds(0, 0, WIDTH, HEIGHT);
		this.cameras.main.startFollow({ x: this.gx, y: this.gy }, false);
	}

	_drawCorridor() {
		const topWall = this.add.image(0, 0, "sax_wall").setOrigin(0, 0).setDisplaySize(WIDTH, FLOOR_TOP).setDepth(0);
		const carpet = this.add.image(0, FLOOR_TOP, "sax_carpet").setOrigin(0, 0).setDisplaySize(WIDTH, FLOOR_BOTTOM - FLOOR_TOP).setDepth(0);
		const bottomWall = this.add.image(0, FLOOR_BOTTOM, "sax_wall").setOrigin(0, 0).setDisplaySize(WIDTH, HEIGHT - FLOOR_BOTTOM).setFlipY(true).setDepth(0);
		this.editableAssets.push(
			{ id: "top-wall", image: topWall },
			{ id: "carpet", image: carpet },
			{ id: "bottom-wall", image: bottomWall },
		);

		this.add.text(32, 30, "SAX APARTMENTS", {
			fontFamily: "monospace",
			fontSize: "10px",
			color: "#5b3519",
			fontStyle: "bold",
		}).setDepth(2);
	}

	_placeDoors() {
		this._door(96, "top", "Apartment 101", "Nobody answers. Maybe they are out.");
		this._door(400, "top", "Apartment 103", "The door is locked.");
		this._door(528, "top", "Aditi's room", "Go back to your room.", "Room", { spawnNearAsset: "door" });
		this._door(112, "bottom", "Shreyak's room", "A familiar voice comes from inside.", "Room", { spawnNearAsset: "door", owner: "Shreyak" });
		this._door(288, "bottom", "Apartment 105", "The door is locked.");
		this._door(448, "bottom", "Apartment 107", "The door is locked.");
		this._door(560, "bottom", "Apartment 109", "The door is locked.");
	}

	_door(centerX, side, label, text, scene = null, data = null) {
		const y = side === "top" ? 68 : 316;
		const image = this.add.image(centerX, y, "sax_door").setOrigin(0.5).setDisplaySize(48, 56).setDepth(1);

		const interactable = {
			x: centerX - 24,
			y: side === "top" ? 40 : 272,
			w: 48,
			h: 72,
			text,
			scene,
			data,
		};
		this.interactables.push(interactable);
		const labelText = this.add.text(centerX, side === "top" ? 30 : 354, label, {
			fontFamily: "monospace",
			fontSize: "7px",
			color: "#5b3519",
			align: "center",
		}).setOrigin(0.5).setDepth(2);
		this.editableAssets.push({
			id: `door-${side}-${centerX}`,
			image,
			interaction: interactable,
			followers: [{ object: labelText, offsetX: 0, offsetY: side === "top" ? -38 : 38 }],
		});
	}

	_placeElevator() {
		const image = this.add.image(288, 56, "sax_elevator").setOrigin(0.5).setDisplaySize(88, 88).setDepth(1);
		const interactable = {
			x: 244, y: 12, w: 88, h: 116,
			text: "The elevator opens to the outside world. The street is waiting below.",
			scene: "Outside",
			data: { spawnNearAsset: "saxony-305n" },
		};
		const label = this.add.text(288, 8, "ELEVATOR", { fontFamily: "monospace", fontSize: "8px", color: "#5b3519", fontStyle: "bold" }).setOrigin(0.5).setDepth(2);
		this.interactables.push(interactable);
		this.editableAssets.push({ id: "elevator", image, interaction: interactable, followers: [{ object: label, offsetX: 0, offsetY: -48 }] });
	}

	_placeVendingMachine() {
		const image = this.add.image(584, 178, "sax_vendingmachine")
			.setOrigin(0.5, 1)
			.setDisplaySize(52, 88)
			.setDepth(2);
		const interactable = {
			x: 548, y: 104, w: 72, h: 88,
			collectVending: true,
		};
		this.interactables.push(interactable);
		this.editableAssets.push({ id: "vending-machine", image, interaction: interactable });
	}

	_placePhotoFrame() {
		const image = this.add.image(352, 64, "photoframe")
			.setOrigin(0.5)
			.setDisplaySize(28, 44)
			.setDepth(2);
		const interactable = {
			x: 336, y: 42, w: 32, h: 52,
			opensPhotoGallery: true,
			galleryOwner: "Corridor",
		};
		this.interactables.push(interactable);
		this.editableAssets.push({ id: "corridor-photoframe", image, interaction: interactable });
	}

	_createPlayer() {
		const texture = this.activePlayer === "Shreyak"
			? "npc_shreyak"
			: (OUTFITS_TEXTURES[localStorage.getItem("aditi-outfit")] || "player_badger");
		this.shadow = this.add.ellipse(this.gx, this.gy + 14, 20, 4, 0x000000, 0.22).setDepth(8);
		this.player = this.add.sprite(this.gx - 20, this.gy - 34, texture, this.dirRows[this.dirName] * 3).setOrigin(0, 0).setDepth(9);
	}

	_applyPlayerFrame() {
		const column = this.moving ? this.walkCycle[this.frameIdx] : 0;
		this.player.setFrame(this.dirRows[this.dirName] * 3 + column);
	}

	_canStandAt(x, y) {
		const feet = { x: x - 8, y: y + 6, w: 16, h: 10 };
		if (feet.x < 16 || feet.y < FLOOR_TOP || feet.x + feet.w > WIDTH - 16 || feet.y + feet.h > FLOOR_BOTTOM) return false;
		return !this.solids.some((solid) => feet.x < solid.x + solid.w && feet.x + feet.w > solid.x && feet.y < solid.y + solid.h && feet.y + feet.h > solid.y);
	}

	_resolveSpawn(request) {
		let origin = request.spawn || { x: 320, y: 192 };
		if (request.spawnNearAsset) {
			const asset = this.editableAssets.find((entry) => entry.id === request.spawnNearAsset);
			if (asset) {
				const bounds = asset.image.getBounds();
				origin = request.spawnNearAsset.includes("-bottom-")
					? { x: asset.image.x, y: bounds.top - 24 }
					: { x: asset.image.x, y: bounds.bottom + 24 };
			}
		}
		return this._findNearestWalkable(origin);
	}

	_findNearestWalkable(origin) {
		const center = {
			x: Phaser.Math.Clamp(Math.round(origin.x), 24, WIDTH - 24),
			y: Phaser.Math.Clamp(Math.round(origin.y), FLOOR_TOP + 16, FLOOR_BOTTOM - 16),
		};
		if (this._canStandAt(center.x, center.y)) return center;
		for (let radius = 8; radius <= 256; radius += 8) {
			for (let offset = -radius; offset <= radius; offset += 8) {
				for (const candidate of [
					{ x: center.x + offset, y: center.y + radius },
					{ x: center.x + offset, y: center.y - radius },
					{ x: center.x + radius, y: center.y + offset },
					{ x: center.x - radius, y: center.y + offset },
				]) {
					if (this._canStandAt(candidate.x, candidate.y)) return candidate;
				}
			}
		}
		return { x: 320, y: 192 };
	}

	_createUI() {
		this.dialogueBox = this.add.rectangle(4, 310, WIDTH - 8, 66, 0x1a1410, 0.94).setOrigin(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
		this.dialogueText = this.add.text(12, 318, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2ece0", wordWrap: { width: WIDTH - 24 } }).setScrollFactor(0).setDepth(101).setVisible(false);
		this.promptText = this.add.text(WIDTH / 2, 364, "Press E to interact", { fontFamily: "monospace", fontSize: "10px", color: "#fff" }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
		this.promptText.setStroke("#000", 3);
		this.dialogueActive = false;
		this.dialogueTyping = false;
		this.dialogueFullText = "";
		this.dialogueIndex = 0;
		this.dialogueTimer = 0;
	}

	_findNearby() {
		let nearest = null, distance = Infinity;
		for (const item of this.interactables) {
			const x = Phaser.Math.Clamp(this.gx, item.x, item.x + item.w);
			const y = Phaser.Math.Clamp(this.gy, item.y, item.y + item.h);
			const d = Phaser.Math.Distance.Between(this.gx, this.gy, x, y);
			if (d <= 40 && d < distance) { nearest = item; distance = d; }
		}
		return nearest;
	}

	_showDialogue(text) {
		this.dialogueActive = true;
		this.dialogueTyping = true;
		this.dialogueFullText = text;
		this.dialogueIndex = 0;
		this.dialogueTimer = 0;
		this.dialogueBox.setVisible(true);
		this.dialogueText.setVisible(true).setText("");
	}

	_closeDialogue() {
		this.dialogueActive = false;
		this.dialogueTyping = false;
		this.dialogueBox.setVisible(false);
		this.dialogueText.setVisible(false);
	}

	_updateDialogue(delta) {
		if (!this.dialogueTyping) return;
		this.dialogueTimer += delta;
		const count = Math.floor(this.dialogueTimer / 24);
		if (!count) return;
		this.dialogueTimer = 0;
		this.dialogueIndex = Math.min(this.dialogueIndex + count, this.dialogueFullText.length);
		this.dialogueText.setText(this.dialogueFullText.slice(0, this.dialogueIndex));
		if (this.dialogueIndex >= this.dialogueFullText.length) this.dialogueTyping = false;
	}

	_updatePrompt() { this.promptText.setVisible(!this.dialogueActive && !!this._findNearby()); }

	update(time, delta) {
		if (isTextInputActive()) return;
		this._syncMultiplayer();
		this.chatSystem?.update(delta, { x: this.gx, y: this.gy }, this.remotePlayer?.getPosition());
		if (this.chatSystem?.typing) return;
		if (window.__roomGalleryOpen) return;
		if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.inventoryPanel.toggle(this.activePlayer);
		if (this.inventoryPanel.update(this.activePlayer)) return;
		if (this.devEditor.active) {
			this.devEditor.update(delta);
			return;
		}
		this._updateDialogue(delta);
		const justPressed = (key) => Phaser.Input.Keyboard.JustDown(this.keys[key]);
		const interact = justPressed("E");
		if (this.dialogueActive) {
			if (interact) {
				if (this.dialogueTyping) { this.dialogueIndex = this.dialogueFullText.length; this.dialogueTyping = false; this.dialogueText.setText(this.dialogueFullText); }
				else this._closeDialogue();
			}
			return;
		}

		if (!this.moving) {
			let dx = 0, dy = 0;
			if (this.keys.DOWN.isDown || this.keys.S.isDown) { dy = 1; this.dirName = "down"; }
			else if (this.keys.UP.isDown || this.keys.W.isDown) { dy = -1; this.dirName = "up"; }
			else if (this.keys.LEFT.isDown || this.keys.A.isDown) { dx = -1; this.dirName = "left"; }
			else if (this.keys.RIGHT.isDown || this.keys.D.isDown) { dx = 1; this.dirName = "right"; }
			if (dx || dy) {
				window.__playerFacing = this.dirName;
				const nx = this.gx + dx * 32, ny = this.gy + dy * 32;
				if (this._canStandAt(nx, ny)) {
					this.targetX = nx; this.targetY = ny; this.moving = true;
				}
			}
		}
		if (this.moving) {
			const dx = this.targetX - this.gx, dy = this.targetY - this.gy;
			const distance = Math.hypot(dx, dy), step = MOVE_SPEED * delta / 1000;
			if (distance <= step) { this.gx = this.targetX; this.gy = this.targetY; this.moving = false; this.frameIdx = 0; }
			else {
				this.gx += dx / distance * step; this.gy += dy / distance * step;
				this.frameTimer += delta / 1000;
				if (this.frameTimer > 0.09) { this.frameTimer = 0; this.frameIdx = (this.frameIdx + 1) % this.walkCycle.length; }
			}
		}
		this.player.x = this.gx - 20; this.player.y = this.gy - 34;
		this.shadow.x = this.gx; this.shadow.y = this.gy + 14;
		this._applyPlayerFrame();
		this._updatePrompt();
		if (interact) {
			const hit = this._findNearby();
			if (hit?.collectVending) this._collectVending();
			else if (hit?.opensPhotoGallery) window.__openPhotoGallery?.(hit.galleryOwner);
			else if (hit?.scene) this.scene.start(hit.scene, hit.data || {});
			else if (hit?.text) this._showDialogue(hit.text);
		}
	}

	_syncMultiplayer() {
		this.remotePlayer?.update({
			x: this.gx,
			y: this.gy,
			dir: this.dirName,
			moving: this.moving,
			frame: Number(this.player.frame.name) || 0,
			outfit: this.activePlayer === "Aditi" ? (localStorage.getItem("aditi-outfit") || "badger") : "shreyak",
		});
	}

	_collectVending() {
		if (this.activePlayer === "Aditi") {
			addInventoryItem("Aditi", "Dunkin coffee");
			this._showDialogue("You collected a Dunkin coffee!!");
			return;
		}
		const extra = Math.random() < 0.5 ? "Dunkin coffee" : "KitKat";
		addInventoryItem("Shreyak", "M&M");
		deliverInventoryItem("Aditi", extra);
		this._showDialogue(`You collected M&M and a ${extra} for Aditi!`);
	}
}
