function createConnectFour(firstRole = "") {
	return {
		board: {},
		players: new Set(firstRole ? [firstRole] : []),
		firstRole,
		turn: "",
		status: "waiting",
		winner: "",
		lastMove: null,
		revision: 0,
	};
}

function connectFourSnapshot(state) {
	return {
		board: { ...state.board },
		players: [...state.players],
		status: state.status,
		turn: state.turn,
		winner: state.winner || null,
		lastMove: state.lastMove ? { ...state.lastMove } : null,
		revision: state.revision,
	};
}

function connectFourWon(board, role, column, row) {
	return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
		let count = 1;
		for (const direction of [-1, 1]) {
			let x = column + dx * direction;
			let y = row + dy * direction;
			while (board[`${x}:${y}`] === role) {
				count += 1;
				x += dx * direction;
				y += dy * direction;
			}
		}
		return count >= 4;
	});
}

function createMancala(firstRole = "") {
	return {
		board: Array(12).fill(4),
		stores: { Aditi: 0, Shreyak: 0 },
		players: new Set(firstRole ? [firstRole] : []),
		firstRole,
		turn: "",
		status: "waiting",
		winner: "",
		lastMove: null,
		revision: 0,
	};
}

function mancalaSnapshot(state) {
	return {
		board: [...state.board],
		stores: { ...state.stores },
		players: [...state.players],
		status: state.status,
		turn: state.turn,
		winner: state.winner || null,
		lastMove: state.lastMove ? {
			role: state.lastMove.role,
			pit: state.lastMove.pit,
			path: [...state.lastMove.path],
		} : null,
		revision: state.revision,
	};
}

function playMancalaMove(state, role, localPit) {
	const boardIndex = role === "Aditi" ? localPit : localPit + 6;
	let stones = state.board[boardIndex];
	if (!stones) return false;
	state.board[boardIndex] = 0;
	let ringPosition = boardIndex <= 5 ? boardIndex : boardIndex + 1;
	const ownStore = role === "Aditi" ? 6 : 13;
	const opponentStore = role === "Aditi" ? 13 : 6;
	const path = [];

	while (stones > 0) {
		ringPosition = (ringPosition + 1) % 14;
		if (ringPosition === opponentStore) continue;
		if (ringPosition === 6) state.stores.Aditi += 1;
		else if (ringPosition === 13) state.stores.Shreyak += 1;
		else state.board[ringPosition < 6 ? ringPosition : ringPosition - 1] += 1;
		path.push(ringPosition);
		stones -= 1;
	}
	state.lastMove = { role, pit: localPit, path };

	if (ringPosition !== ownStore && ringPosition !== 6 && ringPosition !== 13) {
		const landedIndex = ringPosition < 6 ? ringPosition : ringPosition - 1;
		const landedOnOwnSide = role === "Aditi" ? landedIndex < 6 : landedIndex >= 6;
		if (landedOnOwnSide && state.board[landedIndex] === 1) {
			const oppositeIndex = 11 - landedIndex;
			if (state.board[oppositeIndex] > 0) {
				state.stores[role] += state.board[oppositeIndex] + 1;
				state.board[oppositeIndex] = 0;
				state.board[landedIndex] = 0;
			}
		}
	}

	const aditiRemaining = state.board.slice(0, 6).reduce((sum, value) => sum + value, 0);
	const shreyakRemaining = state.board.slice(6).reduce((sum, value) => sum + value, 0);
	if (aditiRemaining === 0 || shreyakRemaining === 0) {
		state.stores.Aditi += aditiRemaining;
		state.stores.Shreyak += shreyakRemaining;
		state.board.fill(0);
		state.status = state.stores.Aditi === state.stores.Shreyak ? "draw" : "won";
		state.winner = state.status === "draw" ? "" : (state.stores.Aditi > state.stores.Shreyak ? "Aditi" : "Shreyak");
		state.turn = "";
		return true;
	}
	if (ringPosition !== ownStore) state.turn = role === "Aditi" ? "Shreyak" : "Aditi";
	return true;
}

export class PeerRoomEngine {
	constructor({ broadcast, sendTo, layouts = {} }) {
		this.broadcast = broadcast;
		this.sendTo = sendTo;
		this.layouts = layouts;
		this.connectFour = null;
		this.mancala = null;
	}

	handle(role, message) {
		if (!message || typeof message.type !== "string") return;
		if (message.type === "state") {
			this.sendTo(role === "Aditi" ? "Shreyak" : "Aditi", { type: "state", role, state: message.state });
		} else if (message.type === "layout") {
			const sceneId = String(message.sceneId || "").slice(0, 60);
			if (!sceneId || !message.layout || JSON.stringify(message.layout).length > 250000) return;
			this.layouts[sceneId] = message.layout;
			this.sendTo(role === "Aditi" ? "Shreyak" : "Aditi", { type: "layout", sceneId, layout: message.layout });
		} else if (message.type === "chat") {
			const text = String(message.text || "").trim().slice(0, 120);
			const sceneId = String(message.sceneId || "").slice(0, 60);
			if (text && sceneId) this.sendTo(role === "Aditi" ? "Shreyak" : "Aditi", { type: "chat", role, sceneId, text });
		} else if (message.type === "inventory-gift") {
			const to = message.to === "Aditi" ? "Aditi" : message.to === "Shreyak" ? "Shreyak" : "";
			const name = String(message.name || "").trim().slice(0, 80);
			if (to && to !== role && name) this.sendTo(to, { type: "inventory-gift", from: role, to, name });
		} else if (message.type.startsWith("connect4-")) {
			this._handleConnectFour(role, message);
		} else if (message.type.startsWith("mancala-")) {
			this._handleMancala(role, message);
		}
	}

	remove(role) {
		this._removeConnectFour(role);
		this._removeMancala(role);
	}

	_removeConnectFour(role) {
		if (this.connectFour?.players.has(role)) {
			const remaining = [...this.connectFour.players].filter((entry) => entry !== role);
			this.connectFour = remaining.length ? createConnectFour(remaining[0]) : null;
			if (this.connectFour) this.connectFour.revision += 1;
			this.broadcast({ type: "connect4-state", state: this.connectFour ? connectFourSnapshot(this.connectFour) : null });
		}
	}

	_removeMancala(role) {
		if (this.mancala?.players.has(role)) {
			const remaining = [...this.mancala.players].filter((entry) => entry !== role);
			this.mancala = remaining.length ? createMancala(remaining[0]) : null;
			if (this.mancala) this.mancala.revision += 1;
			this.broadcast({ type: "mancala-state", state: this.mancala ? mancalaSnapshot(this.mancala) : null });
		}
	}

	_handleConnectFour(role, message) {
		if (message.type === "connect4-join") {
			this.connectFour ||= createConnectFour(role);
			this.connectFour.players.add(role);
			if (this.connectFour.players.size === 2 && this.connectFour.status === "waiting") {
				this.connectFour.status = "playing";
				this.connectFour.turn = this.connectFour.firstRole;
			}
			this.connectFour.revision += 1;
		} else if (message.type === "connect4-move") {
			const state = this.connectFour;
			const column = Number(message.column);
			if (!state || state.status !== "playing" || state.turn !== role || !Number.isInteger(column) || column < 0 || column > 6) return;
			let row = 0;
			while (row < 6 && state.board[`${column}:${row}`]) row += 1;
			if (row >= 6) return;
			state.board[`${column}:${row}`] = role;
			state.lastMove = { role, column, row };
			if (connectFourWon(state.board, role, column, row)) {
				state.status = "won";
				state.winner = role;
				state.turn = "";
			} else if (Object.keys(state.board).length === 42) {
				state.status = "draw";
				state.turn = "";
			} else {
				state.turn = role === "Aditi" ? "Shreyak" : "Aditi";
			}
			state.revision += 1;
		} else if (message.type === "connect4-restart") {
			const previous = this.connectFour;
			if (!previous || previous.players.size !== 2 || !["won", "draw"].includes(previous.status)) return;
			const roles = [...previous.players];
			const nextStarter = roles.find((entry) => entry !== previous.firstRole) || roles[0];
			this.connectFour = createConnectFour(nextStarter);
			this.connectFour.players = new Set(roles);
			this.connectFour.status = "playing";
			this.connectFour.turn = nextStarter;
			this.connectFour.revision = previous.revision + 1;
		} else if (message.type === "connect4-leave") {
			this._removeConnectFour(role);
			return;
		} else {
			return;
		}
		this.broadcast({ type: "connect4-state", state: connectFourSnapshot(this.connectFour) });
	}

	_handleMancala(role, message) {
		if (message.type === "mancala-join") {
			this.mancala ||= createMancala(role);
			this.mancala.players.add(role);
			if (this.mancala.players.size === 2 && this.mancala.status === "waiting") {
				this.mancala.status = "playing";
				this.mancala.turn = this.mancala.firstRole;
			}
			this.mancala.revision += 1;
		} else if (message.type === "mancala-move") {
			const state = this.mancala;
			const pit = Number(message.pit);
			if (!state || state.status !== "playing" || state.turn !== role || !Number.isInteger(pit) || pit < 0 || pit > 5) return;
			if (!playMancalaMove(state, role, pit)) return;
			state.revision += 1;
		} else if (message.type === "mancala-restart") {
			const previous = this.mancala;
			if (!previous || previous.players.size !== 2 || !["won", "draw"].includes(previous.status)) return;
			const roles = [...previous.players];
			const nextStarter = roles.find((entry) => entry !== previous.firstRole) || roles[0];
			this.mancala = createMancala(nextStarter);
			this.mancala.players = new Set(roles);
			this.mancala.status = "playing";
			this.mancala.turn = nextStarter;
			this.mancala.revision = previous.revision + 1;
		} else if (message.type === "mancala-leave") {
			this._removeMancala(role);
			return;
		} else {
			return;
		}
		this.broadcast({ type: "mancala-state", state: mancalaSnapshot(this.mancala) });
	}
}
