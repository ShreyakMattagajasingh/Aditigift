const API_PATH = "/api/layouts";
const DEPLOYED_DEFAULT_PATH = "/data/layouts.json";

export class LayoutStore {
	constructor() {
		this.layouts = {};
		this.available = false;
		this.ready = this._load();
	}

	async _load() {
		for (const path of [API_PATH, DEPLOYED_DEFAULT_PATH]) {
			try {
				const response = await fetch(path, { cache: "no-store" });
				if (!response.ok) continue;
				const layouts = await response.json();
				if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) continue;
				this.layouts = layouts;
				// Only the Node server API can write layouts. Vercel uses the
				// committed JSON as its read-only default.
				this.available = path === API_PATH;
				return;
			} catch (error) {
				// Try the committed production defaults after the server API.
			}
		}
	}

	get(sceneId) {
		return this.layouts[sceneId] || null;
	}

	async save(sceneId, layout) {
		await this.ready;
		if (!this.available) return;
		this.layouts[sceneId] = layout;
		try {
			await fetch(`${API_PATH}/${encodeURIComponent(sceneId)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(layout),
			});
		} catch (error) {
			// Keep the local copy; the next dev edit will retry the server save.
		}
	}
}

export const layoutStore = new LayoutStore();
