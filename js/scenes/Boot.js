export class BootScene extends Phaser.Scene {
	constructor() {
		super("Boot");
	}

	preload() {
		// Furniture (already-trimmed art, drawn scaled-to-fit inside each
		// piece's tile footprint — same approach as the Godot version).
		this.load.image("blinds", "assets/bedroom/blinds_cut.png");
		this.load.image("cupboard", "assets/bedroom/cupboard_cut.png");
		this.load.image("pinkbed", "assets/bedroom/pinkbed_cut.png");
		this.load.image("shreyakbed", "assets/shreyakbedroom/shreyakbed_asset.png?v=1");
		this.load.image("shreyakdesk", "assets/shreyakbedroom/desk_asset_v2.png?v=2");
		this.load.image("shelves", "assets/bedroom/shelves_cut.png");
		this.load.image("chair", "assets/bedroom/chair_px.png");
		this.load.image("desk_v", "assets/bedroom/aditi_desk_asset.png?v=2");
		this.load.image("door", "assets/bedroom/door_px.png");
		this.load.image("mirror", "assets/bedroom/mirror_clean.png?v=3");
		this.load.image("photoframe", "assets/bedroom/photoframe_asset.png?v=1");
		this.load.image("aditi-diary-source", "assets/bedroom/aditidiary.png?v=1");
		this.load.image("shreyak-diary-source", "assets/shreyakbedroom/shreyakdiary.png?v=1");
		this.load.image("aditi-book-panel-source", "assets/bedroom/bookopen.png?v=1");
		this.load.image("aditi-book-furniture-source", "assets/bedroom/bookopen.png?v=1");
		this.load.image("shreyak-book-panel-source", "assets/shreyakbedroom/bookopen.png?v=1");
		this.load.image("shreyak-book-furniture-source", "assets/shreyakbedroom/bookopen.png?v=1");
		this.load.image("sax_carpet", "assets/insidesax/carpet_asset.png?v=1");
		this.load.image("sax_door", "assets/insidesax/door_asset.png?v=1");
		this.load.image("sax_elevator", "assets/insidesax/elevator_asset.png?v=1");
		this.load.image("sax_vendingmachine", "assets/insidesax/vedingmachine_clean.png?v=1");
		this.load.image("sax_wall", "assets/insidesax/wall_asset.png?v=1");
		// Exterior buildings used by the Saxony neighborhood map.
		this.load.image("frances-home305", "assets/frances/home305_px.png");
		this.load.image("frances-apt", "assets/frances/apt_px.png");
		this.load.image("frances-fluno", "assets/frances/fluno_px.png");
		this.load.image("frances-hub", "assets/frances/hub_px.png");
		this.load.image("frances-ramp", "assets/frances/ramp_px.png");
		this.load.image("frances-rive", "assets/frances/rive_px.png");
		this.load.image("frances-ians", "assets/frances/ians_px.png");
		this.load.image("frances-wandos", "assets/frances/wandos_px.png");
		this.load.image("frances-james", "assets/frances/james_px.png");
		this.load.image("frances-inka", "assets/frances/inka_px.png");
		this.load.image("frances-cheba", "assets/frances/cheba_px.png");
		this.load.image("frances-madistan", "assets/frances/madistan_px.png");
		this.load.image("frances-walgreens", "assets/frances/walgreens_px.png");
		this.load.image("town-dorm", "assets/town/dorm_px.png");
		this.load.image("town-tree", "assets/town/tree_px.png");
		for (let index = 1; index <= 6; index += 1) {
			this.load.image(`outside-tree-${index}`, `assets/outsidesax/trees/tree${index}.png?v=1`);
		}
		this.load.image("outside-sax-map", "assets/outsidesax/outsidesaxmap.png?v=1");
		this.load.image("outside-saxony-building", "assets/outsidesax/saxony-transparent.png?v=1");
		this.load.image("outside-ians-source", "assets/outsidesax/ians.png?v=2");
		this.load.image("outside-kung-fu-tea", "assets/outsidesax/kungfutea-transparent.png?v=1");
		this.load.image("outside-colectivo-source", "assets/outsidesax/colectivo.png?v=2");
		this.load.image("outside-colectivo-chairs-source", "assets/outsidesax/colectivochairsasset.png?v=1");
		this.load.image("outside-bus-stop-source", "assets/outsidesax/bustop.png?v=1");
		this.load.image("outside-chocolate-shoppe-source", "assets/outsidesax/ChocolateShoppeIceCream.png?v=2");
		this.load.image("outside-sencha-source", "assets/outsidesax/sencha.png?v=1");
		this.load.image("inside-sencha", "assets/insidesencha/outlay.png?v=1");
		this.load.image("inside-sencha-chair-table-source", "assets/insidesencha/chairtable.png?v=3");
		this.load.image("inside-sencha-mancala-table-source", "assets/insidesencha/mancalatable.png?v=1");
		this.load.image("inside-sencha-cupboard-source", "assets/insidesencha/cupboard.png?v=1");
		this.load.image("mancala-board-source", "assets/insidesencha/mancala/board.png?v=1");
		for (let index = 1; index <= 8; index += 1) {
			this.load.image(`mancala-bead-${index}-source`, `assets/insidesencha/mancala/bead${index}.png?v=1`);
		}
		this.load.image("inside-chocolate-shoppe", "assets/insidechocolateshoppe/insidechocolateshoppe.png?v=1");
		this.load.image("inside-chocolate-shoppe-chair-source", "assets/insidechocolateshoppe/chairasset.png?v=1");
		this.load.image("inside-chocolate-shoppe-claw-machine-source", "assets/insidechocolateshoppe/clawmachine.png?v=1");
		this.load.image("claw-game-machine-source", "assets/insidechocolateshoppe/clawmachine/clawMachine2d.png?v=1");
		this.load.image("claw-game-claw-source", "assets/insidechocolateshoppe/clawmachine/claw.png?v=1");
		this.load.image("claw-game-closed-claw-source", "assets/insidechocolateshoppe/clawmachine/closedclaw.png?v=1");
		this.load.image("claw-game-toy-1-source", "assets/insidechocolateshoppe/clawmachine/toys/toy1.png?v=1");
		this.load.image("claw-game-toy-2-source", "assets/insidechocolateshoppe/clawmachine/toys/toy2.png?v=1");
		this.load.image("claw-game-toy-3-source", "assets/insidechocolateshoppe/clawmachine/toys/toy3.png?v=1");
		this.load.image("claw-game-toy-4-source", "assets/insidechocolateshoppe/clawmachine/toys/toy4.png?v=1");
		this.load.image("claw-game-toy-5-source", "assets/insidechocolateshoppe/clawmachine/toys/toy5.png?v=1");
		this.load.image("claw-game-babcock-source", "assets/insidechocolateshoppe/clawmachine/toys/babcockicecream.png?v=1");
		this.load.image("claw-game-bucky-source", "assets/insidechocolateshoppe/clawmachine/toys/bucky.png?v=1");
		this.load.image("claw-game-capitol-source", "assets/insidechocolateshoppe/clawmachine/toys/capitol.png?v=1");
		this.load.image("claw-game-cheese-source", "assets/insidechocolateshoppe/clawmachine/toys/cheese.png?v=1");
		this.load.image("claw-game-cow-source", "assets/insidechocolateshoppe/clawmachine/toys/cow.png?v=1");
		this.load.image("claw-game-cycle-source", "assets/insidechocolateshoppe/clawmachine/toys/cycle.png?v=1");
		this.load.image("claw-game-ducky-source", "assets/insidechocolateshoppe/clawmachine/toys/ducky.png?v=1");
		this.load.image("claw-game-hotdog-source", "assets/insidechocolateshoppe/clawmachine/toys/hotdog.png?v=1");
		this.load.image("claw-game-strawberry-source", "assets/insidechocolateshoppe/clawmachine/toys/strawberry.png?v=1");
		this.load.image("inside-kung-fu-tea", "assets/insidekungfutea/insidekungfutea-transparent.png?v=1");
		this.load.image("kung-fu-tea-connect4", "assets/insidekungfutea/connect4-clean.png?v=1");
		this.load.image("kung-fu-tea-photo-booth-source", "assets/insidekungfutea/photobooth.png?v=2");
		this.load.image("kung-fu-tea-photo-print-source", "assets/insidekungfutea/photoboothimage.png?v=1");
		this.load.image("connect4-board-source", "assets/insidekungfutea/connect4game/connect4_2d.png?v=1");
		this.load.image("connect4-red-source", "assets/insidekungfutea/connect4game/redpeg.png?v=1");
		this.load.image("connect4-yellow-source", "assets/insidekungfutea/connect4game/yellowpeg.png?v=1");

		// Characters: 3 cols (idle/walkA/walkB) x 4 rows (down/up/left/right),
		// 40x48 per cell — identical sheets to the Godot build.
		this.load.spritesheet("player_badger", "assets/characters/player_badger.png", { frameWidth: 40, frameHeight: 48 });
		this.load.spritesheet("player_black_dress", "assets/characters/player_black_dress.png", { frameWidth: 40, frameHeight: 48 });
		this.load.spritesheet("player_white_sundress", "assets/characters/player_white_sundress.png", { frameWidth: 40, frameHeight: 48 });
		this.load.spritesheet("player_casual", "assets/characters/player_casual.png", { frameWidth: 40, frameHeight: 48 });
    this.load.spritesheet("player_borrowed_hoodie", "assets/characters/player_borrowed_hoodie_v3.png?v=3", { frameWidth: 40, frameHeight: 48 });
		this.load.spritesheet("npc_shreyak", "assets/characters/npc_shreyak_v4.png?v=4", { frameWidth: 40, frameHeight: 48 });
	}

	create() {
		this._removeCheckerboard("connect4-board-source", "connect4-board");
		this._removeCheckerboard("connect4-red-source", "connect4-red");
		this._removeCheckerboard("connect4-yellow-source", "connect4-yellow");
		this._removeBorderCheckerboardAndTrim("kung-fu-tea-photo-booth-source", "kung-fu-tea-photo-booth");
		this._removeBorderCheckerboardAndTrim("kung-fu-tea-photo-print-source", "kung-fu-tea-photo-print");
		this._removeBorderCheckerboardAndTrim("outside-colectivo-source", "outside-colectivo");
		this._removeBorderCheckerboardAndTrim("outside-colectivo-chairs-source", "outside-colectivo-chairs");
		this._removeBorderCheckerboardAndTrim("outside-bus-stop-source", "outside-bus-stop");
		this._removeBorderCheckerboardAndTrim("outside-chocolate-shoppe-source", "outside-chocolate-shoppe");
		this._removeSenchaBackdropAndTrim("outside-sencha-source", "outside-sencha");
		this._removeSenchaBackdropAndTrim("outside-ians-source", "outside-ians");
		this._removeWarmBackdropAndTrim("inside-sencha-chair-table-source", "inside-sencha-chair-table");
		this._removeWarmBackdropAndTrim("inside-sencha-mancala-table-source", "inside-sencha-mancala-table");
		this._cropTexture("aditi-diary-source", "aditi-diary-crop", 220, 235, 570, 520);
		this._removeWarmBackdropAndTrim("aditi-diary-crop", "aditi-diary");
		this._cropTexture("shreyak-diary-source", "shreyak-diary-crop", 220, 235, 570, 520);
		this._removeWarmBackdropAndTrim("shreyak-diary-crop", "shreyak-diary");
		this._cropTexture("aditi-book-panel-source", "aditi-book-panel", 250, 190, 1040, 640);
		this._removeWarmBackdropAndTrim("aditi-book-furniture-source", "aditi-book");
		this._cropTexture("shreyak-book-panel-source", "shreyak-book-panel", 250, 190, 1040, 640);
		this._removeWarmBackdropAndTrim("shreyak-book-furniture-source", "shreyak-book");
		this._removeSenchaBackdropAndTrim("inside-sencha-cupboard-source", "inside-sencha-cupboard");
		this._cropTexture("mancala-board-source", "mancala-board-crop", 145, 285, 1250, 430);
		this._removeWarmBackdropAndTrim("mancala-board-crop", "mancala-board");
		for (let index = 1; index <= 8; index += 1) {
			this._cropTexture(`mancala-bead-${index}-source`, `mancala-bead-${index}-crop`, 400, 240, 740, 560);
			this._removeWarmBackdropAndTrim(`mancala-bead-${index}-crop`, `mancala-bead-${index}`);
		}
		this._removeBorderCheckerboardAndTrim("inside-chocolate-shoppe-chair-source", "inside-chocolate-shoppe-chair");
		this._removeSoftGrayBackgroundAndTrim("inside-chocolate-shoppe-claw-machine-source", "inside-chocolate-shoppe-claw-machine");
		this._removeBorderCheckerboardAndTrim("claw-game-machine-source", "claw-game-machine");
		this._removeBorderCheckerboardAndTrim("claw-game-claw-source", "claw-game-claw");
		this._removeBorderCheckerboardAndTrim("claw-game-closed-claw-source", "claw-game-closed-claw");
		this._removeBorderCheckerboardAndTrim("claw-game-toy-1-source", "claw-game-toy-1");
		this._removeBorderCheckerboardAndTrim("claw-game-toy-2-source", "claw-game-toy-2");
		this._removeBorderCheckerboardAndTrim("claw-game-toy-3-source", "claw-game-toy-3");
		this._removeBorderCheckerboardAndTrim("claw-game-toy-4-source", "claw-game-toy-4");
		this._removeBorderCheckerboardAndTrim("claw-game-toy-5-source", "claw-game-toy-5");
		this._removeBorderCheckerboardAndTrim("claw-game-babcock-source", "claw-game-babcock");
		this._removeBorderCheckerboardAndTrim("claw-game-bucky-source", "claw-game-bucky");
		this._removeBorderCheckerboardAndTrim("claw-game-capitol-source", "claw-game-capitol");
		this._removeBorderCheckerboardAndTrim("claw-game-cheese-source", "claw-game-cheese");
		this._removeBorderCheckerboardAndTrim("claw-game-cow-source", "claw-game-cow");
		this._removeBorderCheckerboardAndTrim("claw-game-cycle-source", "claw-game-cycle");
		this._removeBorderCheckerboardAndTrim("claw-game-ducky-source", "claw-game-ducky");
		this._removeBorderCheckerboardAndTrim("claw-game-hotdog-source", "claw-game-hotdog");
		this._removeBorderCheckerboardAndTrim("claw-game-strawberry-source", "claw-game-strawberry");
		window.__photoBoothPrintSrc = this.textures.get("kung-fu-tea-photo-print").getSourceImage().toDataURL("image/png");
		const activePlayer = localStorage.getItem("aditi-active-player") || "Aditi";
		window.__activePlayer = activePlayer;
		this.scene.start("Room", { owner: activePlayer });
	}

	_removeCheckerboard(sourceKey, outputKey) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		for (let i = 0; i < pixels.data.length; i += 4) {
			const red = pixels.data[i];
			const green = pixels.data[i + 1];
			const blue = pixels.data[i + 2];
			if (red > 225 && green > 225 && blue > 225 && Math.max(red, green, blue) - Math.min(red, green, blue) < 18) {
				pixels.data[i + 3] = 0;
			}
		}
		context.putImageData(pixels, 0, 0);
		this.textures.addCanvas(outputKey, canvas);
		this.textures.remove(sourceKey);
	}

	_removeBorderCheckerboardAndTrim(sourceKey, outputKey) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const { data, width, height } = pixels;
		const visited = new Uint8Array(width * height);
		const stack = [];
		const isBackground = (index) => {
			const offset = index * 4;
			const red = data[offset];
			const green = data[offset + 1];
			const blue = data[offset + 2];
			return Math.min(red, green, blue) > 225 && Math.max(red, green, blue) - Math.min(red, green, blue) < 20;
		};
		const queue = (index) => {
			if (index < 0 || index >= visited.length || visited[index] || !isBackground(index)) return;
			visited[index] = 1;
			stack.push(index);
		};
		for (let x = 0; x < width; x += 1) {
			queue(x);
			queue((height - 1) * width + x);
		}
		for (let y = 0; y < height; y += 1) {
			queue(y * width);
			queue(y * width + width - 1);
		}
		while (stack.length) {
			const index = stack.pop();
			data[index * 4 + 3] = 0;
			const x = index % width;
			if (x > 0) queue(index - 1);
			if (x < width - 1) queue(index + 1);
			if (index >= width) queue(index - width);
			if (index < width * (height - 1)) queue(index + width);
		}
		context.putImageData(pixels, 0, 0);

		let minX = width, minY = height, maxX = -1, maxY = -1;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				if (data[(y * width + x) * 4 + 3] === 0) continue;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		const trimmed = document.createElement("canvas");
		trimmed.width = Math.max(1, maxX - minX + 1);
		trimmed.height = Math.max(1, maxY - minY + 1);
		trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
		this.textures.addCanvas(outputKey, trimmed);
		this.textures.remove(sourceKey);
	}

	_removeSenchaBackdropAndTrim(sourceKey, outputKey) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const { data, width, height } = pixels;
		const visited = new Uint8Array(width * height);
		const stack = [];
		const isBackdrop = (index, from = null) => {
			const offset = index * 4;
			const red = data[offset];
			const green = data[offset + 1];
			const blue = data[offset + 2];
			const brightness = (red + green + blue) / 3;
			const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
			if (saturation > 24 || brightness < 28 || brightness > 145) return false;
			if (from === null) return true;
			const fromOffset = from * 4;
			return Math.max(
				Math.abs(red - data[fromOffset]),
				Math.abs(green - data[fromOffset + 1]),
				Math.abs(blue - data[fromOffset + 2]),
			) <= 30;
		};
		const queue = (index, from = null) => {
			if (index < 0 || index >= visited.length || visited[index] || !isBackdrop(index, from)) return;
			visited[index] = 1;
			stack.push(index);
		};
		for (let x = 0; x < width; x += 1) {
			queue(x);
			queue((height - 1) * width + x);
		}
		for (let y = 0; y < height; y += 1) {
			queue(y * width);
			queue(y * width + width - 1);
		}
		while (stack.length) {
			const index = stack.pop();
			data[index * 4 + 3] = 0;
			const x = index % width;
			if (x > 0) queue(index - 1, index);
			if (x < width - 1) queue(index + 1, index);
			if (index >= width) queue(index - width, index);
			if (index < width * (height - 1)) queue(index + width, index);
		}
		context.putImageData(pixels, 0, 0);

		let minX = width, minY = height, maxX = -1, maxY = -1;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				if (data[(y * width + x) * 4 + 3] === 0) continue;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		const trimmed = document.createElement("canvas");
		trimmed.width = Math.max(1, maxX - minX + 1);
		trimmed.height = Math.max(1, maxY - minY + 1);
		trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
		this.textures.addCanvas(outputKey, trimmed);
		this.textures.remove(sourceKey);
	}

	_removeWarmBackdropAndTrim(sourceKey, outputKey) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const { data, width, height } = pixels;
		const visited = new Uint8Array(width * height);
		const stack = [];
		const isBackdrop = (index, from = null) => {
			const offset = index * 4;
			const red = data[offset];
			const green = data[offset + 1];
			const blue = data[offset + 2];
			const brightness = (red + green + blue) / 3;
			const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
			if (spread > 62 || brightness < 38 || brightness > 225) return false;
			if (from === null) return true;
			const fromOffset = from * 4;
			return Math.max(
				Math.abs(red - data[fromOffset]),
				Math.abs(green - data[fromOffset + 1]),
				Math.abs(blue - data[fromOffset + 2]),
			) <= 36;
		};
		const queue = (index, from = null) => {
			if (index < 0 || index >= visited.length || visited[index] || !isBackdrop(index, from)) return;
			visited[index] = 1;
			stack.push(index);
		};
		for (let x = 0; x < width; x += 1) { queue(x); queue((height - 1) * width + x); }
		for (let y = 0; y < height; y += 1) { queue(y * width); queue(y * width + width - 1); }
		while (stack.length) {
			const index = stack.pop();
			data[index * 4 + 3] = 0;
			const x = index % width;
			if (x > 0) queue(index - 1, index);
			if (x < width - 1) queue(index + 1, index);
			if (index >= width) queue(index - width, index);
			if (index < width * (height - 1)) queue(index + width, index);
		}
		context.putImageData(pixels, 0, 0);

		let minX = width, minY = height, maxX = -1, maxY = -1;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				if (data[(y * width + x) * 4 + 3] === 0) continue;
				minX = Math.min(minX, x); minY = Math.min(minY, y);
				maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
			}
		}
		const trimmed = document.createElement("canvas");
		trimmed.width = Math.max(1, maxX - minX + 1);
		trimmed.height = Math.max(1, maxY - minY + 1);
		trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
		this.textures.addCanvas(outputKey, trimmed);
		this.textures.remove(sourceKey);
	}

	_cropTexture(sourceKey, outputKey, x, y, width, height) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const cropX = Phaser.Math.Clamp(x, 0, Math.max(0, source.width - 1));
		const cropY = Phaser.Math.Clamp(y, 0, Math.max(0, source.height - 1));
		const cropWidth = Phaser.Math.Clamp(width, 1, source.width - cropX);
		const cropHeight = Phaser.Math.Clamp(height, 1, source.height - cropY);
		const canvas = document.createElement("canvas");
		canvas.width = cropWidth;
		canvas.height = cropHeight;
		canvas.getContext("2d").drawImage(
			source,
			cropX,
			cropY,
			cropWidth,
			cropHeight,
			0,
			0,
			cropWidth,
			cropHeight,
		);
		this.textures.addCanvas(outputKey, canvas);
		this.textures.remove(sourceKey);
	}

	_removeSoftGrayBackgroundAndTrim(sourceKey, outputKey) {
		const source = this.textures.get(sourceKey).getSourceImage();
		const canvas = document.createElement("canvas");
		canvas.width = source.width;
		canvas.height = source.height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		context.drawImage(source, 0, 0);
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
		const { data, width, height } = pixels;
		const visited = new Uint8Array(width * height);
		const stack = [];
		const colorDistance = (first, second) => Math.max(
			Math.abs(data[first * 4] - data[second * 4]),
			Math.abs(data[first * 4 + 1] - data[second * 4 + 1]),
			Math.abs(data[first * 4 + 2] - data[second * 4 + 2]),
		);
		const isMuted = (index) => {
			const offset = index * 4;
			return Math.max(data[offset], data[offset + 1], data[offset + 2]) - Math.min(data[offset], data[offset + 1], data[offset + 2]) < 32;
		};
		const queue = (index, from = null) => {
			if (index < 0 || index >= visited.length || visited[index] || !isMuted(index) || (from !== null && colorDistance(index, from) > 28)) return;
			visited[index] = 1;
			stack.push(index);
		};
		for (let x = 0; x < width; x += 1) {
			queue(x);
			queue((height - 1) * width + x);
		}
		for (let y = 0; y < height; y += 1) {
			queue(y * width);
			queue(y * width + width - 1);
		}
		while (stack.length) {
			const index = stack.pop();
			data[index * 4 + 3] = 0;
			const x = index % width;
			if (x > 0) queue(index - 1, index);
			if (x < width - 1) queue(index + 1, index);
			if (index >= width) queue(index - width, index);
			if (index < width * (height - 1)) queue(index + width, index);
		}
		context.putImageData(pixels, 0, 0);

		let minX = width, minY = height, maxX = -1, maxY = -1;
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				if (data[(y * width + x) * 4 + 3] === 0) continue;
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		}
		const trimmed = document.createElement("canvas");
		trimmed.width = Math.max(1, maxX - minX + 1);
		trimmed.height = Math.max(1, maxY - minY + 1);
		trimmed.getContext("2d").drawImage(canvas, minX, minY, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
		this.textures.addCanvas(outputKey, trimmed);
		this.textures.remove(sourceKey);
	}
}
