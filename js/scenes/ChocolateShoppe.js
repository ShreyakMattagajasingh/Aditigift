import { SceneDevEditor } from "../systems/SceneDevEditor.js";
import { isTextInputActive, setCanvasMode } from "../shared.js";
import { InventoryPanel } from "../systems/Inventory.js";
import { RemotePlayer } from "../systems/RemotePlayer.js";
import { ChatSystem } from "../systems/ChatSystem.js";
import { ClawMachinePanel } from "../systems/ClawMachinePanel.js";

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 450;
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 450;
const LEGACY_X_OFFSET = 80;
const LEGACY_Y_OFFSET = -31;
const MOVE_SPEED = 200;
const sceneX = (value) => value + LEGACY_X_OFFSET;
const sceneY = (value) => value + LEGACY_Y_OFFSET;
const migrateLandscapeLayout = (layout) => {
	const fromScaledLandscape = layout.layoutVersion === "landscape-v2";
	for (const position of Object.values(layout.positions || {})) {
		position.x = (fromScaledLandscape ? position.x / 1.25 : position.x) + LEGACY_X_OFFSET;
		position.y = (fromScaledLandscape ? position.y / 1.25 : position.y) + LEGACY_Y_OFFSET;
	}
	for (const clone of layout.clones || []) {
		clone.x = (fromScaledLandscape ? clone.x / 1.25 : clone.x) + LEGACY_X_OFFSET;
		clone.y = (fromScaledLandscape ? clone.y / 1.25 : clone.y) + LEGACY_Y_OFFSET;
	}
	return layout;
};
const OUTFITS_TEXTURES = {
	badger: "player_badger",
	black_dress: "player_black_dress",
	white_sundress: "player_white_sundress",
	casual: "player_casual",
	borrowed_hoodie: "player_borrowed_hoodie",
};

export class ChocolateShoppeScene extends Phaser.Scene {
	constructor() {
		super("ChocolateShoppe");
	}

	create() {
		setCanvasMode(this.game.canvas, "game-widescreen");
		this.scale.setGameSize(VIEW_WIDTH, VIEW_HEIGHT);
		this.scale.refresh();
		if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});

		const requestedSpawn = this.scene.settings.data?.spawn || { x: 115, y: 435 };
		const spawn = { x: sceneX(requestedSpawn.x), y: sceneY(requestedSpawn.y) };
		this.activePlayer = window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		this.gx = spawn.x;
		this.gy = spawn.y;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this.moving = false;
		this.dirName = window.__playerFacing || "right";
		this.dirRows = { down: 0, up: 1, left: 2, right: 3 };
		this.walkCycle = [1, 0, 2, 0];
		this.frameIdx = 0;
		this.frameTimer = 0;
		this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q");
		this.interactables = [];
		this.editableAssets = [];
		this.solids = [
			{ x: sceneX(55), y: sceneY(115), w: 535, h: 160 },
			{ x: sceneX(450), y: sceneY(335), w: 130, h: 135 },
		];

		this._drawInterior();
		this._createPlayer();
		this.remotePlayer = new RemotePlayer(this, "ChocolateShoppe");
		this.chatSystem = new ChatSystem(this, "ChocolateShoppe");
		this._createUI();
		this.inventoryPanel = new InventoryPanel(this);
		this.clawMachinePanel = new ClawMachinePanel(this);
		this.devEditor = new SceneDevEditor(this, "aditi-chocolate-shoppe-layout-v1", this.editableAssets, {
			layoutVersion: "landscape-fit-v3",
			migrateLayout: migrateLandscapeLayout,
		});
		this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
		this.cameras.main.roundPixels = true;
	}

	_drawInterior() {
		this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x0d0a0d).setDepth(0);
		const room = this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, "inside-chocolate-shoppe").setDisplaySize(620, 620).setDepth(1);
		const chair = this.add.image(sceneX(395), sceneY(430), "inside-chocolate-shoppe-chair").setOrigin(0.5, 1).setDisplaySize(104, 78).setDepth(6);
		const clawMachine = this.add.image(sceneX(170), sceneY(442), "inside-chocolate-shoppe-claw-machine").setOrigin(0.5, 1).setDisplaySize(78, 104).setDepth(6);
		const photoFrame = this.add.image(sceneX(552), sceneY(320), "photoframe").setOrigin(0.5).setDisplaySize(28, 44).setDepth(7);
		this.editableAssets.push({ id: "chocolate-shoppe-interior", image: room });
		this.editableAssets.push({ id: "chocolate-shoppe-chair", image: chair });
		const clawMachineInteraction = { x: 0, y: 0, w: 0, h: 0, clawGame: true };
		this.interactables.push(clawMachineInteraction);
		this.editableAssets.push({ id: "chocolate-shoppe-claw-machine", image: clawMachine, interaction: clawMachineInteraction });
		const photoFrameInteraction = { x: 0, y: 0, w: 0, h: 0, opensPhotoGallery: true, galleryOwner: "ChocolateShoppe" };
		this.interactables.push(photoFrameInteraction);
		this.editableAssets.push({ id: "chocolate-shoppe-photoframe", image: photoFrame, interaction: photoFrameInteraction });
		this.interactables.push({ x: sceneX(45), y: sceneY(350), w: 78, h: 115, scene: "Outside", data: { spawnNearAsset: "chocolate-shoppe-ice-cream" } });
	}

	_createPlayer() {
		const texture = this.activePlayer === "Shreyak" ? "npc_shreyak" : (OUTFITS_TEXTURES[localStorage.getItem("aditi-outfit")] || "player_badger");
		this.shadow = this.add.ellipse(this.gx, this.gy + 14, 20, 4, 0x000000, 0.22).setDepth(8);
		this.player = this.add.sprite(this.gx - 20, this.gy - 34, texture, this.dirRows[this.dirName] * 3).setOrigin(0, 0).setDepth(9);
	}

	_createUI() {
		this.dialogueBox = this.add.rectangle(4, VIEW_HEIGHT - 78, VIEW_WIDTH - 8, 66, 0x1a1410, 0.94).setOrigin(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
		this.dialogueText = this.add.text(12, VIEW_HEIGHT - 70, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2ece0", wordWrap: { width: VIEW_WIDTH - 24 } }).setScrollFactor(0).setDepth(101).setVisible(false);
		this.prompt = this.add.text(VIEW_WIDTH / 2, VIEW_HEIGHT - 20, "Press E to interact", { fontFamily: "monospace", fontSize: "10px", color: "#fff" }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false).setStroke("#000", 3);
		this.dialogueActive = false;
		this.dialogueTyping = false;
	}

	_nearby() {
		let nearest = null;
		let smallestDistance = Infinity;
		for (const item of this.interactables) {
			const x = Phaser.Math.Clamp(this.gx, item.x, item.x + item.w);
			const y = Phaser.Math.Clamp(this.gy, item.y, item.y + item.h);
			const distance = Phaser.Math.Distance.Between(this.gx, this.gy, x, y);
			if (distance <= 40 && distance < smallestDistance) { nearest = item; smallestDistance = distance; }
		}
		return nearest;
	}

	_canStandAt(x, y) {
		const feet = { x: x - 8, y: y + 6, w: 16, h: 10 };
		if (feet.x < sceneX(38) || feet.y < sceneY(278) || feet.x + feet.w > sceneX(602) || feet.y + feet.h > sceneY(478)) return false;
		return !this.solids.some((solid) => feet.x < solid.x + solid.w && feet.x + feet.w > solid.x && feet.y < solid.y + solid.h && feet.y + feet.h > solid.y);
	}

	_applyPlayerFrame() {
		this.player.setFrame(this.dirRows[this.dirName] * 3 + (this.moving ? this.walkCycle[this.frameIdx] : 0));
	}

	_syncMultiplayer() {
		this.remotePlayer?.update({ x: this.gx, y: this.gy, dir: this.dirName, moving: this.moving, frame: Number(this.player.frame.name) || 0, outfit: this.activePlayer === "Aditi" ? (localStorage.getItem("aditi-outfit") || "badger") : "shreyak" });
	}

	update(time, delta) {
		if (isTextInputActive()) return;
		this._syncMultiplayer();
		if (this.clawMachinePanel?.update(delta)) return;
		this.chatSystem?.update(delta, { x: this.gx, y: this.gy }, this.remotePlayer?.getPosition());
		if (this.chatSystem?.typing) return;
		if (window.__roomGalleryOpen) return;
		if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.inventoryPanel.toggle(this.activePlayer);
		if (this.inventoryPanel.update(this.activePlayer)) return;
		if (this.devEditor.active) { this.devEditor.update(delta); return; }

		const interact = Phaser.Input.Keyboard.JustDown(this.keys.E);
		if (!this.moving) {
			let dx = 0;
			let dy = 0;
			if (this.keys.DOWN.isDown || this.keys.S.isDown) { dy = 1; this.dirName = "down"; }
			else if (this.keys.UP.isDown || this.keys.W.isDown) { dy = -1; this.dirName = "up"; }
			else if (this.keys.LEFT.isDown || this.keys.A.isDown) { dx = -1; this.dirName = "left"; }
			else if (this.keys.RIGHT.isDown || this.keys.D.isDown) { dx = 1; this.dirName = "right"; }
			if (dx || dy) {
				window.__playerFacing = this.dirName;
				const nx = this.gx + dx * 32;
				const ny = this.gy + dy * 32;
				if (this._canStandAt(nx, ny)) { this.targetX = nx; this.targetY = ny; this.moving = true; }
			}
		}

		if (this.moving) {
			const dx = this.targetX - this.gx;
			const dy = this.targetY - this.gy;
			const distance = Math.hypot(dx, dy);
			const step = MOVE_SPEED * delta / 1000;
			if (distance <= step) { this.gx = this.targetX; this.gy = this.targetY; this.moving = false; this.frameIdx = 0; }
			else {
				this.gx += dx / distance * step;
				this.gy += dy / distance * step;
				this.frameTimer += delta / 1000;
				if (this.frameTimer > 0.09) { this.frameTimer = 0; this.frameIdx = (this.frameIdx + 1) % this.walkCycle.length; }
			}
		}

		this.player.setPosition(this.gx - 20, this.gy - 34);
		this.shadow.setPosition(this.gx, this.gy + 14);
		this._applyPlayerFrame();
		this.prompt.setVisible(!!this._nearby());
		if (interact) {
			const hit = this._nearby();
			if (hit?.scene) this.scene.start(hit.scene, hit.data || {});
			else if (hit?.opensPhotoGallery) window.__openPhotoGallery?.(hit.galleryOwner);
			else if (hit?.clawGame) this.clawMachinePanel.open(this.activePlayer);
		}
	}
}
