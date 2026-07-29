import { multiplayer } from "./Multiplayer.js";

const STORAGE_KEY = "aditi-inventory-v1";
const ITEMS_PER_PAGE = 6;
const ITEM_TEXTURES = {
	"Peach Ice Cream Plush": "claw-game-toy-1",
	"Mint Ice Cream Plush": "claw-game-toy-2",
	"Yellow Ice Cream Plush": "claw-game-toy-3",
	"Purple Ice Cream Plush": "claw-game-toy-4",
	"Pink Ice Cream Plush": "claw-game-toy-5",
	"Babcock Ice Cream Plush": "claw-game-babcock",
	"Bucky Plush": "claw-game-bucky",
	"Capitol Plush": "claw-game-capitol",
	"Cheese Plush": "claw-game-cheese",
	"Cow Plush": "claw-game-cow",
	"Bicycle Plush": "claw-game-cycle",
	"Ducky Plush": "claw-game-ducky",
	"Hot Dog Plush": "claw-game-hotdog",
	"Strawberry Plush": "claw-game-strawberry",
	"Dunkin coffee": "inventory-coffee",
	"M&M": "inventory-candy",
	KitKat: "inventory-chocolate"
};

function readInventory() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
		return { Aditi: saved.Aditi || [], Shreyak: saved.Shreyak || [] };
	} catch (err) {
		return { Aditi: [], Shreyak: [] };
	}
}

function writeInventory(inventory) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

export function getInventory(player) {
	return readInventory()[player] || [];
}

export function transferInventoryItem(from, to, name) {
	const inventory = readInventory();
	const source = inventory[from] || [];
	const item = source.find((entry) => entry.name === name && entry.count > 0);
	if (!item) return false;
	item.count -= 1;
	if (item.count <= 0) inventory[from] = source.filter((entry) => entry !== item);
	if (multiplayer.connected && multiplayer.role === from && to !== from) {
		writeInventory(inventory);
		multiplayer.sendInventoryGift(to, name);
		return true;
	}
	addItemToInventory(inventory, to, name);
	writeInventory(inventory);
	return true;
}

function addItemToInventory(inventory, player, name) {
	const items = inventory[player] || (inventory[player] = []);
	const existing = items.find((item) => item.name === name);
	if (existing) existing.count += 1;
	else items.push({ name, count: 1 });
}

export function addInventoryItem(player, name) {
	const inventory = readInventory();
	addItemToInventory(inventory, player, name);
	writeInventory(inventory);
}

export function deliverInventoryItem(player, name) {
	if (multiplayer.connected && multiplayer.role && multiplayer.role !== player) {
		multiplayer.sendInventoryGift(player, name);
		return;
	}
	addInventoryItem(player, name);
}

if (typeof window !== "undefined") {
	window.addEventListener("aditi-inventory-gift", (event) => {
		const { to, name } = event.detail || {};
		if (!to || !name || (multiplayer.role && to !== multiplayer.role)) return;
		addInventoryItem(to, name);
	});
}

export class InventoryPanel {
	constructor(scene) {
		this.scene = scene;
		this.open = false;
		this.player = "";
		this.page = 0;
		this.items = [];
		this.escapeKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.leftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
		this.rightKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
		this.createItemIcons();

		const width = scene.scale.gameSize.width;
		const height = scene.scale.gameSize.height;
		const panelWidth = Math.min(width - 32, 360);
		const panelHeight = Math.min(height - 40, 260);
		this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(300).setVisible(false);
		this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x080706, 0.72);
		this.panel = scene.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x211711, 0.98).setStrokeStyle(2, 0xc28b3c, 1);
		this.title = scene.add.text(width / 2, height / 2 - panelHeight / 2 + 22, "ITEMDEX // INVENTORY", {
			fontFamily: "monospace",
			fontSize: "13px",
			color: "#ffd66e",
			fontStyle: "bold"
		}).setOrigin(0.5);
		this.playerText = scene.add.text(width / 2, height / 2 - panelHeight / 2 + 46, "", {
			fontFamily: "monospace",
			fontSize: "10px",
			color: "#f2ece0"
		}).setOrigin(0.5);
		this.list = scene.add.text(width / 2, height / 2, "", {
			fontFamily: "monospace",
			fontSize: "11px",
			color: "#fff6d8",
			align: "center",
			lineSpacing: 6
		}).setOrigin(0.5);
		this.itemsLayer = scene.add.container(0, 0);
		this.pageText = scene.add.text(width / 2, height / 2 + panelHeight / 2 - 38, "", {
			fontFamily: "monospace",
			fontSize: "9px",
			color: "#ffd66e"
		}).setOrigin(0.5);
		this.hint = scene.add.text(width / 2, height / 2 + panelHeight / 2 - 18, "ARROWS  page   Q / ESC  close", {
			fontFamily: "monospace",
			fontSize: "9px",
			color: "#cda45b"
		}).setOrigin(0.5);
		this.container.add([this.backdrop, this.panel, this.title, this.playerText, this.list, this.itemsLayer, this.pageText, this.hint]);

		this.giftListener = () => {
			if (this.open && this.player) this.refresh(this.player);
		};
		window.addEventListener("aditi-inventory-gift", this.giftListener);
		scene.events.once("shutdown", () => window.removeEventListener("aditi-inventory-gift", this.giftListener));
	}

	layout(width, height) {
		const panelWidth = Math.min(width - 32, 360);
		const panelHeight = Math.min(height - 40, 260);
		this.backdrop.setPosition(width / 2, height / 2).setSize(width, height);
		this.panel.setPosition(width / 2, height / 2).setSize(panelWidth, panelHeight);
		this.title.setPosition(width / 2, height / 2 - panelHeight / 2 + 22);
		this.playerText.setPosition(width / 2, height / 2 - panelHeight / 2 + 46);
		this.list.setPosition(width / 2, height / 2);
		this.pageText.setPosition(width / 2, height / 2 + panelHeight / 2 - 38);
		this.hint.setPosition(width / 2, height / 2 + panelHeight / 2 - 18);
		if (this.open) this.renderItems();
	}

	toggle(player) {
		this.open = !this.open;
		this.player = player;
		this.container.setVisible(this.open);
		if (this.open) {
			this.page = 0;
			this.refresh(player);
		}
	}

	update(player) {
		if (!this.open) return false;
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.toggle(player);
			return false;
		}
		const pageCount = Math.max(1, Math.ceil(this.items.length / ITEMS_PER_PAGE));
		if (pageCount > 1 && Phaser.Input.Keyboard.JustDown(this.leftKey)) {
			this.page = Phaser.Math.Wrap(this.page - 1, 0, pageCount);
			this.renderItems();
		}
		if (pageCount > 1 && Phaser.Input.Keyboard.JustDown(this.rightKey)) {
			this.page = Phaser.Math.Wrap(this.page + 1, 0, pageCount);
			this.renderItems();
		}
		return this.open;
	}

	refresh(player) {
		this.items = readInventory()[player] || [];
		this.playerText.setText(`${player.toUpperCase()}  /  POCKET ITEMS`);
		this.renderItems();
	}

	createItemIcons() {
		if (this.scene.textures.exists("inventory-item")) return;
		const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

		graphics.fillStyle(0x9a6434).fillRect(2, 6, 16, 13);
		graphics.fillStyle(0xd59b4c).fillRect(4, 8, 12, 9);
		graphics.lineStyle(2, 0x5d351f).strokeRect(6, 2, 8, 7);
		graphics.generateTexture("inventory-item", 20, 20).clear();

		graphics.fillStyle(0xf7efe3).fillRect(4, 5, 11, 13);
		graphics.fillStyle(0xf58220).fillRect(4, 7, 11, 6);
		graphics.fillStyle(0x6c321c).fillRect(6, 2, 9, 3);
		graphics.lineStyle(2, 0xf7efe3).strokeRect(14, 8, 4, 6);
		graphics.generateTexture("inventory-coffee", 20, 20).clear();

		graphics.fillStyle(0xe13735).fillCircle(7, 7, 5);
		graphics.fillStyle(0x51a64b).fillCircle(13, 13, 5);
		graphics.fillStyle(0xffffff).fillRect(5, 5, 2, 2).fillRect(11, 11, 2, 2);
		graphics.generateTexture("inventory-candy", 20, 20).clear();

		graphics.fillStyle(0xd7352c).fillRect(2, 3, 16, 14);
		graphics.fillStyle(0xffd648).fillRect(4, 5, 12, 4);
		graphics.fillStyle(0x633417).fillRect(5, 11, 10, 4);
		graphics.generateTexture("inventory-chocolate", 20, 20).clear();
		graphics.destroy();
	}

	renderItems() {
		this.itemsLayer.removeAll(true);
		const width = this.scene.scale.gameSize.width;
		const height = this.scene.scale.gameSize.height;
		const panelWidth = Math.min(width - 32, 360);
		const panelHeight = Math.min(height - 40, 260);
		const pageCount = Math.max(1, Math.ceil(this.items.length / ITEMS_PER_PAGE));
		this.page = Phaser.Math.Clamp(this.page, 0, pageCount - 1);

		if (!this.items.length) {
			this.list.setVisible(true).setText("Your bag is empty...\nThe next adventure is waiting.");
			this.pageText.setText("");
			return;
		}

		this.list.setVisible(false);
		const start = this.page * ITEMS_PER_PAGE;
		const visibleItems = this.items.slice(start, start + ITEMS_PER_PAGE);
		const left = width / 2 - panelWidth / 2 + 26;
		const top = height / 2 - panelHeight / 2 + 74;

		visibleItems.forEach((item, index) => {
			const rowY = top + index * 24;
			const texture = ITEM_TEXTURES[item.name] || "inventory-item";
			const availableTexture = this.scene.textures.exists(texture) ? texture : "inventory-item";
			const icon = this.scene.add.image(left, rowY, availableTexture).setOrigin(0.5);
			const frameWidth = Math.max(1, icon.frame.realWidth || icon.width);
			const frameHeight = Math.max(1, icon.frame.realHeight || icon.height);
			const scale = Math.min(20 / frameWidth, 20 / frameHeight);
			icon.setDisplaySize(Math.max(1, Math.round(frameWidth * scale)), Math.max(1, Math.round(frameHeight * scale)));
			const label = this.scene.add.text(left + 20, rowY, `${item.name}  x${item.count}`, {
				fontFamily: "monospace",
				fontSize: "10px",
				color: "#fff6d8"
			}).setOrigin(0, 0.5);
			this.itemsLayer.add([icon, label]);
		});

		this.pageText.setText(pageCount > 1 ? `<  BAG ${this.page + 1} / ${pageCount}  >` : "");
	}
}
