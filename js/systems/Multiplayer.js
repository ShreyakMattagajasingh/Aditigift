export class MultiplayerClient {
	constructor() {
		this.socket = null;
		this.connected = false;
		this.room = "";
		this.role = "";
		this.peerState = null;
		this.layouts = {};
		this.connectFourState = null;
		this.mancalaState = null;
		this.lastSentAt = 0;
		this.lastSceneId = "";
	}

	static createRoomCode() {
		const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
		let code = "";
		for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
		return code;
	}

	connect({ room, role }) {
		this.disconnect();
		const roomCode = String(room || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
		const protocol = location.protocol === "https:" ? "wss:" : "ws:";
		const socket = new WebSocket(`${protocol}//${location.host}/multiplayer`);
		this.socket = socket;
		this.room = roomCode;
		this.role = role;
		this.peerState = null;
		this.layouts = {};
		this.connectFourState = null;
		this.mancalaState = null;

		return new Promise((resolve, reject) => {
			let settled = false;
			const timeout = window.setTimeout(() => {
				if (settled) return;
				settled = true;
				socket.close();
				reject(new Error("Could not reach the multiplayer server."));
			}, 8000);

			socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "join", room: roomCode, role })));
			socket.addEventListener("message", (event) => {
				let message;
				try { message = JSON.parse(event.data); } catch (err) { return; }
				if (message.type === "error") {
					if (!settled) {
						settled = true;
						window.clearTimeout(timeout);
						reject(new Error(message.message));
					}
					return;
				}
				if (message.type === "joined") {
					this.connected = true;
					this.room = message.room;
					this.role = message.role;
					const peer = message.peers?.find((entry) => entry.state);
					this.peerState = peer ? { ...peer.state, role: peer.role } : null;
					this.layouts = message.layouts || {};
					if (!settled) {
						settled = true;
						window.clearTimeout(timeout);
						resolve(message);
					}
					this._announce("connected");
				} else if (message.type === "state") {
					this.peerState = { ...message.state, role: message.role };
				} else if (message.type === "peer-joined") {
					this._announce("peer-joined", message.role);
				} else if (message.type === "peer-left") {
					this.peerState = null;
					this._announce("peer-left", message.role);
				} else if (message.type === "layout") {
					this.layouts[message.sceneId] = message.layout;
					window.dispatchEvent(new CustomEvent("aditi-multiplayer-layout", { detail: { sceneId: message.sceneId, layout: message.layout } }));
				} else if (message.type === "chat") {
					window.dispatchEvent(new CustomEvent("aditi-multiplayer-chat", { detail: { role: message.role, sceneId: message.sceneId, text: message.text } }));
				} else if (message.type === "inventory-gift") {
					window.dispatchEvent(new CustomEvent("aditi-inventory-gift", { detail: message }));
				} else if (message.type === "connect4-state") {
					this.connectFourState = message.state;
					window.dispatchEvent(new CustomEvent("aditi-connect4-state", { detail: message.state }));
				} else if (message.type === "mancala-state") {
					this.mancalaState = message.state;
					window.dispatchEvent(new CustomEvent("aditi-mancala-state", { detail: message.state }));
				}
			});
			socket.addEventListener("close", () => {
				const wasConnected = this.connected;
				this.connected = false;
				this.peerState = null;
				if (!settled) {
					settled = true;
					window.clearTimeout(timeout);
					reject(new Error("The multiplayer connection closed."));
				}
				if (wasConnected) this._announce("disconnected");
			});
		});
	}

	disconnect() {
		if (this.socket) this.socket.close();
		this.socket = null;
		this.connected = false;
		this.peerState = null;
		this.layouts = {};
		this.connectFourState = null;
		this.mancalaState = null;
		this.room = "";
		this.role = "";
	}

	getLayout(sceneId) {
		return this.layouts[sceneId] || null;
	}

	sendLayout(sceneId, layout) {
		this.layouts[sceneId] = layout;
		if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify({ type: "layout", sceneId, layout }));
	}

	sendChat(sceneId, text) {
		if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify({ type: "chat", sceneId, text }));
	}

	sendInventoryGift(to, name) {
		this._send({ type: "inventory-gift", to, name });
	}

	joinConnectFour() {
		this._send({ type: "connect4-join" });
	}

	moveConnectFour(column) {
		this._send({ type: "connect4-move", column });
	}

	restartConnectFour() {
		this._send({ type: "connect4-restart" });
	}

	leaveConnectFour() {
		this._send({ type: "connect4-leave" });
		this.connectFourState = null;
	}

	joinMancala() {
		this._send({ type: "mancala-join" });
	}

	moveMancala(pit) {
		this._send({ type: "mancala-move", pit });
	}

	restartMancala() {
		this._send({ type: "mancala-restart" });
	}

	leaveMancala() {
		this._send({ type: "mancala-leave" });
		this.mancalaState = null;
	}

	_send(message) {
		if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;
		this.socket.send(JSON.stringify(message));
	}

	sendState(state) {
		if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return;
		const now = performance.now();
		if (state.sceneId === this.lastSceneId && now - this.lastSentAt < 50) return;
		this.lastSentAt = now;
		this.lastSceneId = state.sceneId;
		this.socket.send(JSON.stringify({ type: "state", state }));
	}

	_announce(status, peer = "") {
		window.dispatchEvent(new CustomEvent("aditi-multiplayer-status", { detail: { status, peer, room: this.room, role: this.role } }));
	}
}

export const multiplayer = new MultiplayerClient();
