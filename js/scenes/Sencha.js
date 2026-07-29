import { SceneDevEditor } from "../systems/SceneDevEditor.js";
import { isTextInputActive, setCanvasMode } from "../shared.js";
import { InventoryPanel } from "../systems/Inventory.js";
import { RemotePlayer } from "../systems/RemotePlayer.js";
import { ChatSystem } from "../systems/ChatSystem.js";
import { MancalaPanel } from "../systems/MancalaPanel.js";

const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;
const MOVE_SPEED = 200;
const migrateLandscapeLayout = (layout) => {
	for (const position of Object.values(layout.positions || {})) position.x += 30;
	for (const clone of layout.clones || []) clone.x += 30;
	return layout;
};
const OUTFITS = {
	badger: "player_badger",
	black_dress: "player_black_dress",
	white_sundress: "player_white_sundress",
	casual: "player_casual",
	borrowed_hoodie: "player_borrowed_hoodie",
};

export class SenchaScene extends Phaser.Scene {
	constructor() {
		super("Sencha");
	}

	create() {
		setCanvasMode(this.game.canvas, "game-widescreen");
		this.scale.setGameSize(VIEW_WIDTH, VIEW_HEIGHT);
		this.scale.refresh();
		if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});

		const requested = this.scene.settings.data?.spawn || { x: 480, y: 465 };
		this.activePlayer = window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		this.gx = requested.x;
		this.gy = requested.y;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this.moving = false;
		this.dirName = window.__playerFacing || "up";
		this.dirRows = { down: 0, up: 1, left: 2, right: 3 };
		this.walkCycle = [1, 0, 2, 0];
		this.frameIdx = 0;
		this.frameTimer = 0;
		this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q");
		this.interactables = [];
		this.editableAssets = [];
		this.solids = [
			{ x: 322, y: 115, w: 112, h: 210 },
			{ x: 525, y: 315, w: 150, h: 105 },
		];

		this._drawInterior();
		this._createPlayer();
		this.remotePlayer = new RemotePlayer(this, "Sencha");
		this.chatSystem = new ChatSystem(this, "Sencha");
		this._createUI();
		this.inventoryPanel = new InventoryPanel(this);
		this.mancalaPanel = new MancalaPanel(this);
		this.devEditor = new SceneDevEditor(this, "aditi-sencha-layout-v1", this.editableAssets, {
			layoutVersion: "landscape-fit-v2",
			migrateLayout: migrateLandscapeLayout,
		});
		this.cameras.main.setBounds(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
		this.cameras.main.roundPixels = true;
	}

	_drawInterior() {
		this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0xaeb597).setDepth(0);
		const grid = this.add.graphics().setDepth(1);
		grid.lineStyle(1, 0x73805f, 0.2);
		for (let x = 0; x <= VIEW_WIDTH; x += 8) grid.lineBetween(x, 0, x, VIEW_HEIGHT);
		for (let y = 0; y <= VIEW_HEIGHT; y += 8) grid.lineBetween(0, y, VIEW_WIDTH, y);
		this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 388, VIEW_HEIGHT, 0x263116).setDepth(1);
		this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 374, VIEW_HEIGHT - 12, 0x17110c).setDepth(2);
		this.add.text(18, 16, "SENCHA // TEA ROOM", { fontFamily: "monospace", fontSize: "11px", color: "#263116" }).setDepth(3);
		const room = this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, "inside-sencha").setDisplaySize(360, 540).setDepth(2);
		const cupboard = this.add.image(375, 310, "inside-sencha-cupboard").setOrigin(0.5, 1).setDisplaySize(100, 185).setDepth(6);
		const table = this.add.image(485, 382, "inside-sencha-chair-table").setOrigin(0.5, 1).setDisplaySize(128, 92).setDepth(7);
		const mancalaTable = this.add.image(560, 468, "inside-sencha-mancala-table").setOrigin(0.5, 1).setDisplaySize(110, 78).setDepth(7);
		const photoFrame = this.add.image(584, 248, "photoframe").setDisplaySize(30, 46).setDepth(7);
		this.editableAssets.push({ id: "sencha-interior", image: room });
		const cupboardInteraction = { x: 330, y: 120, w: 90, h: 210, text: "Rows of tea, labeled with care." };
		const mancalaInteraction = { x: 505, y: 390, w: 110, h: 78, range: 76, mancala: true };
		const photoFrameInteraction = { x: 569, y: 225, w: 30, h: 46, opensPhotoGallery: true, galleryOwner: "Sencha" };
		this.interactables.push(cupboardInteraction, mancalaInteraction, photoFrameInteraction);
		this.editableAssets.push({ id: "sencha-cupboard", image: cupboard, interaction: cupboardInteraction });
		this.editableAssets.push({ id: "sencha-chair-table-v2", image: table });
		this.editableAssets.push({ id: "sencha-mancala-table", image: mancalaTable, interaction: mancalaInteraction });
		this.editableAssets.push({ id: "sencha-photoframe", image: photoFrame, interaction: photoFrameInteraction });
		this.interactables.push({ x: 455, y: 40, w: 50, h: 65, scene: "Outside", data: { spawnNearAsset: "sencha-tea-bar" }, text: "Back outside." });
	}

	_createPlayer() {
		const texture = this.activePlayer === "Shreyak"
			? "npc_shreyak"
			: (OUTFITS[localStorage.getItem("aditi-outfit")] || "player_badger");
		this.shadow = this.add.ellipse(this.gx, this.gy + 14, 20, 4, 0x000000, 0.22).setDepth(8);
		this.player = this.add.sprite(this.gx - 20, this.gy - 34, texture, this.dirRows[this.dirName] * 3).setOrigin(0, 0).setDepth(9);
	}

	_createUI() {
		this.dialogueBox = this.add.rectangle(12, VIEW_HEIGHT - 66, VIEW_WIDTH - 24, 52, 0x1a1410, 0.94).setOrigin(0).setScrollFactor(0).setDepth(100).setVisible(false);
		this.dialogueText = this.add.text(24, VIEW_HEIGHT - 57, "", { fontFamily: "monospace", fontSize: "13px", color: "#f2ece0", wordWrap: { width: VIEW_WIDTH - 48 } }).setScrollFactor(0).setDepth(101).setVisible(false);
		this.prompt = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT - 16, "Press E to interact", { fontFamily: "monospace", fontSize: "11px", color: "#fff" }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false).setStroke("#000", 3);
		this.dialogueActive = false;
		this.dialogueTyping = false;
	}

	_nearby() {
		let nearest = null;
		let distance = Infinity;
		for (const item of this.interactables) {
			const x = Phaser.Math.Clamp(this.gx, item.x, item.x + item.w);
			const y = Phaser.Math.Clamp(this.gy, item.y, item.y + item.h);
			const next = Phaser.Math.Distance.Between(this.gx, this.gy, x, y);
			if (next <= (item.range || 42) && next < distance) { nearest = item; distance = next; }
		}
		return nearest;
	}

	_canStandAt(x, y) {
		const feet = { x: x - 8, y: y + 6, w: 16, h: 10 };
		if (feet.x < 290 || feet.y < 54 || feet.x + feet.w > 670 || feet.y + feet.h > 515) return false;
		return !this.solids.some((solid) => feet.x < solid.x + solid.w && feet.x + feet.w > solid.x && feet.y < solid.y + solid.h && feet.y + feet.h > solid.y);
	}

	_say(text) {
		this.dialogueActive = true;
		this.dialogueTyping = true;
		this.dialogueBox.setVisible(true);
		this.dialogueText.setVisible(true).setText("");
		let index = 0;
		this.time.delayedCall(18, function typeNext() {
			if (!this.dialogueActive) return;
			this.dialogueText.setText(text.slice(0, ++index));
			if (index < text.length) this.time.delayedCall(18, typeNext, [], this);
			else this.dialogueTyping = false;
		}, [], this);
	}

	_applyPlayerFrame() {
		this.player.setFrame(this.dirRows[this.dirName] * 3 + (this.moving ? this.walkCycle[this.frameIdx] : 0));
	}

	update(time, delta) {
		if (isTextInputActive()) return;
		this._syncMultiplayer();
		if (this.mancalaPanel?.update(delta)) return;
		this.chatSystem?.update(delta, { x: this.gx, y: this.gy }, this.remotePlayer?.getPosition());
		if (this.chatSystem?.typing || window.__roomGalleryOpen) return;
		if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.inventoryPanel.toggle(this.activePlayer);
		if (this.inventoryPanel.update(this.activePlayer)) return;
		if (this.devEditor.active) { this.devEditor.update(delta); return; }
		if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
			if (this.dialogueActive) { this.dialogueActive = false; this.dialogueBox.setVisible(false); this.dialogueText.setVisible(false); }
			else {
				const hit = this._nearby();
				if (hit?.scene) this.scene.start(hit.scene, hit.data || {});
				else if (hit?.mancala) this.mancalaPanel.openPanel();
				else if (hit?.opensPhotoGallery) window.__openPhotoGallery?.(hit.galleryOwner);
				else if (hit?.text) this._say(hit.text);
			}
			return;
		}
		if (this.dialogueActive) return;
		if (!this.moving) {
			let dx = 0; let dy = 0;
			if (this.keys.DOWN.isDown || this.keys.S.isDown) { dy = 1; this.dirName = "down"; }
			else if (this.keys.UP.isDown || this.keys.W.isDown) { dy = -1; this.dirName = "up"; }
			else if (this.keys.LEFT.isDown || this.keys.A.isDown) { dx = -1; this.dirName = "left"; }
			else if (this.keys.RIGHT.isDown || this.keys.D.isDown) { dx = 1; this.dirName = "right"; }
			if (dx || dy) {
				window.__playerFacing = this.dirName;
				const nx = this.gx + dx * 32; const ny = this.gy + dy * 32;
				if (this._canStandAt(nx, ny)) { this.targetX = nx; this.targetY = ny; this.moving = true; }
			}
		}
		if (this.moving) {
			const dx = this.targetX - this.gx; const dy = this.targetY - this.gy; const distance = Math.hypot(dx, dy); const step = MOVE_SPEED * delta / 1000;
			if (distance <= step) { this.gx = this.targetX; this.gy = this.targetY; this.moving = false; this.frameIdx = 0; }
			else { this.gx += dx / distance * step; this.gy += dy / distance * step; this.frameTimer += delta / 1000; if (this.frameTimer > 0.09) { this.frameTimer = 0; this.frameIdx = (this.frameIdx + 1) % this.walkCycle.length; } }
		}
		this.player.setPosition(this.gx - 20, this.gy - 34);
		this.shadow.setPosition(this.gx, this.gy + 14);
		this._applyPlayerFrame();
		this.prompt.setVisible(!!this._nearby());
	}

	_syncMultiplayer() {
		this.remotePlayer?.update({ x: this.gx, y: this.gy, dir: this.dirName, moving: this.moving, frame: Number(this.player.frame.name) || 0, outfit: this.activePlayer === "Aditi" ? (localStorage.getItem("aditi-outfit") || "badger") : "shreyak" });
	}
}
