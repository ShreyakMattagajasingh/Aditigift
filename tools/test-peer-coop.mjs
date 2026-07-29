import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import WebSocket from "ws";

const CHROME_PATHS = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
];
const GAME_URL = process.argv[2] || "http://127.0.0.1:8934/?transport=peer";
const DEBUG_PORT = 9227;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findChrome() {
	const { access } = await import("node:fs/promises");
	for (const candidate of CHROME_PATHS) {
		try {
			await access(candidate);
			return candidate;
		} catch (error) {}
	}
	throw new Error("Google Chrome was not found.");
}

async function waitForDebugger() {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		try {
			const response = await fetch(`${DEBUG_URL}/json/version`);
			if (response.ok) return;
		} catch (error) {}
		await delay(250);
	}
	throw new Error("Chrome debugging did not start.");
}

async function newTab(url) {
	const response = await fetch(`${DEBUG_URL}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
	if (!response.ok) throw new Error(`Could not open test tab (${response.status}).`);
	return response.json();
}

class DevToolsPage {
	constructor(webSocketUrl) {
		this.socket = new WebSocket(webSocketUrl);
		this.nextId = 0;
		this.waiting = new Map();
	}

	async open() {
		await new Promise((resolve, reject) => {
			this.socket.once("open", resolve);
			this.socket.once("error", reject);
		});
		this.socket.on("message", (raw) => {
			const message = JSON.parse(raw);
			if (!message.id || !this.waiting.has(message.id)) return;
			const { resolve, reject } = this.waiting.get(message.id);
			this.waiting.delete(message.id);
			if (message.error) reject(new Error(message.error.message));
			else resolve(message.result);
		});
		await this.call("Runtime.enable");
	}

	call(method, params = {}) {
		const id = ++this.nextId;
		this.socket.send(JSON.stringify({ id, method, params }));
		return new Promise((resolve, reject) => this.waiting.set(id, { resolve, reject }));
	}

	async evaluate(expression) {
		const result = await this.call("Runtime.evaluate", {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
		return result.result.value;
	}

	async waitFor(expression, label, timeout = 30000) {
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			try {
				if (await this.evaluate(expression)) return;
			} catch (error) {}
			await delay(150);
		}
		throw new Error(`Timed out waiting for ${label}.`);
	}

	close() {
		this.socket.close();
	}
}

const profile = await mkdtemp(path.join(os.tmpdir(), "aditi-coop-"));
const chrome = spawn(await findChrome(), [
	"--headless=new",
	"--disable-gpu",
	"--no-first-run",
	"--no-default-browser-check",
	"--autoplay-policy=no-user-gesture-required",
	`--remote-debugging-port=${DEBUG_PORT}`,
	`--user-data-dir=${profile}`,
	"about:blank",
], { stdio: "ignore", windowsHide: true });

let host;
let join;
try {
	await waitForDebugger();
	const [hostTarget, joinTarget] = await Promise.all([newTab(GAME_URL), newTab(GAME_URL)]);
	host = new DevToolsPage(hostTarget.webSocketDebuggerUrl);
	join = new DevToolsPage(joinTarget.webSocketDebuggerUrl);
	await Promise.all([host.open(), join.open()]);
	await Promise.all([
		host.waitFor("document.readyState === 'complete' && !!window.__multiplayer && typeof window.Peer === 'function'", "host page"),
		join.waitFor("document.readyState === 'complete' && !!window.__multiplayer && typeof window.Peer === 'function'", "join page"),
	]);

	await host.evaluate("document.querySelector('#host-online').click(); true");
	await host.waitFor("window.__multiplayer.connected && window.__multiplayer.transport === 'peer'", "host room");
	const room = await host.evaluate("window.__multiplayer.room");
	await join.evaluate(`document.querySelector("#room-code").value = ${JSON.stringify(room)}; document.querySelector("#join-online").click(); true`);
	await Promise.all([
		host.waitFor("window.__multiplayer.connection?.open === true", "host peer connection"),
		join.waitFor("window.__multiplayer.connected && window.__multiplayer.connection?.open === true", "join peer connection"),
	]);
	await host.evaluate("window.__multiplayer.peer.disconnect(); true");
	await host.waitFor(
		"window.__multiplayer.peer?.open && !window.__multiplayer.peer?.disconnected",
		"host signaling reconnect",
	);
	const turn = await host.evaluate(`(async () => {
		const iceServers = window.__multiplayer.peer?.options?.config?.iceServers || [];
		const configured = iceServers.some(server => {
			const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
			return urls.some(url => String(url || "").startsWith("turn:"));
		});
		const connection = new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" });
		const errors = [];
		connection.onicecandidateerror = event => errors.push({
			url: event.url,
			code: event.errorCode,
			text: event.errorText,
		});
		connection.createDataChannel("turn-check");
		const offer = await connection.createOffer();
		const relayPromise = new Promise(resolve => {
			const timer = setTimeout(() => resolve(false), 12000);
			connection.onicecandidate = event => {
				if (event.candidate?.candidate?.includes(" typ relay ")) {
					clearTimeout(timer);
					resolve(true);
				} else if (!event.candidate) {
					clearTimeout(timer);
					resolve(false);
				}
			};
		});
		await connection.setLocalDescription(offer);
		const relay = await relayPromise;
		connection.close();
		return { configured, relay, errors };
	})()`);
	if (turn.configured && !turn.relay) throw new Error(`TURN relay check failed: ${JSON.stringify(turn)}`);

	await Promise.all([
		host.evaluate("window.__aditiGame?.loop?.sleep(); true"),
		join.evaluate("window.__aditiGame?.loop?.sleep(); true"),
	]);
	await join.evaluate("window.__coopChat = ''; window.addEventListener('aditi-multiplayer-chat', event => window.__coopChat = event.detail.text, { once: true }); true");
	await host.evaluate("window.__multiplayer.sendChat('Outside', 'peer-link-ok'); true");
	await join.waitFor("window.__coopChat === 'peer-link-ok'", "chat relay");

	await host.evaluate("window.__multiplayer.sendState({ sceneId: 'Test', x: 321, y: 123, dir: 'right', moving: true, frame: 1, outfit: 'badger' }); true");
	await join.waitFor("window.__multiplayer.peerState?.x === 321", "movement relay");
	await join.evaluate("window.__multiplayer.sendState({ sceneId: 'Test', x: 456, y: 234, dir: 'left', moving: true, frame: 2, outfit: 'shreyak' }); true");
	await host.waitFor("window.__multiplayer.peerState?.x === 456", "reverse movement relay");
	await host.evaluate("window.__multiplayer.sendLayout('test-layout', { positions: { sign: { x: 42, y: 84 } } }); true");
	await join.waitFor("window.__multiplayer.layouts['test-layout']?.positions?.sign?.x === 42", "layout relay");

	await host.evaluate("window.__multiplayer.joinConnectFour(); true");
	await join.evaluate("window.__multiplayer.joinConnectFour(); true");
	await Promise.all([
		host.waitFor("window.__multiplayer.connectFourState?.status === 'playing'", "host Connect Four"),
		join.waitFor("window.__multiplayer.connectFourState?.status === 'playing'", "join Connect Four"),
	]);
	await host.evaluate("window.__multiplayer.moveConnectFour(0); true");
	await join.waitFor("window.__multiplayer.connectFourState?.board?.['0:0'] === 'Aditi'", "Connect Four move");

	await host.evaluate("window.__multiplayer.joinMancala(); true");
	await join.evaluate("window.__multiplayer.joinMancala(); true");
	await Promise.all([
		host.waitFor("window.__multiplayer.mancalaState?.status === 'playing'", "host Mancala"),
		join.waitFor("window.__multiplayer.mancalaState?.status === 'playing'", "join Mancala"),
	]);
	await host.evaluate("window.__multiplayer.moveMancala(0); true");
	await join.waitFor("window.__multiplayer.mancalaState?.lastMove?.role === 'Aditi'", "Mancala move");

	await join.evaluate("window.__coopGift = ''; window.addEventListener('aditi-inventory-gift', event => window.__coopGift = event.detail.name, { once: true }); true");
	await host.evaluate("window.__multiplayer.sendInventoryGift('Shreyak', 'Dunkin coffee'); true");
	await join.waitFor("window.__coopGift === 'Dunkin coffee'", "inventory gift");

	console.log(JSON.stringify({
		room,
		host: await host.evaluate("({ role: window.__multiplayer.role, transport: window.__multiplayer.transport, connected: window.__multiplayer.connected })"),
		join: await join.evaluate("({ role: window.__multiplayer.role, transport: window.__multiplayer.transport, connected: window.__multiplayer.connected })"),
		chat: true,
		movement: true,
		layout: true,
		connectFour: true,
		mancala: true,
		gift: true,
		turn,
	}, null, 2));
} finally {
	host?.close();
	join?.close();
	if (chrome.exitCode === null) {
		const exited = new Promise((resolve) => chrome.once("exit", resolve));
		chrome.kill();
		await Promise.race([exited, delay(3000)]);
	}
	for (let attempt = 0; attempt < 10; attempt += 1) {
		try {
			await rm(profile, { recursive: true, force: true });
			break;
		} catch (error) {
			if (attempt === 9) throw error;
			await delay(300);
		}
	}
}
