import { multiplayer } from "./Multiplayer.js";
import { layoutStore } from "./LayoutStore.js";
import { isTextInputActive } from "../shared.js";

export class SceneDevEditor {
	constructor(scene, storageKey, assets, options = {}) {
		this.scene = scene;
		this.storageKey = storageKey;
		this.assets = assets;
		this.layoutVersion = options.layoutVersion || null;
		this.migrateLayout = options.migrateLayout || null;
		this.options = options;
		this.selected = null;
		this.active = localStorage.getItem("aditi-dev-mode") === "1";
		this.keys = scene.input.keyboard.addKeys({
			left: Phaser.Input.Keyboard.KeyCodes.LEFT,
			right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
			up: Phaser.Input.Keyboard.KeyCodes.UP,
			down: Phaser.Input.Keyboard.KeyCodes.DOWN,
			shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
			x: Phaser.Input.Keyboard.KeyCodes.X,
			z: Phaser.Input.Keyboard.KeyCodes.Z,
			r: Phaser.Input.Keyboard.KeyCodes.R,
			pageUp: Phaser.Input.Keyboard.KeyCodes.PAGE_UP,
			pageDown: Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN,
			delete: Phaser.Input.Keyboard.KeyCodes.DELETE,
			backspace: Phaser.Input.Keyboard.KeyCodes.BACKSPACE,
		});
		this._load();
		this._createUI();
		this._bindControls();
		this._layoutListener = (event) => {
			if (event.detail.sceneId !== this.storageKey) return;
			this._applyLayout(event.detail.layout);
			this._refreshHint();
			this._drawOutline();
		};
		window.addEventListener("aditi-multiplayer-layout", this._layoutListener);
		this.scene.events.once("shutdown", () => window.removeEventListener("aditi-multiplayer-layout", this._layoutListener));
	}

	_load() {
		let saved = { positions: {}, clones: [], deleted: [] };
		const localLayout = localStorage.getItem(this.storageKey);
		const hasLocalLayout = !!localLayout;
		try { saved = JSON.parse(localLayout || JSON.stringify(saved)); } catch (err) {}
		const shared = multiplayer.getLayout(this.storageKey);
		if (shared) saved = shared;
		saved = this._prepareLayout(saved);
		this._applyLayout(saved);
		layoutStore.ready.then(() => {
			const persisted = layoutStore.get(this.storageKey);
			if (persisted) {
				const prepared = this._prepareLayout(persisted);
				this._applyLayout(prepared);
				localStorage.setItem(this.storageKey, JSON.stringify(prepared));
				multiplayer.sendLayout(this.storageKey, prepared);
				if (prepared !== persisted) layoutStore.save(this.storageKey, prepared);
				this._refreshHint();
				this._drawOutline();
			} else if (hasLocalLayout) {
				layoutStore.save(this.storageKey, saved);
			}
		});
	}

	_prepareLayout(saved) {
		if (!this.layoutVersion || !this.migrateLayout || saved?.layoutVersion === this.layoutVersion) return saved;
		const migrated = this.migrateLayout(structuredClone(saved || {}));
		return { ...migrated, layoutVersion: this.layoutVersion };
	}

	_applyLayout(saved) {
		saved = { positions: {}, clones: [], deleted: [], ...saved };
		const deletedIds = new Set(Array.isArray(saved.deleted) ? saved.deleted : []);
		for (const asset of this.assets) asset.sourceId = asset.sourceId || asset.id;
		for (const asset of this.assets.filter((entry) => entry.id !== entry.sourceId)) {
			this._removeInteraction(asset);
			asset.image.destroy();
		}
		this.assets = this.assets.filter((entry) => entry.id === entry.sourceId);
		for (const asset of this.assets) {
			asset.sourceId = asset.sourceId || asset.id;
			asset.baseWidth = asset.baseWidth || asset.image.displayWidth;
			asset.baseHeight = asset.baseHeight || asset.image.displayHeight;
			asset.deleted = deletedIds.has(asset.id);
			asset.scale = saved.positions?.[asset.id]?.scale ?? 1;
			asset.depth = saved.positions?.[asset.id]?.depth ?? asset.image.depth;
			asset.rotation = saved.positions?.[asset.id]?.rotation ?? asset.image.angle;
			let x = saved.positions?.[asset.id]?.x ?? asset.image.x;
			let y = saved.positions?.[asset.id]?.y ?? asset.image.y;
			if (this.options.canPlaceAsset && !this.options.canPlaceAsset(asset, x, y)) {
				x = asset.initialX ?? asset.image.x;
				y = asset.initialY ?? asset.image.y;
			}
			asset.image.setPosition(x, y);
			asset.image.setDepth(asset.depth).setAngle(asset.rotation).setDisplaySize(asset.baseWidth * asset.scale, asset.baseHeight * asset.scale);
			asset.image.setVisible(!asset.deleted);
			this._syncFollowers(asset);
			if (asset.deleted) this._removeInteraction(asset);
			else this._restoreInteraction(asset);
			this._syncInteraction(asset);
		}
		for (const cloneData of saved.clones || []) {
			const source = this.assets.find((asset) => asset.id === cloneData.sourceId && !asset.deleted);
			if (source) this._duplicate(source, cloneData, false);
		}
	}

	_createUI() {
		this.hint = this.scene.add.text(8, 8, "", {
			fontFamily: "monospace", fontSize: "9px", color: "#fff6d8",
			backgroundColor: "#1a1410", padding: { x: 6, y: 5 },
		}).setScrollFactor(0).setDepth(500).setVisible(this.active);
		this.outline = this.scene.add.graphics().setDepth(499).setVisible(false);
		this._refreshHint();
	}

	_bindControls() {
		this.scene.input.on("pointerdown", (pointer) => {
			if (!this.active) return;
			if (this.scene.clawMachinePanel?.opened) return;
			const hits = this.assets.filter((asset) => !asset.deleted && asset.image.visible && asset.image.getBounds().contains(pointer.worldX, pointer.worldY)).sort((a, b) => b.depth - a.depth);
			if (!hits.length) return;
			this.selected = hits[0];
			this._refreshHint();
			this._drawOutline();
		});
		this.scene.input.keyboard.on("keydown-F2", () => {
			if (!isTextInputActive()) this.toggle();
		});
		this.scene.input.keyboard.on("keydown-D", (event) => {
			if (isTextInputActive()) return;
			if (!this.active || !event.ctrlKey || !this.selected) return;
			event.preventDefault();
			this.selected = this._duplicate(this.selected);
			this._refreshHint();
			this._drawOutline();
		});
		this.scene.input.keyboard.on("keydown-DELETE", (event) => {
			if (isTextInputActive()) return;
			if (!this.active || !this.selected) return;
			event.preventDefault();
			this._deleteSelected();
		});
		this.scene.input.keyboard.on("keydown-BACKSPACE", (event) => {
			if (isTextInputActive()) return;
			if (!this.active || !this.selected) return;
			event.preventDefault();
			this._deleteSelected();
		});
	}

	toggle() {
		this.active = !this.active;
		this.selected = null;
		this.hint.setVisible(this.active);
		this.outline.setVisible(false);
		localStorage.setItem("aditi-dev-mode", this.active ? "1" : "0");
		this._refreshHint();
	}

	update(delta) {
		if (isTextInputActive()) return;
		if (!this.active || !this.selected) return;
		const speed = this.keys.shift.isDown ? 8 : 2;
		let dx = 0, dy = 0;
		if (this.keys.left.isDown) dx -= speed * delta / 16.67;
		if (this.keys.right.isDown) dx += speed * delta / 16.67;
		if (this.keys.up.isDown) dy -= speed * delta / 16.67;
		if (this.keys.down.isDown) dy += speed * delta / 16.67;
		if (dx || dy) {
			const previousX = this.selected.image.x;
			const previousY = this.selected.image.y;
			const nextX = previousX + dx;
			const nextY = previousY + dy;
			if (!this.options.canPlaceAsset || this.options.canPlaceAsset(this.selected, nextX, nextY)) {
				this.selected.image.setPosition(nextX, nextY);
			} else {
				dx = 0;
				dy = 0;
			}
			this._syncFollowers(this.selected);
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.x)) this._resize(1.1);
		if (Phaser.Input.Keyboard.JustDown(this.keys.z)) this._resize(0.9);
		if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this._rotate(this.keys.shift.isDown ? -15 : 15);
		if (Phaser.Input.Keyboard.JustDown(this.keys.pageUp)) this._layer(1);
		if (Phaser.Input.Keyboard.JustDown(this.keys.pageDown)) this._layer(-1);
		if (dx || dy) {
			this._syncInteraction(this.selected);
			this._save();
			this._drawOutline();
		}
	}

	_resize(factor) {
		this.selected.scale = Phaser.Math.Clamp(this.selected.scale * factor, 0.25, 4);
		this.selected.image.setDisplaySize(this.selected.baseWidth * this.selected.scale, this.selected.baseHeight * this.selected.scale);
		this._syncInteraction(this.selected);
		this._save();
		this._drawOutline();
	}

	_layer(direction) {
		this.selected.depth = Math.max(0, this.selected.depth + direction);
		this.selected.image.setDepth(this.selected.depth);
		this._save();
		this._drawOutline();
	}

	_rotate(degrees) {
		this.selected.rotation = Phaser.Math.Wrap(this.selected.image.angle + degrees, -180, 180);
		this.selected.image.setAngle(this.selected.rotation);
		this._syncInteraction(this.selected);
		this._save();
		this._drawOutline();
	}

	_duplicate(source, saved = null, persist = true) {
		const clone = {
			id: saved?.id || `${source.sourceId}-copy-${Date.now()}-${this.assets.length}`,
			sourceId: source.sourceId,
			baseWidth: source.baseWidth,
			baseHeight: source.baseHeight,
			scale: saved?.scale ?? source.scale,
			depth: saved?.depth ?? source.depth + 1,
			rotation: saved?.rotation ?? source.image.angle,
		};
		clone.image = this.scene.add.image(saved?.x ?? source.image.x + 24, saved?.y ?? source.image.y + 24, source.image.texture.key)
			.setOrigin(source.image.originX, source.image.originY)
			.setAngle(clone.rotation)
			.setFlip(source.image.flipX, source.image.flipY)
			.setDepth(clone.depth)
			.setDisplaySize(clone.baseWidth * clone.scale, clone.baseHeight * clone.scale);
		if (source.interaction) {
			clone.interaction = { ...source.interaction };
			this.scene.interactables.push(clone.interaction);
		}
		this.assets.push(clone);
		this._syncInteraction(clone);
		if (persist) this._save();
		return clone;
	}

	_deleteSelected() {
		const asset = this.selected;
		if (!asset) return;
		this._removeInteraction(asset);
		if (asset.id === asset.sourceId) {
			asset.deleted = true;
			asset.image.setVisible(false);
			this._syncFollowers(asset);
		} else {
			asset.image.destroy();
			this.assets = this.assets.filter((entry) => entry !== asset);
		}
		this.selected = null;
		this._save();
		this._refreshHint();
		this._drawOutline();
	}

	_removeInteraction(asset) {
		if (!asset.interaction || !this.scene.interactables) return;
		const index = this.scene.interactables.indexOf(asset.interaction);
		if (index >= 0) this.scene.interactables.splice(index, 1);
	}

	_restoreInteraction(asset) {
		if (!asset.interaction || !this.scene.interactables || this.scene.interactables.includes(asset.interaction)) return;
		this.scene.interactables.push(asset.interaction);
	}

	_syncInteraction(asset) {
		if (!asset.interaction) return;
		const bounds = asset.image.getBounds();
		asset.interaction.x = bounds.x;
		asset.interaction.y = bounds.y;
		asset.interaction.w = bounds.width;
		asset.interaction.h = bounds.height;
	}

	_syncFollowers(asset) {
		for (const follower of asset.followers || []) {
			const bounds = asset.image.getBounds();
			follower.object
				.setPosition(
					asset.image.x + (follower.offsetX || 0),
					(follower.anchor === "bottom" ? bounds.bottom : asset.image.y) + (follower.offsetY || 0),
				)
				.setVisible(!asset.deleted && asset.image.visible);
		}
	}

	_save() {
		const saved = { positions: {}, clones: [], deleted: [] };
		if (this.layoutVersion) saved.layoutVersion = this.layoutVersion;
		for (const asset of this.assets) {
			if (asset.deleted) {
				saved.deleted.push(asset.id);
				continue;
			}
			saved.positions[asset.id] = { x: asset.image.x, y: asset.image.y, scale: asset.scale, depth: asset.depth, rotation: asset.image.angle };
			if (asset.id !== asset.sourceId) saved.clones.push({ id: asset.id, sourceId: asset.sourceId, x: asset.image.x, y: asset.image.y, scale: asset.scale, depth: asset.depth, rotation: asset.image.angle });
		}
		localStorage.setItem(this.storageKey, JSON.stringify(saved));
		multiplayer.sendLayout(this.storageKey, saved);
		layoutStore.save(this.storageKey, saved);
	}

	_refreshHint() {
		this.hint.setText(this.active ? `DEV MODE | click asset | arrows move | X/Z resize | R rotate | PgUp/PgDn layer | Ctrl+D duplicate | Del delete | F2 exit${this.selected ? ` | selected: ${this.selected.id}` : ""}` : "");
	}

	_drawOutline() {
		this.outline.clear();
		if (!this.selected) return this.outline.setVisible(false);
		const bounds = this.selected.image.getBounds();
		this.outline.lineStyle(2, 0xffd66e, 1).strokeRect(bounds.x, bounds.y, bounds.width, bounds.height).setVisible(true);
	}
}
