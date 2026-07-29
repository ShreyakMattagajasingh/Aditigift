// Constants and helpers shared by every scene.

export const TILE = 32;
export const MOVE_SPEED = 200; // px/sec, matches the Godot build
const CANVAS_MODE_CLASSES = [
	"game-portrait",
	"game-landscape",
	"game-standard",
	"game-widescreen",
	"game-full-landscape",
];

export const OUTFITS = [
	{ key: "badger", label: "Badger Red", tex: "player_badger" },
	{ key: "black_dress", label: "Black Dress", tex: "player_black_dress" },
	{ key: "white_sundress", label: "White Sundress", tex: "player_white_sundress" },
	{ key: "casual", label: "Casual", tex: "player_casual" },
	{ key: "borrowed_hoodie", label: "Shreyak's Hoodie", tex: "player_borrowed_hoodie" },
];

export function rectsOverlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function isTextInputElement(element) {
	return element?.matches?.("input, textarea, select, [contenteditable='true'], [role='textbox']") || false;
}

export function isTextInputActive() {
	return window.__textInputActive === true || isTextInputElement(document.activeElement);
}

export function setCanvasMode(canvas, mode) {
	canvas.classList.remove(...CANVAS_MODE_CLASSES);
	canvas.classList.add(mode);
}
