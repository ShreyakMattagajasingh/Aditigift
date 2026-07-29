import { multiplayer } from "./Multiplayer.js";

const COLS = 7;
const ROWS = 6;
const PIECE_SIZE = 68;
const COLUMN_X = [212, 249, 285, 321, 357, 393, 429];
const ROW_Y = [349, 313, 277, 241, 205, 169];
const LANDSCAPE_SCALE = 0.88;
const PANEL_CENTER = { x: 320, y: 256 };

export class ConnectFourPanel {
	constructor(scene) {
		this.scene = scene;
		this.open = false;
		this.declinedInvite = false;
		this.state = null;
		this.selectedColumn = 3;
		this.pieces = [];
		this.pieceByCell = new Map();
		this.lastAnimatedRevision = -1;
		this.droppingPiece = null;
		this.landingPulse = null;
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
		window.addEventListener("aditi-connect4-state", this._stateListener);
		scene.events.once("shutdown", () => this.destroy());
	}

	_build() {
		const viewportWidth = this.scene.scale.gameSize.width;
		const viewportHeight = this.scene.scale.gameSize.height;
		const rootX = viewportWidth / 2 - PANEL_CENTER.x * LANDSCAPE_SCALE;
		const rootY = viewportHeight / 2 - PANEL_CENTER.y * LANDSCAPE_SCALE;
		this.root = this.scene.add.container(rootX, rootY)
			.setScale(LANDSCAPE_SCALE)
			.setDepth(1000)
			.setScrollFactor(0)
			.setVisible(false);
		const shade = this.scene.add.rectangle(
			-rootX / LANDSCAPE_SCALE,
			-rootY / LANDSCAPE_SCALE,
			viewportWidth / LANDSCAPE_SCALE,
			viewportHeight / LANDSCAPE_SCALE,
			0x080b18,
			0.9,
		).setOrigin(0);
		const panel = this.scene.add.rectangle(320, 256, 604, 480, 0xf5ead0).setStrokeStyle(5, 0x17234b);
		const inner = this.scene.add.rectangle(320, 256, 584, 460, 0xfff8e7).setStrokeStyle(2, 0xe7b93f);
		const header = this.scene.add.rectangle(320, 52, 570, 56, 0xc8323e).setStrokeStyle(3, 0x7b1624);
		const title = this.scene.add.text(48, 35, "LINK BATTLE  /  CONNECT 4", {
			fontFamily: "monospace", fontSize: "18px", color: "#fff7d6", fontStyle: "bold",
		});
		this.closeButton = this.scene.add.text(584, 34, "X", {
			fontFamily: "monospace", fontSize: "20px", color: "#fff7d6", backgroundColor: "#7b1624", padding: { x: 8, y: 4 },
		}).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.closePanel());
		this.statusText = this.scene.add.text(320, 91, "", {
			fontFamily: "monospace", fontSize: "14px", color: "#17234b", fontStyle: "bold", align: "center",
		}).setOrigin(0.5);
		this.subText = this.scene.add.text(320, 112, "", {
			fontFamily: "monospace", fontSize: "10px", color: "#654b35", align: "center",
		}).setOrigin(0.5);
		this.cursor = this.scene.add.text(COLUMN_X[this.selectedColumn], 137, "V", {
			fontFamily: "monospace", fontSize: "18px", color: "#c8323e", fontStyle: "bold",
		}).setOrigin(0.5);
		this.pieceLayer = this.scene.add.container(0, 0);
		const board = this.scene.add.image(320, 278, "connect4-board").setDisplaySize(360, 360);
		this.footer = this.scene.add.text(320, 449, "ARROWS / CLICK: CHOOSE   E: DROP   ESC: LEAVE", {
			fontFamily: "monospace", fontSize: "10px", color: "#17234b", align: "center",
		}).setOrigin(0.5);
		this.restartButton = this.scene.add.text(320, 420, "R  REMATCH", {
			fontFamily: "monospace", fontSize: "12px", color: "#fff7d6", backgroundColor: "#28784b", padding: { x: 12, y: 7 },
		}).setOrigin(0.5).setInteractive({ useHandCursor: true }).setVisible(false)
			.on("pointerdown", () => multiplayer.restartConnectFour());

		this.root.add([shade, panel, inner, header, title, this.closeButton, this.statusText, this.subText, this.cursor, this.pieceLayer, board, this.restartButton, this.footer]);
		for (let col = 0; col < COLS; col += 1) {
			const hit = this.scene.add.zone(COLUMN_X[col], 278, 34, 224).setInteractive({ useHandCursor: true });
			hit.on("pointerover", () => { this.selectedColumn = col; this._renderCursor(); });
			hit.on("pointerdown", () => { this.selectedColumn = col; this._drop(); });
			this.root.add(hit);
		}
	}

	openPanel() {
		if (this.open) return;
		this.open = true;
		this.declinedInvite = false;
		this.state = multiplayer.connectFourState;
		this.root.setVisible(true).setAlpha(0);
		this.scene.tweens.add({
			targets: this.root,
			alpha: 1,
			duration: 180,
			ease: "Power1",
		});
		this._render();
		if (multiplayer.connected) multiplayer.joinConnectFour();
	}

	closePanel() {
		if (!this.open) return;
		this.open = false;
		this.declinedInvite = true;
		this.state = null;
		this._clearDropAnimation();
		this.root.setVisible(false);
		multiplayer.leaveConnectFour();
	}

	update() {
		if (!this.open) {
			if (this.declinedInvite) {
				if (!this.scene._nearby()?.connectFour) this.declinedInvite = false;
				return false;
			}
			return this._joinNearbyInvite(multiplayer.connectFourState);
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.escape)) {
			this.closePanel();
			return true;
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.left)) {
			this.selectedColumn = Phaser.Math.Wrap(this.selectedColumn - 1, 0, COLS);
			this._renderCursor();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.right)) {
			this.selectedColumn = Phaser.Math.Wrap(this.selectedColumn + 1, 0, COLS);
			this._renderCursor();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keys.place) || Phaser.Input.Keyboard.JustDown(this.keys.space)) this._drop();
		if (Phaser.Input.Keyboard.JustDown(this.keys.restart) && ["won", "draw"].includes(this.state?.status)) multiplayer.restartConnectFour();
		return true;
	}

	_joinNearbyInvite(invite) {
		if (this.declinedInvite) return false;
		const invited = invite?.status === "waiting" && !invite.players?.includes(multiplayer.role);
		if (!invited || !this.scene._nearby()?.connectFour) return false;
		this.openPanel();
		return true;
	}

	_drop() {
		if (this.state?.status !== "playing" || this.state.turn !== multiplayer.role) return;
		multiplayer.moveConnectFour(this.selectedColumn);
	}

	_render() {
		for (const piece of this.pieces) piece.destroy();
		this.pieces = [];
		this.pieceByCell.clear();
		const board = this.state?.board || {};
		const pendingMove = this.state?.lastMove;
		const shouldAnimateMove = pendingMove
			&& Number(this.state?.revision) !== this.lastAnimatedRevision;
		for (let col = 0; col < COLS; col += 1) {
			for (let row = 0; row < ROWS; row += 1) {
				const role = board[`${col}:${row}`];
				if (!role) continue;
				const key = role === "Aditi" ? "connect4-red" : "connect4-yellow";
				const piece = this.scene.add.image(COLUMN_X[col], ROW_Y[row], key).setDisplaySize(PIECE_SIZE, PIECE_SIZE);
				if (shouldAnimateMove && pendingMove.column === col && pendingMove.row === row) piece.setAlpha(0);
				this.pieceLayer.add(piece);
				this.pieces.push(piece);
				this.pieceByCell.set(`${col}:${row}`, piece);
			}
		}

		if (!multiplayer.connected) {
			this.statusText.setText("MULTIPLAYER ROOM REQUIRED");
			this.subText.setText("Host or join a two-player room first.");
		} else if (!this.state || this.state.status === "waiting") {
			this.statusText.setText("WAITING FOR PLAYER 2...");
			this.subText.setText(`${multiplayer.role} is at the table`);
		} else if (this.state.status === "playing") {
			const mine = this.state.turn === multiplayer.role;
			this.statusText.setText(mine ? "YOUR TURN" : `${this.state.turn.toUpperCase()}'S TURN`);
			this.subText.setText("Aditi: red  /  Shreyak: yellow");
		} else if (this.state.status === "won") {
			this.statusText.setText(this.state.winner === multiplayer.role ? "YOU WIN!" : `${this.state.winner.toUpperCase()} WINS!`);
			this.subText.setText("A clean four in a row.");
		} else {
			this.statusText.setText("DRAW GAME");
			this.subText.setText("The board is full.");
		}
		this.restartButton.setVisible(["won", "draw"].includes(this.state?.status));
		this._renderCursor();
	}

	_renderCursor() {
		this.cursor.setX(COLUMN_X[this.selectedColumn]);
		const canPlay = this.state?.status === "playing" && this.state.turn === multiplayer.role;
		this.cursor.setVisible(canPlay);
	}

	_animateLastMove() {
		const move = this.state?.lastMove;
		const revision = Number(this.state?.revision);
		if (!move || !Number.isFinite(revision) || revision === this.lastAnimatedRevision) return;
		if (!Number.isInteger(move.column) || !Number.isInteger(move.row)) return;
		this.lastAnimatedRevision = revision;
		this._clearDropAnimation();

		const key = move.role === "Aditi" ? "connect4-red" : "connect4-yellow";
		const targetX = COLUMN_X[move.column];
		const targetY = ROW_Y[move.row];
		this.droppingPiece = this.scene.add.image(targetX, 137, key)
			.setDisplaySize(PIECE_SIZE, PIECE_SIZE);
		this.pieceLayer.add(this.droppingPiece);
		this.scene.tweens.add({
			targets: this.droppingPiece,
			y: targetY,
			duration: 310 + move.row * 28,
			ease: "Bounce.easeOut",
			onComplete: () => this._finishDrop(move),
		});
	}

	_finishDrop(move) {
		if (this.droppingPiece) {
			this.droppingPiece.destroy();
			this.droppingPiece = null;
		}
		this.pieceByCell.get(`${move.column}:${move.row}`)?.setAlpha(1);
		this.landingPulse = this.scene.add.circle(
			COLUMN_X[move.column],
			ROW_Y[move.row],
			24,
			move.role === "Aditi" ? 0xc8323e : 0xe7b93f,
			0,
		).setStrokeStyle(3, 0xfff7d6, 0.9);
		this.pieceLayer.add(this.landingPulse);
		this.scene.tweens.add({
			targets: this.landingPulse,
			scale: 1.55,
			alpha: 0,
			duration: 230,
			ease: "Quad.easeOut",
			onComplete: () => {
				this.landingPulse?.destroy();
				this.landingPulse = null;
				if (this.state?.status === "won") this._animateWinningLine();
			},
		});
	}

	_animateWinningLine() {
		const board = this.state?.board || {};
		const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
		for (const [cell, role] of Object.entries(board)) {
			const [column, row] = cell.split(":").map(Number);
			for (const [dx, dy] of directions) {
				const cells = Array.from({ length: 4 }, (_, index) => `${column + dx * index}:${row + dy * index}`);
				if (!cells.every((key) => board[key] === role)) continue;
				const targets = cells.map((key) => this.pieceByCell.get(key)).filter(Boolean);
				this.scene.tweens.add({
					targets,
					alpha: 0.62,
					duration: 180,
					yoyo: true,
					repeat: 2,
					ease: "Sine.easeInOut",
				});
				return;
			}
		}
	}

	_clearDropAnimation() {
		if (this.droppingPiece) {
			this.scene.tweens.killTweensOf(this.droppingPiece);
			this.droppingPiece.destroy();
			this.droppingPiece = null;
		}
		if (this.landingPulse) {
			this.scene.tweens.killTweensOf(this.landingPulse);
			this.landingPulse.destroy();
			this.landingPulse = null;
		}
	}

	destroy() {
		this._clearDropAnimation();
		if (this.open) multiplayer.leaveConnectFour();
		window.removeEventListener("aditi-connect4-state", this._stateListener);
	}
}
