import { multiplayer } from "./Multiplayer.js";
import { isTextInputActive } from "../shared.js";

export class ChatSystem {
	constructor(scene, sceneId) {
		this.scene = scene;
		this.sceneId = sceneId;
		this.typing = false;
		this.draft = "";
		this.positions = {};
		this.bubbles = new Map();

		this.entry = document.getElementById("chat-entry");
		this.entryForm = document.getElementById("chat-entry-form");
		this.entryInput = document.getElementById("chat-entry-input");
		this._onKeyDown = (event) => this._handleKey(event);
		this._onSubmit = (event) => {
			event.preventDefault();
			this._finishTyping(true);
		};
		// Keep text-entry keys away from Phaser, but preserve the browser's default typing behavior.
		this._onEntryKeyDown = (event) => {
			event.stopImmediatePropagation();
			if (event.key === "Escape") {
				event.preventDefault();
				this._finishTyping(false);
			} else if (event.key === "Enter") {
				event.preventDefault();
				this._finishTyping(true);
			}
		};
		this._onEntryKeyUp = (event) => event.stopImmediatePropagation();
		scene.input.keyboard.on("keydown", this._onKeyDown);
		this.entryForm?.addEventListener("submit", this._onSubmit);
		this.entryInput?.addEventListener("keydown", this._onEntryKeyDown, true);
		this.entryInput?.addEventListener("keyup", this._onEntryKeyUp, true);
		this._chatListener = (event) => {
			if (event.detail.sceneId === this.sceneId) this.showBubble(event.detail.role, event.detail.text);
		};
		window.addEventListener("aditi-multiplayer-chat", this._chatListener);
		scene.events.once("shutdown", () => {
			scene.input.keyboard.off("keydown", this._onKeyDown);
			this.entryForm?.removeEventListener("submit", this._onSubmit);
			this.entryInput?.removeEventListener("keydown", this._onEntryKeyDown, true);
			this.entryInput?.removeEventListener("keyup", this._onEntryKeyUp, true);
			window.removeEventListener("aditi-multiplayer-chat", this._chatListener);
			if (this.typing) this._finishTyping(false);
		});
	}

	layout() {}

	_handleKey(event) {
		if (isTextInputActive()) return;
		if (!this.typing && event.key?.toLowerCase() === "t") {
			event.preventDefault();
			this.typing = true;
			this.draft = "";
			this._refreshInput();
		}
	}

	_refreshInput() {
		this.entry?.classList.toggle("open", this.typing);
		this.entry?.setAttribute("aria-hidden", this.typing ? "false" : "true");
		if (this.typing) {
			if (this.entryInput) this.entryInput.value = "";
			this.scene.prompt?.setVisible(false);
			this.scene.promptText?.setVisible(false);
			requestAnimationFrame(() => this.entryInput?.focus());
		}
	}

	_finishTyping(send) {
		const text = this.entryInput?.value.trim() || "";
		if (send && text) {
			this.showBubble(multiplayer.role || window.__activePlayer || "Aditi", text);
			multiplayer.sendChat(this.sceneId, text);
		}
		this.typing = false;
		this.draft = "";
		this.entry?.classList.remove("open");
		this.entry?.setAttribute("aria-hidden", "true");
		if (this.entryInput) {
			this.entryInput.value = "";
			this.entryInput.blur();
		}
	}

	setPositions(local, remote) {
		const localRole = multiplayer.role || window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		this.positions[localRole] = local;
		if (remote?.role) this.positions[remote.role] = remote;
	}

	update(delta, local, remote) {
		this.setPositions(local, remote);
		for (const [role, bubble] of this.bubbles) {
			const position = this.positions[role];
			if (!position) continue;
			bubble.container.x = position.x;
			bubble.container.y = position.y - 38 - bubble.height;
			bubble.remaining -= delta;
			if (bubble.remaining <= 0) {
				bubble.container.destroy(true);
				this.bubbles.delete(role);
			}
		}
	}

	showBubble(role, text) {
		const resolvedRole = role || window.__activePlayer || localStorage.getItem("aditi-active-player") || "Aditi";
		const previous = this.bubbles.get(resolvedRole);
		if (previous) previous.container.destroy(true);
		const label = this.scene.add.text(0, 0, text, {
			fontFamily: "monospace",
			fontSize: "9px",
			color: "#1a1410",
			align: "center",
			wordWrap: { width: 112 },
			padding: { x: 5, y: 4 },
		}).setOrigin(0.5, 0.5);
		const width = Math.min(132, Math.max(48, label.width + 8));
		const height = label.height + 6;
		const box = this.scene.add.rectangle(0, 0, width, height, 0xfff6d8, 1).setStrokeStyle(2, 0x1a1410, 1);
		const tail = this.scene.add.triangle(0, height / 2 + 4, 0, 0, 10, 0, 5, 7, 0xfff6d8, 1).setStrokeStyle(1, 0x1a1410, 1);
		const container = this.scene.add.container(0, 0, [box, label, tail]).setDepth(240);
		this.bubbles.set(resolvedRole, { container, height, remaining: 4500 });
		const position = this.positions[resolvedRole];
		if (position) {
			container.setPosition(position.x, position.y - 38 - height);
		}
	}
}
