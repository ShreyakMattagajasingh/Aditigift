import { multiplayer } from "./Multiplayer.js";

const PIT_X = [274, 359, 444, 529, 614, 699];
const TOP_Y = 220;
const BOTTOM_Y = 322;
const STORE_X = { Aditi: 798, Shreyak: 162 };
const STORE_Y = 270;

export class MancalaPanel {
	constructor(scene) {
		this.scene = scene;
		this.open = false;
		this.declinedInvite = false;
		this.state = null;
		this.selectedPit = 0;
		this.markers = [];
		this.lastAnimatedRevision = -1;
		this.travelingBead = null;
		this.destinationPulse = null;
		this.keys = scene.input.keyboard.addKeys({
			left: Phaser.Input.Keyboard.KeyCodes.LEFT,
			right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
			place: Phaser.Input.Keyboard.KeyCodes.E,
			space: Phaser.Input.Keyboard.KeyCodes.SPACE,
			escape: Phaser.Input.Keyboard.KeyCodes.ESC,
			restart: Phaser.Input.Keyboard.KeyCodes.R,
		});
		this._build();
		this._stateListener = (event) => {
			if (!this.open) {
				this._joinNearbyInvite(event.detail);
				return;
			}
			this.state = event.detail;
			this._render();
			this._animateLastMove();
		};
		window.addEventListener("aditi-mancala-state", this._stateListener);
		scene.events.once("shutdown", () => this.destroy());
	}

	_build() {
		const viewportWidth = this.scene.scale.gameSize.width;
		const viewportHeight = this.scene.scale.gameSize.height;
		this.root = this.scene.add.container(0, 0).setDepth(1000).setScrollFactor(0).setVisible(false);
		const shade = this.scene.add.rectangle(0, 0, viewportWidth, viewportHeight, 0x11170b, 0.92).setOrigin(0);
		const panel = this.scene.add.rectangle(480, 270, 920, 510, 0xaeb597).setStrokeStyle(5, 0x263014);
		const inner = this.scene.add.rectangle(480, 270, 894, 484, 0xc6ccb1).setStrokeStyle(2, 0x6c7657);
		const header = this.scene.add.rectangle(480, 48, 880, 58, 0x263014).setStrokeStyle(3, 0x101708);
		const title = this.scene.add.text(58, 31, "TABLE LINK  //  MANCALA", {
			fontFamily: "monospace", fontSize: "19px", color: "#d7bd58", fontStyle: "bold",
		});
		this.closeButton = this.scene.add.text(872, 29, "X", {
			fontFamily: "monospace", fontSize: "20px", color: "#edf0dc", backgroundColor: "#3f5f79", padding: { x: 9, y: 5 },
		}).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.closePanel());
		this.statusText = this.scene.add.text(480, 91, "", {
			fontFamily: "monospace", fontSize: "15px", color: "#263014", fontStyle: "bold", align: "center",
		}).setOrigin(0.5);
		this.subText = this.scene.add.text(480, 115, "", {
			fontFamily: "monospace", fontSize: "11px", color: "#465332", align: "center",
		}).setOrigin(0.5);
		const board = this.scene.add.image(480, 287, "mancala-board").setDisplaySize(800, 275);
		this.pieceLayer = this.scene.add.container(0, 0);
		this.cursor = this.scene.add.rectangle(PIT_X[0], BOTTOM_Y, 58, 48, 0x000000, 0)
			.setStrokeStyle(4, 0xd7bd58)
			.setVisible(false);
		this.restartButton = this.scene.add.text(480, 432, "R  REMATCH", {
			fontFamily: "monospace", fontSize: "13px", color: "#edf0dc", backgroundColor: "#3f5f79", padding: { x: 14, y: 8 },
		}).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false)
			.on("pointerdown", () => multiplayer.restartMancala());
		this.footer = this.scene.add.text(480, 478, "ARROWS / CLICK: CHOOSE PIT   E: SOW   ESC: LEAVE", {
			fontFamily: "monospace", fontSize: "11px", color: "#263014", align: "center",
		}).setOrigin(0.5);

		this.root.add([shade, panel, inner, header, title, this.closeButton, this.statusText, this.subText, board, this.pieceLayer, this.cursor, this.restartButton, this.footer]);
		for (let globalPit = 0; globalPit < 12; globalPit += 1) {
			const isAditi = globalPit < 6;
			const localPit = isAditi ? globalPit : globalPit - 6;
			const x = isAditi ? PIT_X[localPit] : PIT_X[5 - localPit];
			const y = isAditi ? BOTTOM_Y : TOP_Y;
			const hit = this.scene.add.zone(x, y, 70, 54).setInteractive({ useHandCursor: true });
			hit.on("pointerover", () => {
				if ((multiplayer.role === "Aditi") === isAditi) {
					this.selectedPit = localPit;
					this._renderCursor();
				}
			});
			hit.on("pointerdown", () => {
				if ((multiplayer.role === "Aditi") !== isAditi) return;
				this.selectedPit = localPit;
				this._renderCursor();
				this._sow();
			});
			this.root.add(hit);
		}
	}

	openPanel() {
		if (this.open) return;
		this.open = true;
		this.declinedInvite = false;
		this.state = multiplayer.mancalaState;
		this.root.setVisible(true).setAlpha(0);
		this.scene.tweens.add({
			targets: this.root,
			alpha: 1,
			duration: 180,
			ease: "Stepped",
		});
		this._render();
		if (multiplayer.connected) multiplayer.joinMancala();
	}

	closePanel() {
		if (!this.open) return;
		this.open = false;
		this.declinedInvite = true;
		this.state = null;
		this._clearMoveAnimation();
		this.root.setVisible(false);
		multiplayer.leaveMancala();
	}

	update() {
		if (!this.open) {
			if (this.declinedInvite) {
				if (!this.scene._nearby()?.mancala) this.declinedInvite = false;
				return false;
			}
			return this._joinNearbyInvite(multiplayer.mancalaState);
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
			this.closePanel();
			return true;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.left)) {
			this.selectedPit = Phaser.Math.Wrap(this.selectedPit - 1, 0, 6);
			this._renderCursor();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.right)) {
			this.selectedPit = Phaser.Math.Wrap(this.selectedPit + 1, 0, 6);
			this._renderCursor();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.place) || Phaser.Input.Keyboard.JustDown(this.keys.space)) this._sow();
		if (Phaser.Input.Keyboard.JustDown(this.keys.restart) && ["won", "draw"].includes(this.state?.status)) multiplayer.restartMancala();
		return true;
	}

	_joinNearbyInvite(invite) {
		if (this.declinedInvite) return false;
		const invited = invite?.status === "waiting" && !invite.players?.includes(multiplayer.role);
		if (!invited || !this.scene._nearby()?.mancala) return false;
		this.openPanel();
		return true;
	}

	_sow() {
		if (this.state?.status !== "playing" || this.state.turn !== multiplayer.role) return;
		const boardIndex = multiplayer.role === "Aditi" ? this.selectedPit : this.selectedPit + 6;
		if (!(this.state.board?.[boardIndex] > 0)) return;
		multiplayer.moveMancala(this.selectedPit);
	}

	_render() {
		for (const marker of this.markers) marker.destroy();
		this.markers = [];
		this.pieceLayer.removeAll(false);
		const board = Array.isArray(this.state?.board) ? this.state.board : Array(12).fill(4);
		for (let index = 0; index < 12; index += 1) {
			const isAditi = index < 6;
			const localPit = isAditi ? index : index - 6;
			const x = isAditi ? PIT_X[localPit] : PIT_X[5 - localPit];
			const y = isAditi ? BOTTOM_Y : TOP_Y;
			this._renderPile(x, y, board[index] || 0, index);
		}
		this._renderPile(STORE_X.Shreyak, STORE_Y, this.state?.stores?.Shreyak || 0, 6, true);
		this._renderPile(STORE_X.Aditi, STORE_Y, this.state?.stores?.Aditi || 0, 2, true);

		if (!multiplayer.connected) {
			this.statusText.setText("MULTIPLAYER ROOM REQUIRED");
			this.subText.setText("Host or join a two-player room first.");
		} else if (!this.state || this.state.status === "waiting") {
			this.statusText.setText("WAITING FOR PLAYER 2...");
			this.subText.setText(`${multiplayer.role} is at the Mancala table`);
		} else if (this.state.status === "playing") {
			const mine = this.state.turn === multiplayer.role;
			this.statusText.setText(mine ? "YOUR TURN" : `${this.state.turn.toUpperCase()}'S TURN`);
			this.subText.setText(`Aditi ${this.state.stores.Aditi}  //  Shreyak ${this.state.stores.Shreyak}`);
		} else if (this.state.status === "won") {
			this.statusText.setText(this.state.winner === multiplayer.role ? "YOU WIN!" : `${this.state.winner.toUpperCase()} WINS!`);
			this.subText.setText(`FINAL  //  Aditi ${this.state.stores.Aditi}  //  Shreyak ${this.state.stores.Shreyak}`);
		} else {
			this.statusText.setText("DRAW GAME");
			this.subText.setText(`FINAL  //  ${this.state.stores.Aditi} EACH`);
		}
		this.restartButton.setVisible(["won", "draw"].includes(this.state?.status));
		this._renderCursor();
	}

	_renderPile(x, y, count, colorSeed, store = false) {
		if (count > 0) {
			const bead = this.scene.add.image(x, y, `mancala-bead-${colorSeed % 8 + 1}`)
				.setDisplaySize(store ? 48 : 40, store ? 38 : 31);
			this.pieceLayer.add(bead);
			this.markers.push(bead);
		}
		const label = this.scene.add.text(x + (store ? 32 : 25), y - (store ? 37 : 28), String(count), {
			fontFamily: "monospace", fontSize: store ? "15px" : "13px", color: "#fff7d6", fontStyle: "bold",
			backgroundColor: "#263014", padding: { x: 4, y: 2 },
		}).setOrigin(0.5);
		this.pieceLayer.add(label);
		this.markers.push(label);
	}

	_renderCursor() {
		const isAditi = multiplayer.role !== "Shreyak";
		const x = isAditi ? PIT_X[this.selectedPit] : PIT_X[5 - this.selectedPit];
		const y = isAditi ? BOTTOM_Y : TOP_Y;
		this.cursor.setPosition(x, y);
		const boardIndex = isAditi ? this.selectedPit : this.selectedPit + 6;
		const canPlay = this.state?.status === "playing"
			&& this.state.turn === multiplayer.role
			&& this.state.board?.[boardIndex] > 0;
		this.cursor.setVisible(canPlay);
	}

	_ringPosition(position) {
		if (position >= 0 && position <= 5) {
			return { x: PIT_X[position], y: BOTTOM_Y };
		}
		if (position === 6) return { x: STORE_X.Aditi, y: STORE_Y };
		if (position >= 7 && position <= 12) {
			return { x: PIT_X[12 - position], y: TOP_Y };
		}
		return { x: STORE_X.Shreyak, y: STORE_Y };
	}

	_moveStart(lastMove) {
		const localPit = Phaser.Math.Clamp(Number(lastMove?.pit) || 0, 0, 5);
		return lastMove?.role === "Shreyak"
			? { x: PIT_X[5 - localPit], y: TOP_Y }
			: { x: PIT_X[localPit], y: BOTTOM_Y };
	}

	_animateLastMove() {
		const move = this.state?.lastMove;
		const revision = Number(this.state?.revision);
		if (!move?.path?.length || !Number.isFinite(revision) || revision === this.lastAnimatedRevision) return;
		this.lastAnimatedRevision = revision;
		this._clearMoveAnimation();

		const start = this._moveStart(move);
		const beadKey = move.role === "Shreyak" ? "mancala-bead-6" : "mancala-bead-2";
		this.travelingBead = this.scene.add.image(start.x, start.y, beadKey)
			.setDisplaySize(34, 27)
			.setDepth(4);
		this.root.add(this.travelingBead);

		const visit = (index) => {
			if (!this.travelingBead || index >= move.path.length) {
				this._finishMoveAnimation(move.path.at(-1));
				return;
			}
			const destination = this._ringPosition(move.path[index]);
			const bead = this.travelingBead;
			this.scene.tweens.add({
				targets: bead,
				x: destination.x,
				y: destination.y - 13,
				angle: bead.angle + 35,
				duration: 90,
				ease: "Sine.easeOut",
				onComplete: () => {
					if (!this.travelingBead) return;
					this.scene.tweens.add({
						targets: bead,
						y: destination.y,
						duration: 65,
						ease: "Bounce.easeOut",
						onComplete: () => visit(index + 1),
					});
				},
			});
		};
		visit(0);
	}

	_finishMoveAnimation(lastPosition) {
		const destination = this._ringPosition(lastPosition);
		if (this.travelingBead) {
			this.travelingBead.destroy();
			this.travelingBead = null;
		}
		this.destinationPulse = this.scene.add.ellipse(destination.x, destination.y, 58, 42, 0xd7bd58, 0)
			.setStrokeStyle(4, 0xd7bd58, 1)
			.setDepth(3);
		this.root.add(this.destinationPulse);
		this.scene.tweens.add({
			targets: this.destinationPulse,
			scaleX: 1.45,
			scaleY: 1.45,
			alpha: 0,
			duration: 280,
			ease: "Quad.easeOut",
			onComplete: () => {
				this.destinationPulse?.destroy();
				this.destinationPulse = null;
			},
		});
	}

	_clearMoveAnimation() {
		if (this.travelingBead) {
			this.scene.tweens.killTweensOf(this.travelingBead);
			this.travelingBead.destroy();
			this.travelingBead = null;
		}
		if (this.destinationPulse) {
			this.scene.tweens.killTweensOf(this.destinationPulse);
			this.destinationPulse.destroy();
			this.destinationPulse = null;
		}
	}

	destroy() {
		this._clearMoveAnimation();
		if (this.open) multiplayer.leaveMancala();
		window.removeEventListener("aditi-mancala-state", this._stateListener);
	}
}
