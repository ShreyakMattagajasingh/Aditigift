const API_PATH = "/api/layouts";

export class LayoutStore {
	constructor() {
		this.layouts = {};
		this.available = false;
		this.ready = this._load();
	}

	async _load() {
		try {
			const response = await fetch(API_PATH, { cache: "no-store" });
			if (!response.ok) return;
			const layouts = await response.json();
			if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) return;
			this.layouts = layouts;
			this.available = true;
		} catch (error) {
			// Local-only static hosting still uses browser storage as a fallback.
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
