import { BootScene } from "./scenes/Boot.js";
import { RoomScene } from "./scenes/Room.js";
import { CorridorScene } from "./scenes/Corridor.js";
import { OutsideScene } from "./scenes/Outside.js";
import { KungFuTeaScene } from "./scenes/KungFuTea.js";
import { ChocolateShoppeScene } from "./scenes/ChocolateShoppe.js";
import { SenchaScene } from "./scenes/Sencha.js";
import { multiplayer } from "./systems/Multiplayer.js";
import { isTextInputElement } from "./shared.js";

window.__textInputActive = false;

function resetGameplayKeys() {
	for (const scene of window.__aditiGame?.scene?.getScenes(true) || []) {
		scene.input?.keyboard?.resetKeys?.();
	}
}

document.addEventListener("focusin", (event) => {
	if (!isTextInputElement(event.target)) return;
	window.__textInputActive = true;
	resetGameplayKeys();
});
document.addEventListener("focusout", () => {
	requestAnimationFrame(() => {
		window.__textInputActive = isTextInputElement(document.activeElement);
		if (!window.__textInputActive) resetGameplayKeys();
	});
});

// Entry point: boots Phaser with the classic-GBA nearest-neighbor pixel
// look (pixelArt:true) at the room's native resolution; Phaser.Scale.FIT
// handles scaling it up to fill the browser window without blurring.
const config = {
	type: Phaser.AUTO,
	parent: "game-wrap",
	pixelArt: true,
	width: 288,
	height: 384,
	backgroundColor: "#111111",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	physics: {
		default: "arcade",
		arcade: { debug: false },
	},
	scene: [BootScene, RoomScene, CorridorScene, OutsideScene, KungFuTeaScene, ChocolateShoppeScene, SenchaScene],
};

const game = new Phaser.Game(config);

window.__aditiGame = game;
window.__multiplayer = multiplayer;
