import { addInventoryItem } from "./Inventory.js";
import { layoutStore } from "./LayoutStore.js";
import { multiplayer } from "./Multiplayer.js";

const PANEL_DEPTH = 450;
const TURN_TIME_MS = 7000;
const CLAW_ACCELERATION = 520;
const CLAW_MAX_SPEED = 150;
const CATCH_RADIUS = 20;
const DROP_ZONE = { x: 190, y: 276 };
const TOY_MIN_X = 176;
const TOY_MAX_X = 464;
const TOY_LAYOUT_KEY = "aditi-claw-game-toys-layout-v1";
const LANDSCAPE_SCALE = 0.88;
const PANEL_CENTER = { x: 320, y: 256 };
export const TOY_LAYOUT = [
	{ x: 190, y: 300, texture: "claw-game-toy-1", name: "Peach Ice Cream Plush" },
	{ x: 230, y: 300, texture: "claw-game-toy-2", name: "Mint Ice Cream Plush" },
	{ x: 270, y: 300, texture: "claw-game-toy-3", name: "Yellow Ice Cream Plush" },
	{ x: 310, y: 300, texture: "claw-game-toy-4", name: "Purple Ice Cream Plush" },
	{ x: 350, y: 300, texture: "claw-game-toy-5", name: "Pink Ice Cream Plush" },
	{ x: 390, y: 300, texture: "claw-game-babcock", name: "Babcock Ice Cream Plush" },
	{ x: 430, y: 300, texture: "claw-game-bucky", name: "Bucky Plush" },
	{ x: 200, y: 380, texture: "claw-game-capitol", name: "Capitol Plush" },
	{ x: 240, y: 380, texture: "claw-game-cheese", name: "Cheese Plush" },
	{ x: 280, y: 380, texture: "claw-game-cow", name: "Cow Plush" },
	{ x: 320, y: 380, texture: "claw-game-cycle", name: "Bicycle Plush" },
	{ x: 360, y: 380, texture: "claw-game-ducky", name: "Ducky Plush" },
	{ x: 400, y: 380, texture: "claw-game-hotdog", name: "Hot Dog Plush" },
	{ x: 440, y: 380, texture: "claw-game-strawberry", name: "Strawberry Plush" },
];

export const TOY_CENTERS = TOY_LAYOUT.map((toy) => toy.x);

export function caughtToyIndex(clawX, centers = TOY_CENTERS) {
	let caughtIndex = -1;
	let nearestDistance = Infinity;
	centers.forEach((toyX, index) => {
		const distance = Math.abs(clawX - toyX);
		if (distance <= CATCH_RADIUS && distance < nearestDistance) {
			caughtIndex = index;
			nearestDistance = distance;
		}
	});
	return caughtIndex;
}

export function catchesVisibleToy(clawX, centers = TOY_CENTERS) {
	return caughtToyIndex(clawX, centers) >= 0;
}

export function toySlips(random = Math.random) {
	return random() < 0.4;
}

export class ClawMachinePanel {
	constructor(scene) {
		this.scene = scene;
		this.opened = false;
		this.ready = false;
		this.introAnimating = false;
		this.dropping = false;
		this.resolved = false;
		this.player = "Aditi";
		this.clawVelocityX = 0;
		this.selectedToy = -1;
		this.wasDevMode = false;
		this.keys = scene.input.keyboard.addKeys("A,D,W,S,X,Z,LEFT,RIGHT,UP,DOWN,SPACE,ESC,SHIFT");
		const viewportWidth = scene.scale.gameSize.width;
		const viewportHeight = scene.scale.gameSize.height;
		const rootX = viewportWidth / 2 - PANEL_CENTER.x * LANDSCAPE_SCALE;
		const rootY = viewportHeight / 2 - PANEL_CENTER.y * LANDSCAPE_SCALE;
		this.container = scene.add.container(rootX, rootY)
			.setScale(LANDSCAPE_SCALE)
			.setScrollFactor(0)
			.setDepth(PANEL_DEPTH)
			.setVisible(false);
		this.backdrop = scene.add.rectangle(
			-rootX / LANDSCAPE_SCALE,
			-rootY / LANDSCAPE_SCALE,
			viewportWidth / LANDSCAPE_SCALE,
			viewportHeight / LANDSCAPE_SCALE,
			0x09060e,
			0.82,
		).setOrigin(0);
		this.panel = scene.add.rectangle(320, 256, 474, 492, 0x241628, 0.99).setStrokeStyle(2, 0xff8ec2, 1);
		this.machine = scene.add.image(320, 257, "claw-game-machine").setDisplaySize(390, 428);
		this.toys = TOY_LAYOUT.map((toy) => scene.add.image(toy.x, toy.y, toy.texture));
		this.toyHomes = TOY_LAYOUT.map((toy) => ({ x: toy.x, y: toy.y, scale: 1 }));
		this.toys.forEach((toy, index) => this._fitToy(toy, index));
		this.claw = scene.add.image(DROP_ZONE.x, DROP_ZONE.y, "claw-game-claw").setOrigin(0.5, 0).setDisplaySize(76, 168);
		this.title = scene.add.text(275, 29, "CLAWCADE // SWEET SCOOP", { fontFamily: "monospace", fontSize: "14px", fontStyle: "bold", color: "#ffe5f1" }).setOrigin(0.5);
		this.timerBadge = scene.add.rectangle(501, 29, 88, 26, 0x16101b, 0.98).setStrokeStyle(2, 0xffd66e, 1);
		this.timer = scene.add.text(501, 29, "READY", { fontFamily: "monospace", fontSize: "11px", fontStyle: "bold", color: "#ffd66e" }).setOrigin(0.5);
		this.statusBar = scene.add.rectangle(320, 475, 424, 48, 0x16101b, 0.98).setStrokeStyle(2, 0xff8ec2, 1);
		this.status = scene.add.text(320, 475, "", { fontFamily: "monospace", fontSize: "9px", color: "#fff2cb", align: "center", wordWrap: { width: 400 } }).setOrigin(0.5);
		this.devOutline = scene.add.graphics();
		this.container.add([this.backdrop, this.panel, this.machine, ...this.toys, this.claw, this.title, this.timerBadge, this.timer, this.statusBar, this.status, this.devOutline]);

		this._loadToyLayout();
		this.pointerListener = (pointer) => this._selectToy(pointer);
		scene.input.on("pointerdown", this.pointerListener);
		this.layoutListener = (event) => {
			if (event.detail.sceneId === TOY_LAYOUT_KEY) this._applyToyLayout(event.detail.layout);
		};
		window.addEventListener("aditi-multiplayer-layout", this.layoutListener);
		scene.events.once("shutdown", () => {
			scene.input.off("pointerdown", this.pointerListener);
			window.removeEventListener("aditi-multiplayer-layout", this.layoutListener);
		});
	}

	_loadToyLayout() {
		let saved = null;
		const local = localStorage.getItem(TOY_LAYOUT_KEY);
		try { saved = JSON.parse(local || "null"); } catch (error) {}
		const shared = multiplayer.getLayout(TOY_LAYOUT_KEY);
		if (shared) saved = shared;
		if (saved) this._applyToyLayout(saved);
		layoutStore.ready.then(() => {
			const persisted = layoutStore.get(TOY_LAYOUT_KEY);
			if (persisted) {
				this._applyToyLayout(persisted);
				localStorage.setItem(TOY_LAYOUT_KEY, JSON.stringify(persisted));
				multiplayer.sendLayout(TOY_LAYOUT_KEY, persisted);
			} else if (saved) {
				layoutStore.save(TOY_LAYOUT_KEY, saved);
			}
		});
	}

	_applyToyLayout(layout) {
		for (let index = 0; index < this.toys.length; index += 1) {
			const saved = layout?.positions?.[`toy-${index + 1}`];
			if (!saved) continue;
			this.toyHomes[index] = {
				x: Phaser.Math.Clamp(Number(saved.x) || TOY_LAYOUT[index].x, TOY_MIN_X, TOY_MAX_X),
				y: Phaser.Math.Clamp(Number(saved.y) || TOY_LAYOUT[index].y, 205, 405),
				scale: Phaser.Math.Clamp(Number(saved.scale) || 1, 0.25, 4),
			};
		}
		if (!this.opened || this._devModeActive() || this.resolved) this._restoreToys();
	}

	_saveToyLayout() {
		const layout = { positions: {} };
		this.toyHomes.forEach((position, index) => {
			layout.positions[`toy-${index + 1}`] = { x: position.x, y: position.y, scale: position.scale };
		});
		localStorage.setItem(TOY_LAYOUT_KEY, JSON.stringify(layout));
		multiplayer.sendLayout(TOY_LAYOUT_KEY, layout);
		layoutStore.save(TOY_LAYOUT_KEY, layout);
	}

	_devModeActive() {
		return !!this.scene.devEditor?.active;
	}

	_selectToy(pointer) {
		if (!this.opened || !this._devModeActive()) return;
		const hits = this.toys
			.map((toy, index) => ({ toy, index }))
			.filter(({ toy }) => toy.visible && toy.getBounds().contains(pointer.worldX, pointer.worldY));
		this.selectedToy = hits.length ? hits[hits.length - 1].index : -1;
		this._refreshDevUI();
	}

	_drawDevOutline() {
		this.devOutline.clear();
		if (this.selectedToy < 0) return;
		const toy = this.toys[this.selectedToy];
		this.devOutline.lineStyle(2, 0xffd66e, 1).strokeRect(
			toy.x - toy.displayWidth / 2,
			toy.y - toy.displayHeight / 2,
			toy.displayWidth,
			toy.displayHeight,
		);
	}

	_refreshDevUI() {
		this.timer.setText("DEV").setColor("#7fffd4");
		this.status.setText(`DEV MODE: click toy | arrows/WASD move | X/Z resize${this.selectedToy >= 0 ? `\nSelected: toy ${this.selectedToy + 1} (${Math.round(this.toyHomes[this.selectedToy].scale * 100)}%)` : ""}  |  F2: finish`);
		this._drawDevOutline();
	}

	_enterDevMode() {
		this._killMotion();
		this.ready = false;
		this.introAnimating = false;
		this.dropping = false;
		this.resolved = false;
		this.selectedToy = -1;
		this.scene.devEditor.selected = null;
		this.scene.devEditor.hint.setVisible(false);
		this.scene.devEditor.outline.setVisible(false);
		this._setClawClosed(false);
		this.claw.setPosition(320, 99).setAngle(0);
		this._restoreToys();
		this._refreshDevUI();
	}

	_updateDevMode(delta) {
		if (this.selectedToy < 0) return;
		let dx = 0;
		let dy = 0;
		if (this.keys.LEFT.isDown || this.keys.A.isDown) dx = -1;
		else if (this.keys.RIGHT.isDown || this.keys.D.isDown) dx = 1;
		if (this.keys.UP.isDown || this.keys.W.isDown) dy = -1;
		else if (this.keys.DOWN.isDown || this.keys.S.isDown) dy = 1;
		let changed = false;
		if (dx || dy) {
			const speed = this.keys.SHIFT.isDown ? 125 : 45;
			const home = this.toyHomes[this.selectedToy];
			home.x = Phaser.Math.Clamp(home.x + dx * speed * delta / 1000, TOY_MIN_X, TOY_MAX_X);
			home.y = Phaser.Math.Clamp(home.y + dy * speed * delta / 1000, 205, 405);
			this.toys[this.selectedToy].setPosition(home.x, home.y);
			changed = true;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.X)) {
			this._resizeSelectedToy(1.1);
			changed = true;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.Z)) {
			this._resizeSelectedToy(0.9);
			changed = true;
		}
		if (!changed) return;
		this._saveToyLayout();
		this._refreshDevUI();
	}

	_restoreToys() {
		this.toys.forEach((toy, index) => {
			this.scene.tweens.killTweensOf(toy);
			toy.setPosition(this.toyHomes[index].x, this.toyHomes[index].y).setAlpha(1).setAngle(0).setVisible(true);
			this._fitToy(toy, index);
		});
	}

	_fitToy(toy, index) {
		const width = Math.max(1, toy.frame.realWidth || toy.width);
		const height = Math.max(1, toy.frame.realHeight || toy.height);
		const scale = Math.min(76 / width, 94 / height) * (this.toyHomes[index]?.scale || 1);
		toy.setDisplaySize(Math.round(width * scale), Math.round(height * scale));
	}

	_resizeSelectedToy(factor) {
		const home = this.toyHomes[this.selectedToy];
		home.scale = Phaser.Math.Clamp(home.scale * factor, 0.25, 4);
		this._fitToy(this.toys[this.selectedToy], this.selectedToy);
	}

	_killMotion() {
		this.scene.tweens.killTweensOf(this.claw);
		this.toys.forEach((toy) => this.scene.tweens.killTweensOf(toy));
		this.clawVelocityX = 0;
	}

	_setClawClosed(closed) {
		this.claw.setTexture(closed ? "claw-game-closed-claw" : "claw-game-claw").setOrigin(0.5, 0);
		const width = Math.max(1, this.claw.frame.realWidth || this.claw.width);
		const height = Math.max(1, this.claw.frame.realHeight || this.claw.height);
		this.claw.setDisplaySize(Math.round(168 * width / height), 168);
	}

	open(player) {
		this.player = player;
		this.opened = true;
		this.container.setVisible(true);
		this.wasDevMode = this._devModeActive();
		if (this.wasDevMode) this._enterDevMode();
		else this._startRound();
	}

	close() {
		this._killMotion();
		this.opened = false;
		this.ready = false;
		this.introAnimating = false;
		this.dropping = false;
		this.selectedToy = -1;
		this.devOutline.clear();
		this.container.setVisible(false);
		if (this._devModeActive()) this.scene.devEditor.hint.setVisible(true);
	}

	_startRound() {
		this._killMotion();
		this._restoreToys();
		this._setClawClosed(false);
		this.ready = false;
		this.introAnimating = true;
		this.dropping = false;
		this.resolved = false;
		this.timeLeft = TURN_TIME_MS;
		this.claw.setPosition(DROP_ZONE.x, DROP_ZONE.y).setAngle(0);
		this.timer.setText("READY").setColor("#ffd66e");
		this.status.setText("The claw rises from the prize chute...");
		this.scene.tweens.add({
			targets: this.claw,
			y: 99,
			duration: 430,
			ease: "Sine.easeOut",
			onComplete: () => {
				this.status.setText("The claw slides into position...");
				this.scene.tweens.add({
					targets: this.claw,
					x: 320,
					duration: 520,
					ease: "Sine.easeInOut",
					onComplete: () => {
						this.introAnimating = false;
						this.ready = true;
						this.status.setText("A / D or arrows: steer  |  Space: drop  |  F2: arrange toys");
					},
				});
			},
		});
	}

	_drop() {
		if (!this.ready) return;
		this.ready = false;
		this.dropping = true;
		this.clawVelocityX = 0;
		this.claw.setAngle(0);
		this.status.setText("The claw is coming down...");
		this.scene.tweens.add({
			targets: this.claw,
			y: 286,
			duration: 430,
			ease: "Sine.easeIn",
			onComplete: () => {
				this._setClawClosed(true);
				const toyIndex = caughtToyIndex(this.claw.x, this.toyHomes.map((toy) => toy.x));
				if (toyIndex < 0) this._returnEmpty("The claw missed the plushes.");
				else this._liftToy(toyIndex);
			},
		});
	}

	_liftToy(toyIndex) {
		const toy = this.toys[toyIndex];
		const slipped = toySlips();
		this._setClawClosed(true);
		this.status.setText("The claw has a plush! Hold on...");
		toy.setPosition(this.claw.x, this.claw.y + 120).setAngle(-8);
		this.scene.tweens.add({
			targets: toy,
			x: this.claw.x,
			y: 220,
			angle: 10,
			duration: 520,
			ease: "Sine.easeInOut",
		});
		this.scene.tweens.add({
			targets: this.claw,
			y: 99,
			duration: 520,
			ease: "Sine.easeOut",
			onComplete: () => {
				if (slipped) this._slipToy(toyIndex);
				else this._carryToyToChute(toyIndex);
			},
		});
	}

	_slipToy(toyIndex) {
		const toy = this.toys[toyIndex];
		const home = this.toyHomes[toyIndex];
		this._setClawClosed(false);
		this.status.setText("Oh no! The plush slipped from the claw...");
		this.scene.tweens.add({
			targets: toy,
			x: home.x + Phaser.Math.Between(-12, 12),
			y: home.y,
			angle: Phaser.Math.Between(-18, 18),
			duration: 520,
			ease: "Bounce.easeOut",
			onComplete: () => toy.setPosition(home.x, home.y).setAngle(0),
		});
		this._returnEmpty("The plush slipped from the claw.");
	}

	_carryToyToChute(toyIndex) {
		const toy = this.toys[toyIndex];
		this.status.setText("Carrying the plush to the prize chute...");
		this.scene.tweens.add({
			targets: toy,
			x: DROP_ZONE.x,
			angle: -12,
			duration: 700,
			ease: "Sine.easeInOut",
		});
		this.scene.tweens.add({
			targets: this.claw,
			x: DROP_ZONE.x,
			angle: -5,
			duration: 700,
			ease: "Sine.easeInOut",
			onComplete: () => {
				this.claw.setAngle(0);
				this.scene.tweens.add({
					targets: this.claw,
					y: DROP_ZONE.y,
					duration: 340,
					ease: "Sine.easeIn",
					onComplete: () => this._setClawClosed(false),
				});
				this.scene.tweens.add({
					targets: toy,
					y: 430,
					angle: -28,
					alpha: 0,
					duration: 430,
					ease: "Back.easeIn",
					onComplete: () => {
						const prizeName = TOY_LAYOUT[toyIndex].name;
						addInventoryItem(this.player, prizeName);
						this.dropping = false;
						this.resolved = true;
						this.timer.setText("WON!").setColor("#7fffd4");
						this.status.setText(`DELIVERED! ${prizeName} is in your inventory.\nSpace: play again  |  Esc: leave`);
					},
				});
			},
		});
	}

	_returnEmpty(message) {
		this.scene.tweens.add({
			targets: this.claw,
			y: 99,
			duration: 430,
			ease: "Sine.easeOut",
			onComplete: () => {
				this._setClawClosed(false);
				this.scene.tweens.add({
					targets: this.claw,
					x: DROP_ZONE.x,
					duration: 520,
					ease: "Sine.easeInOut",
					onComplete: () => {
						this.scene.tweens.add({
							targets: this.claw,
							y: DROP_ZONE.y,
							duration: 330,
							ease: "Sine.easeIn",
							onComplete: () => {
								this.dropping = false;
								this.resolved = true;
								this.timer.setText("MISS").setColor("#ff6b85");
								this.status.setText(`${message}\nSpace: play again  |  Esc: leave`);
							},
						});
					},
				});
			},
		});
	}

	_updateClawPhysics(delta) {
		const seconds = Math.min(delta, 50) / 1000;
		let direction = 0;
		if (this.keys.LEFT.isDown || this.keys.A.isDown) direction = -1;
		else if (this.keys.RIGHT.isDown || this.keys.D.isDown) direction = 1;
		if (direction) this.clawVelocityX += direction * CLAW_ACCELERATION * seconds;
		else this.clawVelocityX *= Math.pow(0.08, seconds);
		this.clawVelocityX = Phaser.Math.Clamp(this.clawVelocityX, -CLAW_MAX_SPEED, CLAW_MAX_SPEED);
		const nextX = Phaser.Math.Clamp(this.claw.x + this.clawVelocityX * seconds, 196, 444);
		if (nextX === 196 || nextX === 444) this.clawVelocityX = 0;
		this.claw.x = nextX;
		this.claw.angle = Phaser.Math.Linear(this.claw.angle, Phaser.Math.Clamp(this.clawVelocityX * 0.035, -6, 6), 0.18);
	}

	update(delta = 0) {
		if (!this.opened) return false;
		if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
			this.close();
			return true;
		}

		const devMode = this._devModeActive();
		if (devMode !== this.wasDevMode) {
			if (devMode) this._enterDevMode();
			else {
				this.selectedToy = -1;
				this.devOutline.clear();
				this._startRound();
			}
			this.wasDevMode = devMode;
		}
		if (devMode) {
			this._updateDevMode(delta);
			return true;
		}
		if (this.introAnimating || this.dropping) return true;
		if (this.resolved) {
			if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this._startRound();
			return true;
		}
		if (!this.ready) return true;

		this._updateClawPhysics(delta);
		this.timeLeft = Math.max(0, this.timeLeft - delta);
		this.timer
			.setText(`TIME  ${(this.timeLeft / 1000).toFixed(1)}`)
			.setColor(this.timeLeft <= 2000 ? "#ff6b85" : "#ffd66e");
		if (this.timeLeft <= 0) {
			this.status.setText("TIME UP! The claw drops automatically...");
			this._drop();
			return true;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this._drop();
		return true;
	}
}
