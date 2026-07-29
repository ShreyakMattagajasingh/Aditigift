import { SceneDevEditor } from "../systems/SceneDevEditor.js";
import { isTextInputActive } from "../shared.js";
import { InventoryPanel } from "../systems/Inventory.js";
import { RemotePlayer } from "../systems/RemotePlayer.js";
import { ChatSystem } from "../systems/ChatSystem.js";

const MAP_WIDTH = 1086;
const MAP_HEIGHT = 1448;
const PLAY_WIDTH = 800;
const PLAY_HEIGHT = 450;
const PLAY_ZOOM = 1.25;
const MOVE_SPEED = 200;
const DEFAULT_ROAD_SPAWN = { x: 384, y: 558 };
const OUTFITS_TEXTURES = {
	badger: "player_badger",
	black_dress: "player_black_dress",
	white_sundress: "player_white_sundress",
	casual: "player_casual",
	borrowed_hoodie: "player_borrowed_hoodie",
};

export class OutsideScene extends Phaser.Scene {
	constructor() {
		super("Outside");
	}

	create() {
		// Phaser reuses Scene instances. Clear game objects destroyed by the
		// previous shutdown before the early viewport layout pass.
		this.player = null;
		this.dialogueBox = null;
		this.dialogueText = null;
		this.prompt = null;
		this.chatSystem = null;
		this.inventoryPanel = null;
		this.viewportDevMode = null;
		this._configureViewport(localStorage.getItem("aditi-dev-mode") === "1");
		if (screen.orientation?.lock) screen.orientation.lock("landscape").catch(() => {});

		const spawnRequest = this.scene.settings.data || {};
		const spawn = spawnRequest.spawn || DEFAULT_ROAD_SPAWN;
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
		this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,Q,ESC,ENTER");
		this.travelDestinations = [
			{ label: "Saxony Apartments", assetId: "saxony-305n" },
			{ label: "Sencha Tea Bar", assetId: "sencha-tea-bar" },
			{ label: "Ian's Pizza", assetId: "ians-pizza" },
			{ label: "Kung Fu Tea", assetId: "kung-fu-tea" },
			{ label: "Chocolate Shoppe", assetId: "chocolate-shoppe-ice-cream" },
			{ label: "Colectivo Coffee", assetId: "colectivo" },
			{ label: "Main Crossroads", x: DEFAULT_ROAD_SPAWN.x, y: DEFAULT_ROAD_SPAWN.y },
		];
		this.travelMenuOpen = false;
		this.travelSelection = 0;
		this.interactables = [];
		this.editableAssets = [];
		this.treeAssetIds = new Set();
		this.solids = [
			{ x: 0, y: 0, w: MAP_WIDTH, h: 8 },
			{ x: 0, y: MAP_HEIGHT - 8, w: MAP_WIDTH, h: 8 },
			{ x: 0, y: 0, w: 8, h: MAP_HEIGHT },
			{ x: MAP_WIDTH - 8, y: 0, w: 8, h: MAP_HEIGHT },
		];

		this._createWalkabilityMask();
		this._drawNeighborhood();
		this.devEditor = new SceneDevEditor(this, "aditi-outside-saxony-layout-v6", this.editableAssets, {
			canPlaceAsset: (asset, x, y) => !asset.isTree || this._isGreenTreeSpot(x, y, asset.image.displayWidth, asset.image.displayHeight),
		});
		const resolvedSpawn = this._resolveSpawn(spawnRequest);
		this.gx = resolvedSpawn.x;
		this.gy = resolvedSpawn.y;
		this.targetX = this.gx;
		this.targetY = this.gy;
		this._createPlayer();
		this.remotePlayer = new RemotePlayer(this, "Outside");
		this.chatSystem = new ChatSystem(this, "Outside");
		this._createUI();
		this.inventoryPanel = new InventoryPanel(this);
		this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
		this.cameras.main.roundPixels = true;
		this._configureViewport(this.devEditor.active);
		this._resizeHandler = () => this._configureViewport(this.devEditor?.active ?? false);
		window.addEventListener("resize", this._resizeHandler);
		this.events.once("shutdown", () => window.removeEventListener("resize", this._resizeHandler));
	}

	_getLandscapeViewport() {
		const aspect = Phaser.Math.Clamp(window.innerWidth / Math.max(window.innerHeight, 1), 16 / 9, 2.4);
		return { width: Math.round(PLAY_HEIGHT * aspect), height: PLAY_HEIGHT };
	}

	_configureViewport(devMode) {
		const landscapeViewport = this._getLandscapeViewport();
		const expectedWidth = devMode ? MAP_WIDTH : landscapeViewport.width;
		const expectedHeight = devMode ? MAP_HEIGHT : landscapeViewport.height;
		if (this.viewportDevMode === devMode && this.scale.gameSize.width === expectedWidth && this.scale.gameSize.height === expectedHeight) {
			if (!devMode && this.player && !this.cameras.main._follow) {
				this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
			}
			this._layoutViewportUI();
			return;
		}
		this.viewportDevMode = devMode;
		this.game.canvas.classList.remove("game-portrait", "game-landscape", "game-standard", "game-widescreen", "game-full-landscape");
		this.game.canvas.classList.add(devMode ? "game-portrait" : "game-full-landscape");
		this.scale.setGameSize(expectedWidth, expectedHeight);
		this.scale.refresh();
		this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
		this.cameras.main.setZoom(devMode ? 1 : PLAY_ZOOM);
		if (devMode) {
			this.cameras.main.stopFollow();
			this.cameras.main.setScroll(0, 0);
		} else if (this.player) {
			this.cameras.main.startFollow(this.player, true, 0.16, 0.16);
		}
		this._layoutViewportUI();
	}

	_layoutViewportUI() {
		const width = this.scale.gameSize.width;
		const height = this.scale.gameSize.height;
		this.dialogueBox?.setPosition(4, height - 78).setSize(width - 8, 66);
		this.dialogueText?.setPosition(12, height - 70).setWordWrapWidth(width - 24);
		this.prompt?.setPosition(width / 2, height - 20);
		this.chatSystem?.layout(width, height);
		this.inventoryPanel?.layout(width, height);
		this._layoutTravelMenu();
	}

	_drawNeighborhood() {
		this.add.image(MAP_WIDTH / 2, MAP_HEIGHT / 2, "outside-sax-map")
			.setDisplaySize(MAP_WIDTH, MAP_HEIGHT)
			.setDepth(0);

		// Placement-phase defaults: every place is visible and independently movable.
		this._building("walgreens", 160, 180, "frances-walgreens", 110, 80, "WALGREENS", "A familiar pharmacy sign glows nearby.");
		this._building("wandos", 310, 250, "frances-wandos", 100, 78, "WANDO'S", "The front door is already louder than the sidewalk.");
		this._building("witte", 460, 330, "town-dorm", 150, 100, "WITTE RESIDENCE HALL", "Witte Residence Hall towers over the block.");
		this._building("estacion-inka", 610, 410, "frances-inka", 92, 72, "ESTACION INKA", "Something delicious is cooking inside.");
		this._building("fluno-center", 760, 490, "frances-fluno", 140, 94, "FLUNO CENTER", "The conference center is busy today.");
		this._building("global-toast", 910, 570, "frances-cheba", 96, 74, "GLOBAL TOAST", "The sandwich board is making a strong argument.");
		this._building("saxony-305n", 300, 730, "outside-saxony-building", 230, 200, "305 N FRANCES  |  SAXONY", "Back to the apartment corridor.", "Corridor", { spawnNearAsset: "elevator" });
		this._building("palisade", 470, 850, "frances-apt", 116, 88, "PALISADE APARTMENTS", "Rows of apartment windows face Johnson Street.");
		this._building("the-james", 640, 970, "frances-james", 112, 86, "THE JAMES", "A new apartment building rises over the corner.");
		this._building("sencha-tea-bar", 820, 850, "outside-sencha", 220, 150, "SENCHA TEA BAR", "A quiet cup of tea waits inside.", "Sencha", { spawn: { x: 480, y: 465 } });
		this._building("fresh-madison", 810, 1090, "frances-madistan", 128, 88, "FRESH MADISON", "Fresh groceries, warm bread, and a long list.");
		this._building("ians-pizza", 950, 1210, "outside-ians", 270, 180, "IAN'S PIZZA", "A slice would fix almost anything right now.");
		this._building("kung-fu-tea", 300, 1210, "outside-kung-fu-tea", 220, 216, "KUNG FU TEA", "Step inside for a drink.", "KungFuTea", { spawn: { x: 340, y: 320 } });
		this._building("chocolate-shoppe-ice-cream", 620, 1215, "outside-chocolate-shoppe", 260, 190, "CHOCOLATE SHOPPE", "Step inside for ice cream.", "ChocolateShoppe", { spawn: { x: 115, y: 435 } });
		this._outdoorAsset("colectivo", 620, 1370, "outside-colectivo", 210, 158);
		this._outdoorAsset("colectivo-chairs", 890, 1380, "outside-colectivo-chairs", 190, 132);
		this._busStop(400, 1380);
		const treePlacements = [
			["tree-01", 84, 164, 1, 58, 66],
			["tree-02", 555, 130, 2, 58, 82],
			["tree-03", 930, 190, 3, 58, 66],
			["tree-04", 105, 510, 4, 58, 66],
			["tree-05", 720, 530, 5, 58, 66],
			["tree-06", 980, 700, 6, 58, 66],
			["tree-07", 120, 900, 1, 58, 66],
			["tree-08", 560, 920, 2, 58, 82],
			["tree-09", 900, 1020, 3, 58, 66],
			["tree-10", 120, 1280, 4, 58, 66],
			["tree-11", 760, 1285, 5, 58, 66],
			["tree-12", 1000, 1400, 6, 58, 66],
			["tree-13", 250, 110, 3, 52, 60],
			["tree-14", 820, 100, 4, 52, 60],
			["tree-15", 250, 430, 5, 52, 60],
			["tree-16", 850, 455, 6, 52, 60],
			["tree-17", 65, 760, 1, 52, 60],
			["tree-18", 740, 780, 2, 52, 76],
			["tree-19", 1020, 900, 3, 52, 60],
			["tree-20", 300, 1040, 4, 52, 60],
			["tree-21", 690, 1120, 5, 52, 60],
			["tree-22", 1010, 1190, 6, 52, 60],
			["tree-23", 360, 1370, 1, 52, 60],
			["tree-24", 570, 1430, 2, 52, 76],
			["tree-25", 180, 300, 3, 48, 56],
			["tree-26", 690, 270, 4, 48, 56],
			["tree-27", 1010, 360, 5, 48, 56],
			["tree-28", 60, 620, 6, 48, 56],
			["tree-29", 450, 620, 1, 48, 56],
			["tree-30", 860, 620, 2, 48, 70],
			["tree-31", 220, 820, 3, 48, 56],
			["tree-32", 620, 820, 4, 48, 56],
			["tree-33", 1040, 820, 5, 48, 56],
			["tree-34", 400, 1160, 6, 48, 56],
			["tree-35", 820, 1160, 1, 48, 56],
			["tree-36", 980, 1320, 2, 48, 70],
			["tree-37", 145, 70, 3, 44, 52],
			["tree-38", 410, 70, 4, 44, 52],
			["tree-39", 760, 70, 5, 44, 52],
			["tree-40", 990, 260, 6, 44, 52],
			["tree-41", 170, 390, 1, 44, 52],
			["tree-42", 590, 390, 2, 44, 64],
			["tree-43", 910, 520, 3, 44, 52],
			["tree-44", 180, 700, 4, 44, 52],
			["tree-45", 530, 700, 5, 44, 52],
			["tree-46", 930, 760, 6, 44, 52],
			["tree-47", 80, 1080, 1, 44, 52],
			["tree-48", 520, 1080, 2, 44, 64],
			["tree-49", 900, 1080, 3, 44, 52],
			["tree-50", 270, 1230, 4, 44, 52],
			["tree-51", 650, 1230, 5, 44, 52],
			["tree-52", 1040, 1260, 6, 44, 52],
			["tree-53", 70, 1380, 1, 44, 52],
			["tree-54", 460, 1390, 2, 44, 64],
			["tree-55", 850, 1410, 3, 44, 52],
			["tree-56", 1030, 80, 4, 44, 52],
			["tree-57", 350, 520, 5, 44, 52],
			["tree-58", 780, 940, 6, 44, 52],
			["tree-59", 330, 950, 1, 44, 52],
			["tree-60", 710, 1360, 2, 44, 64],
		];
		for (const [id, x, bottomY, variant, width, height] of treePlacements) {
			this._treeAsset(id, x, bottomY, variant, width, height);
		}

	}

	_horizontalRoad(g, centerY, width, label, startX = 0, endX = MAP_WIDTH) {
		g.fillStyle(0xd7cda9, 1).fillRect(startX, centerY - width / 2 - 10, endX - startX, width + 20);
		g.fillStyle(0x454a52, 1).fillRect(startX, centerY - width / 2, endX - startX, width);
		g.lineStyle(2, 0x7b8287, 0.8);
		for (let x = startX + 18; x < endX; x += 64) g.lineBetween(x, centerY, Math.min(x + 32, endX), centerY);
		this.add.text(startX + 18, centerY - width / 2 + 7, label, { fontFamily: "monospace", fontSize: "7px", color: "#e8e0bd" }).setDepth(2);
	}

	_verticalRoad(g, centerX, width, label, startY = 0, endY = MAP_HEIGHT) {
		g.fillStyle(0xd7cda9, 1).fillRect(centerX - width / 2 - 10, startY, width + 20, endY - startY);
		g.fillStyle(0x454a52, 1).fillRect(centerX - width / 2, startY, width, endY - startY);
		g.lineStyle(2, 0x7b8287, 0.8);
		for (let y = startY + 18; y < endY; y += 64) g.lineBetween(centerX, y, centerX, Math.min(y + 32, endY));
		this.add.text(centerX - width / 2 + 7, startY + 18, label, { fontFamily: "monospace", fontSize: "7px", color: "#e8e0bd" }).setAngle(90).setDepth(2);
	}

	_diagonalRoad(g, x1, y1, x2, y2, label, width = 70) {
		g.lineStyle(width + 20, 0xd7cda9, 1).lineBetween(x1, y1, x2, y2);
		g.lineStyle(width, 0x454a52, 1).lineBetween(x1, y1, x2, y2);
		const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(x1, y1, x2, y2));
		this.add.text((x1 + x2) / 2, (y1 + y2) / 2 - width / 3, label, { fontFamily: "monospace", fontSize: "7px", color: "#e8e0bd" }).setOrigin(0.5).setAngle(angle).setDepth(2);
	}

	_busStop(x, y) {
		const image = this.add.image(x, y, "outside-bus-stop").setOrigin(0.5, 1).setDisplaySize(120, 90).setDepth(5);
		const interaction = { x: x - 60, y: y - 90, w: 120, h: 90, travelMenu: true, text: "Choose a destination from the bus stop." };
		const label = this.add.text(x, y + 3, "BUS STOP", { fontFamily: "monospace", fontSize: "6px", color: "#d9edff", stroke: "#17396b", strokeThickness: 2 }).setOrigin(0.5, 0).setDepth(25);
		this.interactables.push(interaction);
		this.editableAssets.push({ id: "outside-bus-stop", image, interaction, followers: [{ object: label, offsetX: 0, offsetY: 3 }] });
	}

	_building(id, x, bottomY, texture, width, height, label, text, scene = null, data = null) {
		const image = this.add.image(x, bottomY, texture).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(4);
		const interactable = { x: x - width / 2, y: bottomY - height, w: width, h: height, text, scene, data };
		const labelText = this.add.text(x, bottomY + 3, label, {
			fontFamily: "monospace", fontSize: "6px", color: "#f9efc8", align: "center", stroke: "#1f2c2b", strokeThickness: 2,
		}).setOrigin(0.5, 0).setDepth(25);
		this.interactables.push(interactable);
		this.editableAssets.push({ id, image, interaction: interactable, followers: [{ object: labelText, anchor: "bottom", offsetX: 0, offsetY: 3 }] });
	}

	_outdoorAsset(id, x, bottomY, texture, width, height) {
		const image = this.add.image(x, bottomY, texture).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(4);
		this.editableAssets.push({ id, image });
	}

	_tree(x, y) {
		const image = this.add.image(x, y, "town-tree").setOrigin(0.5, 1).setDisplaySize(20, 30).setDepth(3);
		this.editableAssets.push({ id: `tree-${x}-${y}`, image });
	}

	_treeAsset(id, x, bottomY, variant, width, height) {
		const spot = this._findNearestGreenTreeSpot(x, bottomY, width, height);
		if (!spot) return;
		const image = this.add.image(x, bottomY, `outside-tree-${variant}`)
			.setOrigin(0.5, 1)
			.setDisplaySize(width, height)
			.setDepth(3);
		image.setPosition(spot.x, spot.y);
		this.treeAssetIds.add(id);
		this.editableAssets.push({ id, image, isTree: true, initialX: spot.x, initialY: spot.y });
	}

	_isGreenTreeSpot(x, bottomY, width, height) {
		const halfWidth = Math.min(width * 0.34, 22);
		const baseY = bottomY - 3;
		const upperBaseY = bottomY - Math.min(height * 0.2, 14);
		return [-halfWidth, 0, halfWidth].every((offset) =>
			this._isGrassAt(x + offset, baseY) && this._isGrassAt(x + offset, upperBaseY));
	}

	_findNearestGreenTreeSpot(x, bottomY, width, height) {
		if (this._isGreenTreeSpot(x, bottomY, width, height)) return { x, y: bottomY };
		for (let radius = 16; radius <= 160; radius += 16) {
			for (let offset = -radius; offset <= radius; offset += 16) {
				const candidates = [
					{ x: x + offset, y: bottomY - radius },
					{ x: x + offset, y: bottomY + radius },
					{ x: x - radius, y: bottomY + offset },
					{ x: x + radius, y: bottomY + offset },
				];
				const spot = candidates.find((candidate) => this._isGreenTreeSpot(candidate.x, candidate.y, width, height));
				if (spot) return spot;
			}
		}
		return null;
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

	_createWalkabilityMask() {
		const source = this.textures.get("outside-sax-map").getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = MAP_WIDTH;
		canvas.height = MAP_HEIGHT;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0, MAP_WIDTH, MAP_HEIGHT);
		this.mapPixels = context.getImageData(0, 0, MAP_WIDTH, MAP_HEIGHT).data;
	}

	_isGrassAt(x, y) {
		if (!this.mapPixels || x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return false;
		const index = (Math.floor(y) * MAP_WIDTH + Math.floor(x)) * 4;
		const red = this.mapPixels[index];
		const green = this.mapPixels[index + 1];
		const blue = this.mapPixels[index + 2];
		return green >= 90 && green - red >= 30 && green - blue >= 60;
	}

	_canStandAt(x, y) {
		const feet = { x: x - 8, y: y + 6, w: 16, h: 10 };
		if (feet.x < 8 || feet.y < 8 || feet.x + feet.w > MAP_WIDTH - 8 || feet.y + feet.h > MAP_HEIGHT - 8) return false;
		const sampleXs = [feet.x, feet.x + feet.w / 2, feet.x + feet.w];
		const sampleYs = [feet.y, feet.y + feet.h / 2, feet.y + feet.h];
		if (sampleYs.some((py) => sampleXs.some((px) => this._isGrassAt(px, py)))) return false;
		return !this.solids.some((solid) => feet.x < solid.x + solid.w && feet.x + feet.w > solid.x && feet.y < solid.y + solid.h && feet.y + feet.h > solid.y);
	}

	_resolveSpawn(request) {
		let origin = request.spawn || DEFAULT_ROAD_SPAWN;
		if (request.spawnNearAsset) {
			const asset = this.editableAssets.find((entry) => entry.id === request.spawnNearAsset);
			if (asset) {
				const bounds = asset.image.getBounds();
				origin = { x: asset.image.x, y: bounds.bottom + 24 };
			}
		}
		return this._findNearestWalkable(origin) || { ...DEFAULT_ROAD_SPAWN };
	}

	_findNearestWalkable(origin) {
		const center = {
			x: Phaser.Math.Clamp(Math.round(origin.x), 16, MAP_WIDTH - 16),
			y: Phaser.Math.Clamp(Math.round(origin.y), 16, MAP_HEIGHT - 24),
		};
		if (this._canStandAt(center.x, center.y)) return center;
		for (let radius = 8; radius <= 512; radius += 8) {
			for (let offset = -radius; offset <= radius; offset += 8) {
				const candidates = [
					{ x: center.x + offset, y: center.y + radius },
					{ x: center.x + offset, y: center.y - radius },
					{ x: center.x + radius, y: center.y + offset },
					{ x: center.x - radius, y: center.y + offset },
				];
				for (const candidate of candidates) {
					if (this._canStandAt(candidate.x, candidate.y)) return candidate;
				}
			}
		}
		return this._canStandAt(DEFAULT_ROAD_SPAWN.x, DEFAULT_ROAD_SPAWN.y) ? { ...DEFAULT_ROAD_SPAWN } : null;
	}

	_createUI() {
		const width = this.scale.gameSize.width;
		const height = this.scale.gameSize.height;
		this.dialogueBox = this.add.rectangle(4, height - 78, width - 8, 66, 0x1a1410, 0.94).setOrigin(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
		this.dialogueText = this.add.text(12, height - 70, "", { fontFamily: "monospace", fontSize: "12px", color: "#f2ece0", wordWrap: { width: width - 24 } }).setScrollFactor(0).setDepth(101).setVisible(false);
		this.prompt = this.add.text(width / 2, height - 20, "Press E to interact", { fontFamily: "monospace", fontSize: "9px", color: "#fff" }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setVisible(false);
		this.prompt.setStroke("#000", 3);
		this.dialogueActive = false;
		this.dialogueTyping = false;
		this.dialogueFullText = "";
		this.dialogueIndex = 0;
		this.dialogueTimer = 0;
		this.travelMenuBackdrop = this.add.rectangle(0, 0, 300, 300, 0x1a1410, 0.96).setOrigin(0.5).setScrollFactor(0).setDepth(220);
		this.travelMenuTitle = this.add.text(0, -132, "BUS STOP // FAST TRAVEL", { fontFamily: "monospace", fontSize: "12px", color: "#f4d879", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(221);
		this.travelMenuHint = this.add.text(0, 132, "UP/DOWN choose   E travel   ESC close", { fontFamily: "monospace", fontSize: "8px", color: "#f2ece0" }).setOrigin(0.5).setScrollFactor(0).setDepth(221);
		this.travelOptionTexts = this.travelDestinations.map((destination, index) => this.add.text(-126, -101 + index * 28, destination.label, { fontFamily: "monospace", fontSize: "10px", color: "#f2ece0" }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(221));
		this.travelMenuGroup = this.add.container(0, 0, [this.travelMenuBackdrop, this.travelMenuTitle, this.travelMenuHint, ...this.travelOptionTexts]).setScrollFactor(0).setDepth(220).setVisible(false);
		this._layoutTravelMenu();
	}

	_layoutTravelMenu() {
		if (!this.travelMenuGroup) return;
		this.travelMenuGroup.setPosition(this.scale.gameSize.width / 2, this.scale.gameSize.height / 2);
	}

	_openTravelMenu() {
		this.travelMenuOpen = true;
		this.travelSelection = 0;
		this._renderTravelMenu();
		this.travelMenuGroup.setVisible(true);
		this.prompt.setVisible(false);
	}

	_closeTravelMenu() {
		this.travelMenuOpen = false;
		this.travelMenuGroup?.setVisible(false);
	}

	_renderTravelMenu() {
		this.travelOptionTexts?.forEach((text, index) => {
			text.setText(`${index === this.travelSelection ? ">" : " "} ${this.travelDestinations[index].label}`);
			text.setColor(index === this.travelSelection ? "#f4d879" : "#f2ece0");
		});
	}

	_travelToSelectedDestination() {
		const destination = this.travelDestinations[this.travelSelection];
		let origin = destination;
		if (destination.assetId) {
			const asset = this.editableAssets.find((entry) => entry.id === destination.assetId && !entry.deleted && entry.image.visible);
			if (asset) {
				const bounds = asset.image.getBounds();
				origin = { x: asset.image.x, y: bounds.bottom + 24 };
			} else origin = { ...DEFAULT_ROAD_SPAWN };
		}
		const spawn = this._findNearestWalkable(origin);
		if (!spawn) return;
		this.gx = spawn.x;
		this.gy = spawn.y;
		this.targetX = spawn.x;
		this.targetY = spawn.y;
		this.moving = false;
		this.frameIdx = 0;
		this._closeTravelMenu();
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

	update(time, delta) {
		if (isTextInputActive()) return;
		this._syncMultiplayer();
		if (this.devEditor.active !== this.viewportDevMode) this._configureViewport(this.devEditor.active);
		this.chatSystem?.update(delta, { x: this.gx, y: this.gy }, this.remotePlayer?.getPosition());
		if (this.chatSystem?.typing) return;
		if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.inventoryPanel.toggle(this.activePlayer);
		if (this.inventoryPanel.update(this.activePlayer)) return;
		if (this.devEditor.active) { this.devEditor.update(delta); return; }
		if (this.travelMenuOpen) {
			if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
				this.travelSelection = (this.travelSelection - 1 + this.travelDestinations.length) % this.travelDestinations.length;
				this._renderTravelMenu();
			}
			if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
				this.travelSelection = (this.travelSelection + 1) % this.travelDestinations.length;
				this._renderTravelMenu();
			}
			if (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) this._travelToSelectedDestination();
			if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) this._closeTravelMenu();
			return;
		}

		this._updateDialogue(delta);
		const just = (key) => Phaser.Input.Keyboard.JustDown(this.keys[key]);
		const interact = just("E");
		if (this.dialogueActive) {
			if (interact) {
				if (this.dialogueTyping) { this.dialogueIndex = this.dialogueFullText.length; this.dialogueTyping = false; this.dialogueText.setText(this.dialogueFullText); }
				else this._closeDialogue();
			}
			return;
		}

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
			const dx = this.targetX - this.gx; const dy = this.targetY - this.gy;
			const distance = Math.hypot(dx, dy); const step = MOVE_SPEED * delta / 1000;
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
		this.prompt.setVisible(!!this._nearby());
		if (interact) {
			const hit = this._nearby();
			if (hit?.travelMenu) this._openTravelMenu();
			else if (hit?.scene) this.scene.start(hit.scene, hit.data || {});
			else if (hit?.text) this._showDialogue(hit.text);
		}
	}

	_syncMultiplayer() {
		this.remotePlayer?.update({
			x: this.gx, y: this.gy, dir: this.dirName, moving: this.moving,
			frame: Number(this.player.frame.name) || 0,
			outfit: this.activePlayer === "Aditi" ? (localStorage.getItem("aditi-outfit") || "badger") : "shreyak",
		});
	}
}
