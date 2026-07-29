import { getInventory, getInventoryItemTexture } from "./Inventory.js";

const STORAGE_KEY = "aditi-sticker-books-v1";
const STICKERS_PER_TRAY_PAGE = 6;
const PAGE_ZONES = [
	{ x: 29, y: 119, w: 102, h: 113 },
	{ x: 157, y: 119, w: 102, h: 113 },
];

function readBooks() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
		return {
			Aditi: Array.isArray(saved.Aditi) ? saved.Aditi : [],
			Shreyak: Array.isArray(saved.Shreyak) ? saved.Shreyak : [],
		};
	} catch (error) {
		return { Aditi: [], Shreyak: [] };
	}
}

function writeBooks(books) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
	} catch (error) {
		// The album still works for this session when storage is unavailable.
	}
}

function fitImage(image, maxWidth, maxHeight) {
	const width = Math.max(1, image.frame.realWidth || image.width);
	const height = Math.max(1, image.frame.realHeight || image.height);
	const scale = Math.min(maxWidth / width, maxHeight / height);
	image.setDisplaySize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
}

export class StickerBookPanel {
	constructor(scene) {
		this.scene = scene;
		this.opened = false;
		this.owner = "Aditi";
		this.spread = 0;
		this.trayPage = 0;
		this.selectedId = null;
		this.stickers = [];
		this.renderedStickers = [];
		this.escapeKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
		this.deleteKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE);
		this.backspaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);

		const width = scene.scale.gameSize.width;
		const height = scene.scale.gameSize.height;
		this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(360).setVisible(false);
		this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x11160d, 0.9);
		this.frame = scene.add.rectangle(width / 2, height / 2, width - 8, height - 8, 0x9ba584, 1)
			.setStrokeStyle(3, 0x263214, 1);
		this.header = scene.add.rectangle(width / 2, 24, width - 16, 40, 0x223310, 1);
		this.title = scene.add.text(18, 24, "", {
			fontFamily: "monospace",
			fontSize: "11px",
			fontStyle: "bold",
			color: "#f0da62",
		}).setOrigin(0, 0.5);
		this.closeButton = scene.add.rectangle(width - 24, 24, 28, 28, 0x456785, 1)
			.setStrokeStyle(2, 0xdde5c7, 1)
			.setInteractive({ useHandCursor: true });
		this.closeLabel = scene.add.text(width - 24, 24, "X", {
			fontFamily: "monospace",
			fontSize: "16px",
			fontStyle: "bold",
			color: "#ffffff",
		}).setOrigin(0.5);
		this.book = scene.add.image(width / 2, 179, "aditi-book-panel").setDisplaySize(276, 170);
		this.leftButton = this._makeArrow(14, 178, "<", () => this._changeSpread(-1));
		this.rightButton = this._makeArrow(width - 14, 178, ">", () => this._changeSpread(1));
		this.spreadText = scene.add.text(width / 2, 268, "", {
			fontFamily: "monospace",
			fontSize: "9px",
			color: "#263214",
		}).setOrigin(0.5);
		this.tray = scene.add.rectangle(width / 2, 310, width - 24, 58, 0x263214, 1)
			.setStrokeStyle(2, 0x758259, 1);
		this.trayLayer = scene.add.container(0, 0);
		this.stickerLayer = scene.add.container(0, 0);
		this.help = scene.add.text(width / 2, 354, "CLICK item: add  |  DRAG: arrange  |  DEL: peel  |  ESC: close", {
			fontFamily: "monospace",
			fontSize: "8px",
			color: "#263214",
			align: "center",
		}).setOrigin(0.5);
		this.selectionText = scene.add.text(width / 2, 372, "", {
			fontFamily: "monospace",
			fontSize: "8px",
			color: "#456785",
		}).setOrigin(0.5);

		this.container.add([
			this.backdrop,
			this.frame,
			this.header,
			this.title,
			this.book,
			this.stickerLayer,
			this.leftButton,
			this.rightButton,
			this.spreadText,
			this.tray,
			this.trayLayer,
			this.help,
			this.selectionText,
			this.closeButton,
			this.closeLabel,
		]);
		this.closeButton.on("pointerdown", () => this.close());
		this.closeButton.on("pointerover", () => this.closeButton.setFillStyle(0x5b7d9b));
		this.closeButton.on("pointerout", () => this.closeButton.setFillStyle(0x456785));

		this.dragListener = (pointer, object, dragX, dragY) => this._dragSticker(object, dragX, dragY);
		this.dragEndListener = (pointer, object) => this._finishDragging(object);
		scene.input.on("drag", this.dragListener);
		scene.input.on("dragend", this.dragEndListener);
		scene.events.once("shutdown", () => {
			scene.input.off("drag", this.dragListener);
			scene.input.off("dragend", this.dragEndListener);
		});
	}

	_makeArrow(x, y, label, action) {
		const button = this.scene.add.text(x, y, label, {
			fontFamily: "monospace",
			fontSize: "18px",
			fontStyle: "bold",
			color: "#263214",
			backgroundColor: "#f0da62",
			padding: { x: 3, y: 6 },
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });
		button.on("pointerdown", action);
		return button;
	}

	open(owner) {
		this.owner = owner === "Shreyak" ? "Shreyak" : "Aditi";
		this.spread = 0;
		this.trayPage = 0;
		this.selectedId = null;
		this.stickers = readBooks()[this.owner];
		this.book.setTexture(this.owner === "Shreyak" ? "shreyak-book-panel" : "aditi-book-panel");
		this.title.setText(`${this.owner.toUpperCase()}'S ITEMDEX // STICKER BOOK`);
		this.container.setVisible(true);
		this.opened = true;
		this._render();
	}

	close() {
		this.opened = false;
		this.selectedId = null;
		this.container.setVisible(false);
		this.scene.input.keyboard.resetKeys();
	}

	update() {
		if (!this.opened) return false;
		if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
			this.close();
			return true;
		}
		if (
			this.selectedId
			&& (Phaser.Input.Keyboard.JustDown(this.deleteKey) || Phaser.Input.Keyboard.JustDown(this.backspaceKey))
		) {
			this._removeSelected();
		}
		return true;
	}

	_changeSpread(direction) {
		const populatedSpreads = Math.max(1, this.stickers.reduce((highest, sticker) => Math.max(highest, sticker.spread + 1), 0));
		const highestSpread = populatedSpreads - 1 + (this._hasAvailableSticker() ? 1 : 0);
		this.spread = Phaser.Math.Clamp(this.spread + direction, 0, highestSpread);
		this.selectedId = null;
		this._render();
	}

	_render() {
		this._renderStickers();
		this._renderTray();
		const spreadCount = Math.max(1, this.stickers.reduce((highest, sticker) => Math.max(highest, sticker.spread + 1), 0));
		this.spreadText.setText(`PAGES ${this.spread * 2 + 1}-${this.spread * 2 + 2}  //  ${this.stickers.length} STICKER${this.stickers.length === 1 ? "" : "S"}`);
		this.leftButton.setAlpha(this.spread > 0 ? 1 : 0.35);
		this.rightButton.setAlpha(this.spread < spreadCount || this._hasAvailableSticker() ? 1 : 0.35);
		const selected = this.stickers.find((sticker) => sticker.id === this.selectedId);
		this.selectionText.setText(selected ? `SELECTED // ${selected.name}` : "Choose an item below to add it to these pages.");
	}

	_renderStickers() {
		this.stickerLayer.removeAll(true);
		this.renderedStickers = [];
		for (const data of this.stickers.filter((sticker) => sticker.spread === this.spread)) {
			const backing = this.scene.add.circle(0, 0, 15, 0xfffbea, 1).setStrokeStyle(2, 0xdeb84f, 1);
			const icon = this.scene.add.image(0, -1, getInventoryItemTexture(this.scene, data.name));
			fitImage(icon, 24, 24);
			const sticker = this.scene.add.container(data.x, data.y, [backing, icon])
				.setAngle(data.angle || 0)
				.setSize(32, 32)
				.setInteractive({ useHandCursor: true, draggable: true });
			sticker.stickerId = data.id;
			sticker.stickerBacking = backing;
			sticker.on("pointerdown", () => {
				this.selectedId = data.id;
				this._refreshSelection();
			});
			this.scene.input.setDraggable(sticker);
			this.stickerLayer.add(sticker);
			this.renderedStickers.push(sticker);
			if (data.id === this.selectedId) backing.setStrokeStyle(3, 0x456785, 1);
		}
	}

	_refreshSelection() {
		for (const sticker of this.renderedStickers) {
			sticker.stickerBacking.setStrokeStyle(
				sticker.stickerId === this.selectedId ? 3 : 2,
				sticker.stickerId === this.selectedId ? 0x456785 : 0xdeb84f,
				1,
			);
		}
		const selected = this.stickers.find((sticker) => sticker.id === this.selectedId);
		this.selectionText.setText(selected ? `SELECTED // ${selected.name}` : "Choose an item below to add it to these pages.");
	}

	_renderTray() {
		this.trayLayer.removeAll(true);
		const inventory = getInventory(this.owner);
		if (!inventory.length) {
			const empty = this.scene.add.text(144, 310, "No collected items yet. Adventure first, stickers later.", {
				fontFamily: "monospace",
				fontSize: "8px",
				color: "#dce4c6",
			}).setOrigin(0.5);
			this.trayLayer.add(empty);
			return;
		}
		const pageCount = Math.max(1, Math.ceil(inventory.length / STICKERS_PER_TRAY_PAGE));
		this.trayPage = Phaser.Math.Clamp(this.trayPage, 0, pageCount - 1);
		const entries = inventory.slice(this.trayPage * STICKERS_PER_TRAY_PAGE, (this.trayPage + 1) * STICKERS_PER_TRAY_PAGE);
		entries.forEach((item, index) => {
			const used = this.stickers.filter((sticker) => sticker.name === item.name).length;
			const available = Math.max(0, item.count - used);
			const x = 38 + index * 42;
			const sticker = this.scene.add.circle(x, 306, 16, 0xfffbea, available ? 1 : 0.35)
				.setStrokeStyle(2, available ? 0xf0da62 : 0x758259, 1)
				.setInteractive({ useHandCursor: available > 0 });
			const icon = this.scene.add.image(x, 304, getInventoryItemTexture(this.scene, item.name)).setAlpha(available ? 1 : 0.35);
			fitImage(icon, 24, 24);
			const count = this.scene.add.text(x + 12, 320, `${used}/${item.count}`, {
				fontFamily: "monospace",
				fontSize: "7px",
				color: available ? "#f0da62" : "#9ba584",
				backgroundColor: "#263214",
			}).setOrigin(1, 0.5);
			if (available) sticker.on("pointerdown", () => this._addSticker(item.name));
			this.trayLayer.add([sticker, icon, count]);
		});
		if (pageCount > 1) {
			const previous = this._makeTrayArrow(14, "<", -1, pageCount);
			const next = this._makeTrayArrow(274, ">", 1, pageCount);
			this.trayLayer.add([previous, next]);
		}
	}

	_makeTrayArrow(x, label, direction, pageCount) {
		const button = this.scene.add.text(x, 310, label, {
			fontFamily: "monospace",
			fontSize: "12px",
			color: "#f0da62",
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });
		button.on("pointerdown", () => {
			this.trayPage = Phaser.Math.Wrap(this.trayPage + direction, 0, pageCount);
			this._renderTray();
		});
		return button;
	}

	_hasAvailableSticker() {
		return getInventory(this.owner).some((item) => {
			const used = this.stickers.filter((sticker) => sticker.name === item.name).length;
			return used < item.count;
		});
	}

	_addSticker(name) {
		const existingOnSpread = this.stickers.filter((sticker) => sticker.spread === this.spread).length;
		const zone = PAGE_ZONES[existingOnSpread % 2];
		const row = Math.floor(existingOnSpread / 2) % 3;
		const column = Math.floor(existingOnSpread / 6) % 3;
		this.stickers.push({
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			name,
			spread: this.spread,
			x: zone.x + 22 + column * 28,
			y: zone.y + 22 + row * 34,
			angle: Phaser.Math.Between(-8, 8),
		});
		this.selectedId = this.stickers[this.stickers.length - 1].id;
		this._save();
		this._render();
	}

	_dragSticker(object, dragX, dragY) {
		if (!this.opened || !object.stickerId) return;
		const data = this.stickers.find((sticker) => sticker.id === object.stickerId);
		if (!data) return;
		const zone = dragX < 144 ? PAGE_ZONES[0] : PAGE_ZONES[1];
		object.x = Phaser.Math.Clamp(dragX, zone.x + 16, zone.x + zone.w - 16);
		object.y = Phaser.Math.Clamp(dragY, zone.y + 16, zone.y + zone.h - 16);
		data.x = object.x;
		data.y = object.y;
		this.selectedId = data.id;
	}

	_finishDragging(object) {
		if (!this.opened || !object.stickerId) return;
		this._save();
		this._render();
	}

	_removeSelected() {
		this.stickers = this.stickers.filter((sticker) => sticker.id !== this.selectedId);
		this.selectedId = null;
		this._save();
		this._render();
	}

	_save() {
		const books = readBooks();
		books[this.owner] = this.stickers;
		writeBooks(books);
	}
}
