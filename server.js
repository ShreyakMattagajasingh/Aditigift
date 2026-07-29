import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { WebSocketServer, WebSocket } from "ws";

const require = createRequire(import.meta.url);
const ConnectFour = require("connect-four");

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8934;
const LAYOUT_FILE = process.env.LAYOUT_FILE
	? path.resolve(ROOT, process.env.LAYOUT_FILE)
	: path.join(ROOT, "data", "layouts.json");
const rooms = new Map();
let persistentLayouts = {};
let layoutWrite = Promise.resolve();
const contentTypes = {
	".css": "text/css; charset=utf-8",
	".aac": "audio/aac",
	".flac": "audio/flac",
	".html": "text/html; charset=utf-8",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".m4a": "audio/mp4",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".png": "image/png",
	".svg": "image/svg+xml",
	".wav": "audio/wav",
	".webp": "image/webp",
};
try {
	const savedLayouts = JSON.parse(await readFile(LAYOUT_FILE, "utf8"));
	if (savedLayouts && typeof savedLayouts === "object" && !Array.isArray(savedLayouts)) persistentLayouts = savedLayouts;
} catch (error) {
	// A new project has no persisted dev layouts yet.
}

function persistLayouts() {
	layoutWrite = layoutWrite
		.catch(() => {})
		.then(() => mkdir(path.dirname(LAYOUT_FILE), { recursive: true }))
		.then(() => writeFile(LAYOUT_FILE, JSON.stringify(persistentLayouts, null, 2), "utf8"));
	return layoutWrite;
}

async function readJsonBody(request) {
	let body = "";
	for await (const chunk of request) {
		body += chunk;
		if (body.length > 250000) throw new Error("Layout is too large");
	}
	return JSON.parse(body || "null");
}

function send(socket, message) {
	if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(room, message, except = null) {
	for (const player of room.values()) {
		if (player.socket !== except) send(player.socket, message);
	}
}

function cleanRoomCode(value) {
	return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function cleanState(value) {
	if (!value || typeof value !== "object") return null;
	return {
		sceneId: String(value.sceneId || "").slice(0, 40),
		x: Number(value.x) || 0,
		y: Number(value.y) || 0,
		dir: ["down", "up", "left", "right"].includes(value.dir) ? value.dir : "down",
		moving: !!value.moving,
		frame: Math.max(0, Math.min(11, Number(value.frame) || 0)),
		outfit: String(value.outfit || "badger").slice(0, 30),
	};
}

function cleanAudiusTrack(track) {
	if (!track || track.is_stream_gated || track.is_unlisted) return null;
	const id = String(track.id || "");
	if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
	return {
		id,
		title: String(track.title || "Untitled track").slice(0, 120),
		artist: String(track.user?.name || "Audius artist").slice(0, 100),
		duration: Math.max(0, Number(track.duration) || 0),
		genre: String(track.genre || "").slice(0, 60),
		artwork: String(track.artwork?.["480x480"] || track.artwork?.["150x150"] || ""),
		streamUrl: `/api/audius/stream/${id}`,
	};
}

function createConnectFour(firstRole = "") {
	return {
		game: new ConnectFour(),
		players: new Set(firstRole ? [firstRole] : []),
		firstRole,
		turn: "",
		status: "waiting",
		lastMove: null,
		revision: 0,
	};
}

function connectFourSnapshot(state) {
	return {
		board: { ...state.game.board },
		players: [...state.players],
		status: state.status,
		turn: state.turn,
		winner: state.game.winner || null,
		lastMove: state.lastMove ? { ...state.lastMove } : null,
		revision: state.revision,
	};
}

function broadcastConnectFour(room) {
	if (room.connectFour) broadcast(room, { type: "connect4-state", state: connectFourSnapshot(room.connectFour) });
}

function removeConnectFourPlayer(room, role) {
	const state = room?.connectFour;
	if (!state?.players.has(role)) return;
	state.players.delete(role);
	if (!state.players.size) {
		delete room.connectFour;
		broadcast(room, { type: "connect4-state", state: null });
		return;
	}
	const remainingRole = [...state.players][0];
	room.connectFour = createConnectFour(remainingRole);
	room.connectFour.revision = state.revision + 1;
	broadcastConnectFour(room);
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

function broadcastMancala(room) {
	if (room.mancala) broadcast(room, { type: "mancala-state", state: mancalaSnapshot(room.mancala) });
}

function removeMancalaPlayer(room, role) {
	const state = room?.mancala;
	if (!state?.players.has(role)) return;
	state.players.delete(role);
	if (!state.players.size) {
		delete room.mancala;
		broadcast(room, { type: "mancala-state", state: null });
		return;
	}
	const remainingRole = [...state.players][0];
	room.mancala = createMancala(remainingRole);
	room.mancala.revision = state.revision + 1;
	broadcastMancala(room);
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

	if (ringPosition !== ownStore) {
		state.turn = [...state.players].find((playerRole) => playerRole !== role) || "";
	}
	return true;
}

const server = http.createServer(async (request, response) => {
	try {
		const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
		let pathname = decodeURIComponent(url.pathname);
		if (pathname === "/api/layouts" && request.method === "GET") {
			response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(persistentLayouts));
			return;
		}
		if (pathname.startsWith("/api/layouts/") && request.method === "PUT") {
			const sceneId = pathname.slice("/api/layouts/".length).slice(0, 60);
			const layout = await readJsonBody(request);
			if (!sceneId || !layout || typeof layout !== "object" || Array.isArray(layout)) {
				response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Invalid layout");
				return;
			}
			persistentLayouts[sceneId] = layout;
			await persistLayouts();
			response.writeHead(204).end();
			return;
		}
		if (pathname === "/api/audius" && request.method === "GET") {
			const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
			const endpoint = query
				? `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}&limit=18`
				: "https://api.audius.co/v1/tracks/trending?limit=18";
			const audiusResponse = await fetch(endpoint, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(10000),
			});
			if (!audiusResponse.ok) {
				response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" })
					.end(JSON.stringify({ error: "Audius is temporarily unavailable." }));
				return;
			}
			const payload = await audiusResponse.json();
			const tracks = (Array.isArray(payload.data) ? payload.data : [])
				.map(cleanAudiusTrack)
				.filter(Boolean);
			response.writeHead(200, {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=60",
			}).end(JSON.stringify(tracks));
			return;
		}
		if (pathname.startsWith("/api/audius/stream/") && request.method === "GET") {
			const trackId = pathname.slice("/api/audius/stream/".length);
			if (!/^[A-Za-z0-9_-]{1,64}$/.test(trackId)) {
				response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Invalid Audius track");
				return;
			}
			response.writeHead(302, {
				Location: `https://api.audius.co/v1/tracks/${encodeURIComponent(trackId)}/stream`,
				"Cache-Control": "no-store",
			}).end();
			return;
		}
		if (pathname === "/favicon.ico") {
			response.writeHead(204).end();
			return;
		}
		if (pathname === "/") pathname = "/index.html";
		const filePath = path.resolve(ROOT, `.${pathname}`);
		if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
			response.writeHead(403).end("Forbidden");
			return;
		}
		const info = await stat(filePath);
		if (!info.isFile()) throw new Error("Not a file");
		const body = await readFile(filePath);
		response.writeHead(200, {
			"Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
			"Cache-Control": "no-cache",
		});
		response.end(body);
	} catch (err) {
		response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
	}
});

const sockets = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
	if (new URL(request.url, "http://localhost").pathname !== "/multiplayer") {
		socket.destroy();
		return;
	}
	sockets.handleUpgrade(request, socket, head, (client) => sockets.emit("connection", client));
});

sockets.on("connection", (socket) => {
	socket.on("message", async (raw) => {
		let message;
		try { message = JSON.parse(raw.toString()); } catch (err) { return; }

		if (message.type === "join" && !socket.roomCode) {
			const roomCode = cleanRoomCode(message.room);
			const role = message.role === "Aditi" ? "Aditi" : message.role === "Shreyak" ? "Shreyak" : "";
			if (!roomCode || !role) return send(socket, { type: "error", message: "Invalid room or player." });
			const room = rooms.get(roomCode) || new Map();
			if (!room.layouts) room.layouts = {};
			if (role === "Shreyak" && !room.has("Aditi")) return send(socket, { type: "error", message: "That room does not exist yet." });
			if (room.has(role)) return send(socket, { type: "error", message: `${role} is already in this room.` });
			if (room.size >= 2) return send(socket, { type: "error", message: "This room is full." });
			const player = { socket, role, state: null };
			room.set(role, player);
			rooms.set(roomCode, room);
			socket.roomCode = roomCode;
			socket.role = role;
			send(socket, {
				type: "joined",
				room: roomCode,
				role,
				layouts: room.layouts,
				peers: [...room.values()].filter((entry) => entry !== player).map((entry) => ({ role: entry.role, state: entry.state })),
			});
			broadcast(room, { type: "peer-joined", role }, socket);
			return;
		}

		if (message.type === "state" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const player = room?.get(socket.role);
			const state = cleanState(message.state);
			if (!player || !state) return;
			player.state = state;
			broadcast(room, { type: "state", role: socket.role, state }, socket);
		}

		if (message.type === "layout" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const sceneId = String(message.sceneId || "").slice(0, 60);
			if (!room || !sceneId || !message.layout || JSON.stringify(message.layout).length > 250000) return;
			room.layouts[sceneId] = message.layout;
			persistentLayouts[sceneId] = message.layout;
			await persistLayouts();
			broadcast(room, { type: "layout", sceneId, layout: message.layout }, socket);
		}

		if (message.type === "chat" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const text = String(message.text || "").trim().slice(0, 120);
			const sceneId = String(message.sceneId || "").slice(0, 60);
			if (!room || !text || !sceneId) return;
			broadcast(room, { type: "chat", role: socket.role, sceneId, text });
		}

		if (message.type === "inventory-gift" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const to = message.to === "Aditi" ? "Aditi" : message.to === "Shreyak" ? "Shreyak" : "";
			const name = String(message.name || "").trim().slice(0, 80);
			const recipient = room?.get(to);
			if (!recipient || !name || to === socket.role) return;
			send(recipient.socket, { type: "inventory-gift", from: socket.role, to, name });
		}

		if (message.type === "connect4-join" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			if (!room) return;
			const state = room.connectFour || createConnectFour(socket.role);
			room.connectFour = state;
			state.players.add(socket.role);
			if (!state.firstRole) state.firstRole = socket.role;
			if (state.players.size === 2 && state.status === "waiting") {
				state.status = "playing";
				state.turn = state.firstRole;
			}
			state.revision += 1;
			broadcastConnectFour(room);
		}

		if (message.type === "connect4-move" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const state = room?.connectFour;
			const column = Number(message.column);
			if (!state || state.status !== "playing" || state.turn !== socket.role || !state.players.has(socket.role)) return;
			if (!Number.isInteger(column) || !state.game.validMove(column)) return;
			let row = 0;
			while (row < 6 && state.game.board[`${column}:${row}`]) row += 1;
			state.game.play(socket.role, column);
			state.lastMove = { role: socket.role, column, row };
			if (state.game.ended) {
				state.status = state.game.winner ? "won" : "draw";
				state.turn = "";
			} else {
				state.turn = [...state.players].find((role) => role !== socket.role) || "";
			}
			state.revision += 1;
			broadcastConnectFour(room);
		}

		if (message.type === "connect4-restart" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const previous = room?.connectFour;
			if (!previous || previous.players.size !== 2 || !["won", "draw"].includes(previous.status)) return;
			const roles = [...previous.players];
			const nextStarter = roles.find((role) => role !== previous.firstRole) || roles[0];
			const next = createConnectFour(nextStarter);
			next.players = new Set(roles);
			next.status = "playing";
			next.turn = nextStarter;
			next.revision = previous.revision + 1;
			room.connectFour = next;
			broadcastConnectFour(room);
		}

		if (message.type === "connect4-leave" && socket.roomCode) {
			removeConnectFourPlayer(rooms.get(socket.roomCode), socket.role);
		}

		if (message.type === "mancala-join" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			if (!room) return;
			const state = room.mancala || createMancala(socket.role);
			room.mancala = state;
			state.players.add(socket.role);
			if (!state.firstRole) state.firstRole = socket.role;
			if (state.players.size === 2 && state.status === "waiting") {
				state.status = "playing";
				state.turn = state.firstRole;
			}
			state.revision += 1;
			broadcastMancala(room);
		}

		if (message.type === "mancala-move" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const state = room?.mancala;
			const pit = Number(message.pit);
			if (!state || state.status !== "playing" || state.turn !== socket.role || !state.players.has(socket.role)) return;
			if (!Number.isInteger(pit) || pit < 0 || pit > 5) return;
			if (!playMancalaMove(state, socket.role, pit)) return;
			state.revision += 1;
			broadcastMancala(room);
		}

		if (message.type === "mancala-restart" && socket.roomCode) {
			const room = rooms.get(socket.roomCode);
			const previous = room?.mancala;
			if (!previous || previous.players.size !== 2 || !["won", "draw"].includes(previous.status)) return;
			const roles = [...previous.players];
			const nextStarter = roles.find((role) => role !== previous.firstRole) || roles[0];
			const next = createMancala(nextStarter);
			next.players = new Set(roles);
			next.status = "playing";
			next.turn = nextStarter;
			next.revision = previous.revision + 1;
			room.mancala = next;
			broadcastMancala(room);
		}

		if (message.type === "mancala-leave" && socket.roomCode) {
			removeMancalaPlayer(rooms.get(socket.roomCode), socket.role);
		}
	});

	socket.on("close", () => {
		const room = rooms.get(socket.roomCode);
		if (!room) return;
		removeConnectFourPlayer(room, socket.role);
		removeMancalaPlayer(room, socket.role);
		room.delete(socket.role);
		broadcast(room, { type: "peer-left", role: socket.role });
		if (!room.size) rooms.delete(socket.roomCode);
	});
});

server.listen(PORT, () => {
	console.log(`A Gift for Aditi is running at http://localhost:${PORT}`);
});
