import { PeerRoomEngine } from "./PeerRoomEngine.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const STUN_SERVERS = [
	{ urls: "stun:stun.l.google.com:19302" },
	{ urls: "stun:stun1.l.google.com:19302" },
];

async function createIceServers() {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), 6000);
	try {
		const response = await fetch("/api/turn", { cache: "no-store", signal: controller.signal });
		if (!response.ok) throw new Error(`TURN credentials returned ${response.status}`);
		const credentials = await response.json();
		if (!Array.isArray(credentials)) throw new Error("TURN credentials were malformed");
		const relayServers = credentials.filter((server) => {
			if (!server || typeof server !== "object") return false;
			const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
			return urls.some((url) => /^turns?:/i.test(String(url || "")));
		});
		if (!relayServers.length) throw new Error("TURN credentials did not include a relay");
		return [...STUN_SERVERS, ...relayServers];
	} catch (error) {
		return STUN_SERVERS;
	} finally {
		window.clearTimeout(timeout);
	}
}

export class MultiplayerClient {
	constructor() {
		this.socket = null;
		this.peer = null;
		this.connection = null;
		this.engine = null;
		this.transport = "";
		this.connected = false;
		this.room = "";
		this.role = "";
		this.peerState = null;
		this.localState = null;
		this.layouts = {};
		this.connectFourState = null;
		this.mancalaState = null;
		this.lastSentAt = 0;
		this.lastSceneId = "";
		this.manualDisconnect = false;
		this.turnAvailable = false;
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
		if (roomCode.length !== 6 || !["Aditi", "Shreyak"].includes(role)) {
			return Promise.reject(new Error("Invalid room or player."));
		}
		this.room = roomCode;
		this.role = role;
		this.manualDisconnect = false;
		this._resetRoomState();

		const forcePeer = new URLSearchParams(location.search).get("transport") === "peer";
		return LOCAL_HOSTS.has(location.hostname) && !forcePeer
			? this._connectWebSocket()
			: this._connectPeer();
	}

	_connectWebSocket() {
		this.transport = "websocket";
		const protocol = location.protocol === "https:" ? "wss:" : "ws:";
		const socket = new WebSocket(`${protocol}//${location.host}/multiplayer`);
		this.socket = socket;

		return new Promise((resolve, reject) => {
			let settled = false;
			const timeout = window.setTimeout(() => {
				if (settled) return;
				settled = true;
				socket.close();
				reject(new Error("Could not reach the multiplayer server."));
			}, 8000);

			socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "join", room: this.room, role: this.role })));
			socket.addEventListener("message", (event) => {
				let message;
				try { message = JSON.parse(event.data); } catch (err) { return; }
				if (message.type === "error" && !settled) {
					settled = true;
					window.clearTimeout(timeout);
					reject(new Error(message.message));
					return;
				}
				if (message.type === "joined" && !settled) {
					settled = true;
					window.clearTimeout(timeout);
					resolve(message);
				}
				this._handleMessage(message);
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
				if (wasConnected && !this.manualDisconnect) this._announce("disconnected");
			});
		});
	}

	async _connectPeer() {
		this.transport = "peer";
		if (typeof window.Peer !== "function") {
			return Promise.reject(new Error("The co-op library did not load. Refresh and try again."));
		}
		const isHost = this.role === "Aditi";
		const hostId = `aditis-world-${this.room.toLowerCase()}`;
		const iceServers = await createIceServers();
		this.turnAvailable = iceServers.some((server) => {
			const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
			return urls.some((url) => /^turns?:/i.test(String(url || "")));
		});
		const peer = new window.Peer(isHost ? hostId : undefined, {
			config: {
				iceServers,
				iceCandidatePoolSize: 6,
				sdpSemantics: "unified-plan",
			},
		});
		this.peer = peer;

		return new Promise((resolve, reject) => {
			let settled = false;
			let retryTimer = 0;
			let signalingRetryTimer = 0;
			const finish = (message) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timeout);
				window.clearTimeout(retryTimer);
				resolve(message);
			};
			const fail = (message) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timeout);
				window.clearTimeout(retryTimer);
				this.disconnect();
				reject(new Error(message));
			};
			const timeout = window.setTimeout(
				() => fail(isHost
					? "Could not create the co-op room."
					: this.turnAvailable
						? "Could not reach the host. Check the room code and try again."
						: "Could not connect across these networks because the TURN relay is not configured."),
				isHost ? 12000 : 20000,
			);
			const connectToHost = () => {
				if (settled || isHost || this.peer !== peer || !peer.open) return;
				const previous = this.connection;
				this.connection = null;
				previous?.close();
				const connection = peer.connect(hostId, {
					reliable: true,
					serialization: "json",
					metadata: { room: this.room, role: this.role },
				});
				this._bindPeerConnection(connection, {
					resolve: finish,
					reject: (message) => {
						if (message === "This room is full." || message === "Invalid room or player.") {
							fail(message);
							return;
						}
						scheduleJoin();
					},
				});
			};
			const scheduleJoin = () => {
				if (settled || isHost || retryTimer) return;
				retryTimer = window.setTimeout(() => {
					retryTimer = 0;
					connectToHost();
				}, 900);
			};
			const reconnectSignaling = () => {
				if (this.manualDisconnect || this.peer !== peer || peer.destroyed || signalingRetryTimer) return;
				signalingRetryTimer = window.setTimeout(() => {
					signalingRetryTimer = 0;
					if (this.manualDisconnect || this.peer !== peer || peer.destroyed || !peer.disconnected) return;
					try {
						peer.reconnect();
					} catch (error) {
						reconnectSignaling();
					}
				}, 1000);
			};

			peer.on("open", () => {
				if (this.peer !== peer) return;
				window.clearTimeout(signalingRetryTimer);
				signalingRetryTimer = 0;
				if (isHost) {
					this.connected = true;
					if (!this.engine) this._createPeerEngine();
					const joined = { type: "joined", room: this.room, role: this.role, layouts: this.layouts, peers: [] };
					this._handleMessage(joined);
					finish(joined);
					return;
				}
				connectToHost();
			});
			peer.on("connection", (connection) => {
				if (!isHost || this.peer !== peer) {
					connection.close();
					return;
				}
				const valid = connection.metadata?.room === this.room && connection.metadata?.role === "Shreyak";
				if (!valid || this.connection?.open) {
					connection.on("open", () => {
						connection.send({ type: "error", message: valid ? "This room is full." : "Invalid room or player." });
						connection.close();
					});
					return;
				}
				this._bindPeerConnection(connection);
			});
			peer.on("error", (error) => {
				if (this.peer !== peer) return;
				if (!isHost && !settled && error.type === "peer-unavailable") {
					scheduleJoin();
					return;
				}
				const message = error.type === "unavailable-id"
					? "That room code is already being hosted."
					: error.type === "peer-unavailable"
						? "That room does not exist yet."
						: "Could not connect to the co-op service.";
				if (!settled || !this.connected) fail(message);
			});
			peer.on("disconnected", () => {
				if (this.manualDisconnect || this.peer !== peer) return;
				reconnectSignaling();
				if (this.connected && !this.connection?.open) this._announce("reconnecting");
			});
			peer.on("close", () => {
				window.clearTimeout(signalingRetryTimer);
				signalingRetryTimer = 0;
				if (!this.manualDisconnect && this.peer === peer) {
					this.connected = false;
					this._announce("disconnected");
				}
			});
		});
	}

	_bindPeerConnection(connection, pending = null) {
		this.connection = connection;
		connection.on("open", () => {
			if (this.connection !== connection) return;
			if (this.role === "Aditi") {
				connection.send({
					type: "joined",
					room: this.room,
					role: "Shreyak",
					layouts: this.layouts,
					peers: [{ role: "Aditi", state: this.localState }],
				});
				this._announce("peer-joined", "Shreyak");
			}
		});
		connection.on("data", (message) => {
			if (!message || typeof message !== "object") return;
			if (this.role === "Aditi") {
				if (message.type === "error") return;
				this.engine?.handle("Shreyak", message);
				return;
			}
			if (message.type === "error") {
				pending?.reject(message.message || "Could not join the room.");
				return;
			}
			if (message.type === "joined") pending?.resolve(message);
			this._handleMessage(message);
		});
		connection.on("close", () => {
			if (this.connection !== connection) return;
			this.connection = null;
			this.peerState = null;
			if (this.role === "Aditi") {
				this.engine?.remove("Shreyak");
				if (!this.manualDisconnect) this._announce("peer-left", "Shreyak");
			} else {
				const wasConnected = this.connected;
				this.connected = false;
				if (wasConnected && !this.manualDisconnect) this._announce("disconnected");
			}
		});
		connection.on("error", () => {
			if (!this.connected) pending?.reject("The peer connection failed.");
		});
	}

	_createPeerEngine() {
		this.engine = new PeerRoomEngine({
			layouts: this.layouts,
			broadcast: (message) => {
				this._handleMessage(message);
				if (this.connection?.open) this.connection.send(message);
			},
			sendTo: (role, message) => {
				if (role === "Aditi") this._handleMessage(message);
				else if (this.connection?.open) this.connection.send(message);
			},
		});
	}

	_handleMessage(message) {
		if (message.type === "joined") {
			this.connected = true;
			this.room = message.room;
			this.role = message.role;
			const peer = message.peers?.find((entry) => entry.state);
			this.peerState = peer ? { ...peer.state, role: peer.role } : null;
			this.layouts = message.layouts || {};
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
	}

	disconnect() {
		this.manualDisconnect = true;
		if (this.socket) this.socket.close();
		if (this.connection) this.connection.close();
		if (this.peer) this.peer.destroy();
		this.socket = null;
		this.connection = null;
		this.peer = null;
		this.engine = null;
		this.transport = "";
		this.turnAvailable = false;
		this.connected = false;
		this.room = "";
		this.role = "";
		this._resetRoomState();
	}

	_resetRoomState() {
		this.peerState = null;
		this.localState = null;
		this.layouts = {};
		this.connectFourState = null;
		this.mancalaState = null;
	}

	getLayout(sceneId) {
		return this.layouts[sceneId] || null;
	}

	sendLayout(sceneId, layout) {
		this.layouts[sceneId] = layout;
		this._send({ type: "layout", sceneId, layout });
	}

	sendChat(sceneId, text) {
		this._send({ type: "chat", sceneId, text });
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
		if (!this.connected) return;
		if (this.transport === "peer") {
			if (this.role === "Aditi") this.engine?.handle("Aditi", message);
			else if (this.connection?.open) this.connection.send(message);
			return;
		}
		if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
	}

	sendState(state) {
		if (!this.connected) return;
		const now = performance.now();
		if (state.sceneId === this.lastSceneId && now - this.lastSentAt < 50) return;
		this.lastSentAt = now;
		this.lastSceneId = state.sceneId;
		this.localState = state;
		this._send({ type: "state", state });
	}

	_announce(status, peer = "") {
		window.dispatchEvent(new CustomEvent("aditi-multiplayer-status", { detail: { status, peer, room: this.room, role: this.role } }));
	}
}

export const multiplayer = new MultiplayerClient();
