import { multiplayer } from "./Multiplayer.js";

const OUTFIT_TEXTURES = {
	badger: "player_badger",
	black_dress: "player_black_dress",
	white_sundress: "player_white_sundress",
	casual: "player_casual",
	borrowed_hoodie: "player_borrowed_hoodie",
};

export class RemotePlayer {
	constructor(scene, sceneId) {
		this.scene = scene;
		this.sceneId = sceneId;
		this.sprite = null;
		this.shadow = null;
		this.visible = false;
	}

	update(localState) {
		if (!multiplayer.connected) return;
		multiplayer.sendState({ sceneId: this.sceneId, ...localState });
		const state = multiplayer.peerState;
		if (!state || state.sceneId !== this.sceneId) {
			this._setVisible(false);
			return;
		}
		const texture = state.role === "Shreyak" ? "npc_shreyak" : (OUTFIT_TEXTURES[state.outfit] || "player_badger");
		this.role = state.role;
		if (!this.sprite) {
			this.shadow = this.scene.add.ellipse(state.x, state.y + 14, 20, 4, 0x000000, 0.22).setDepth(18);
			this.sprite = this.scene.add.sprite(state.x - 20, state.y - 34, texture, state.frame).setOrigin(0, 0).setDepth(19);
		} else if (this.sprite.texture.key !== texture) {
			this.sprite.setTexture(texture, state.frame);
		}
		if (!this.visible) {
			this.sprite.setPosition(state.x - 20, state.y - 34);
			this.shadow.setPosition(state.x, state.y + 14);
		} else {
			this.sprite.x = Phaser.Math.Linear(this.sprite.x, state.x - 20, 0.38);
			this.sprite.y = Phaser.Math.Linear(this.sprite.y, state.y - 34, 0.38);
			this.shadow.x = Phaser.Math.Linear(this.shadow.x, state.x, 0.38);
			this.shadow.y = Phaser.Math.Linear(this.shadow.y, state.y + 14, 0.38);
		}
		this.sprite.setFrame(state.frame);
		this._setVisible(true);
	}

	getPosition() {
		if (!this.visible || !this.sprite) return null;
		return { x: this.sprite.x + 20, y: this.sprite.y + 34, role: this.role };
	}

	_setVisible(visible) {
		this.visible = visible;
		this.sprite?.setVisible(visible);
		this.shadow?.setVisible(visible);
	}
}
