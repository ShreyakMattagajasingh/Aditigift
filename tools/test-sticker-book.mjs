import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import WebSocket from "ws";

const CHROME_PATHS = [
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
	"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
	path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
];
const GAME_URL = process.argv[2] || "http://127.0.0.1:8934/";
const DEBUG_PORT = 9228;
const DEBUG_URL = `http://127.0.0.1:${DEBUG_PORT}`;
const SCREENSHOT_PATH = path.join(os.tmpdir(), "aditi-sticker-book-test.png");
const ROOM_SCREENSHOT_PATH = path.join(os.tmpdir(), "aditi-sticker-book-room-test.png");
const CLAW_SCREENSHOT_PATH = path.join(os.tmpdir(), "aditi-claw-close-test.png");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function findChrome() {
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

class DevToolsPage {
	constructor(webSocketUrl) {
		this.socket = new WebSocket(webSocketUrl);
		this.nextId = 0;
		this.waiting = new Map();
		this.errors = [];
	}

	async open() {
		await new Promise((resolve, reject) => {
			this.socket.once("open", resolve);
			this.socket.once("error", reject);
		});
		this.socket.on("message", (raw) => {
			const message = JSON.parse(raw);
			if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params.exceptionDetails.text);
			if (!message.id || !this.waiting.has(message.id)) return;
			const { resolve, reject } = this.waiting.get(message.id);
			this.waiting.delete(message.id);
			if (message.error) reject(new Error(message.error.message));
			else resolve(message.result);
		});
		await this.call("Runtime.enable");
		await this.call("Page.enable");
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
		if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
		return result.result.value;
	}

	async waitFor(expression, label, timeout = 20000) {
		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			try {
				if (await this.evaluate(expression)) return;
			} catch (error) {}
			await delay(100);
		}
		const state = await this.evaluate(`({
			ready: document.readyState,
			hasGame: !!window.__aditiGame,
			activeScenes: window.__aditiGame?.scene?.getScenes(true)?.map(scene => scene.scene.key) || [],
			roomExists: !!window.__aditiGame?.scene?.getScene("Room"),
			roomPanel: !!window.__aditiGame?.scene?.getScene("Room")?.stickerBookPanel
		})`).catch((error) => ({ diagnostic: error.message }));
		throw new Error(`Timed out waiting for ${label}. State: ${JSON.stringify(state)}${this.errors.length ? ` Browser errors: ${this.errors.join("; ")}` : ""}`);
	}
}

const profile = await mkdtemp(path.join(os.tmpdir(), "aditi-stickers-"));
const chrome = spawn(await findChrome(), [
	"--headless=new",
	"--disable-gpu",
	"--hide-scrollbars",
	"--no-first-run",
	"--no-default-browser-check",
	"--window-size=900,1000",
	`--remote-debugging-port=${DEBUG_PORT}`,
	`--user-data-dir=${profile}`,
	"about:blank",
], { stdio: "ignore", windowsHide: true });

let page;
try {
	await waitForDebugger();
	const targetResponse = await fetch(`${DEBUG_URL}/json/new?${encodeURIComponent(GAME_URL)}`, { method: "PUT" });
	const target = await targetResponse.json();
	page = new DevToolsPage(target.webSocketDebuggerUrl);
	await page.open();
	await page.waitFor("document.readyState === 'complete' && !!window.__aditiGame", "game boot");

	await page.evaluate(`
		localStorage.setItem("aditi-active-player", "Aditi");
		localStorage.setItem("aditi-inventory-v1", JSON.stringify({
			Aditi: [
				{ name: "Dunkin coffee", count: 2 },
				{ name: "M&M", count: 1 },
				{ name: "Bucky Plush", count: 1 }
			],
			Shreyak: []
		}));
		localStorage.removeItem("aditi-sticker-books-v1");
		location.reload();
		true;
	`);
	await page.waitFor("document.readyState === 'complete' && !!window.__aditiGame?.scene?.getScene('Room')?.stickerBookPanel", "sticker panel");
	await page.evaluate(`
		(() => {
			document.body.classList.add("playing");
			window.dispatchEvent(new Event("resize"));
			const panel = window.__aditiGame.scene.getScene("Room").stickerBookPanel;
			panel.open("Aditi");
			panel._addSticker("Dunkin coffee");
			panel._addSticker("M&M");
			panel._addSticker("Bucky Plush");
			const first = panel.renderedStickers[0];
			panel._dragSticker(first, 76, 183);
			panel._finishDragging(first);
			return true;
		})()
	`);
	await delay(250);
	const screenshot = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
	await writeFile(SCREENSHOT_PATH, Buffer.from(screenshot.data, "base64"));

	const album = await page.evaluate(`
		(() => {
			const scene = window.__aditiGame.scene.getScene("Room");
			const panel = scene.stickerBookPanel;
			const saved = JSON.parse(localStorage.getItem("aditi-sticker-books-v1"));
			const result = {
				open: panel.opened,
				stickers: saved.Aditi.length,
				movedX: saved.Aditi[0].x,
				bookTexture: panel.book.texture.key,
				roomBook: scene.devAssets.some(asset => asset.id === "stickerbook"),
			};
			panel.closeButton.emit("pointerdown");
			result.closedByButton = !panel.opened && !panel.container.visible;
			panel.open("Aditi");
			result.persisted = panel.stickers.length;
			panel.close();
			panel.open("Shreyak");
			result.shreyakTexture = panel.book.texture.key;
			result.shreyakFurnitureTexture = scene.textures.exists("shreyak-book");
			panel.close();
			return result;
		})()
	`);
	await delay(150);
	const roomScreenshot = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
	await writeFile(ROOM_SCREENSHOT_PATH, Buffer.from(roomScreenshot.data, "base64"));

	await page.evaluate(`
		window.__aditiGame.scene.getScene("Room").scene.start("ChocolateShoppe");
		true;
	`);
	await page.waitFor("!!window.__aditiGame?.scene?.getScene('ChocolateShoppe')?.clawMachinePanel", "claw panel");
	const clawVisible = await page.evaluate(`
		(() => {
			const panel = window.__aditiGame.scene.getScene("ChocolateShoppe").clawMachinePanel;
			panel.open("Aditi");
			return panel.opened && panel.container.visible && panel.closeButton.visible;
		})()
	`);
	await delay(150);
	const clawScreenshot = await page.call("Page.captureScreenshot", { format: "png", fromSurface: true });
	await writeFile(CLAW_SCREENSHOT_PATH, Buffer.from(clawScreenshot.data, "base64"));
	const clawClosed = await page.evaluate(`
		(() => {
			const panel = window.__aditiGame.scene.getScene("ChocolateShoppe").clawMachinePanel;
			panel.closeButton.emit("pointerdown");
			return !panel.opened && !panel.container.visible;
		})()
	`);
	const claw = { visible: clawVisible, closedByButton: clawClosed };

	if (
		!album.open
		|| album.stickers !== 3
		|| album.movedX !== 76
		|| !album.roomBook
		|| !album.closedByButton
		|| album.persisted !== 3
		|| album.shreyakTexture !== "shreyak-book-panel"
		|| !album.shreyakFurnitureTexture
	) {
		throw new Error(`Sticker-book assertion failed: ${JSON.stringify(album)}`);
	}
	if (!claw.visible || !claw.closedByButton) throw new Error(`Claw close assertion failed: ${JSON.stringify(claw)}`);
	if (page.errors.length) throw new Error(`Browser exceptions: ${page.errors.join("; ")}`);

	console.log(JSON.stringify({
		album,
		claw,
		screenshot: SCREENSHOT_PATH,
		roomScreenshot: ROOM_SCREENSHOT_PATH,
		clawScreenshot: CLAW_SCREENSHOT_PATH,
	}));
} finally {
	page?.socket.close();
	chrome.kill();
	await Promise.race([
		new Promise((resolve) => chrome.once("exit", resolve)),
		delay(3000),
	]);
	await rm(profile, { recursive: true, force: true });
}
