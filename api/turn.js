function cleanAppName(value) {
	const app = String(value || "").trim().toLowerCase();
	return /^[a-z0-9-]{1,80}$/.test(app) ? app : "";
}

export async function GET() {
	const app = cleanAppName(process.env.METERED_TURN_APP);
	const apiKey = String(process.env.METERED_TURN_API_KEY || "").trim();
	if (!app || !apiKey) {
		return Response.json(
			{ error: "TURN relay credentials are not configured." },
			{ status: 503, headers: { "Cache-Control": "no-store" } },
		);
	}

	try {
		const endpoint = `https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
		const response = await fetch(endpoint, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok) throw new Error(`Metered returned ${response.status}`);
		const iceServers = await response.json();
		if (!Array.isArray(iceServers)) throw new Error("Metered returned malformed credentials");
		const hasRelay = iceServers.some((server) => {
			const urls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
			return urls.some((url) => /^turns?:/i.test(String(url || "")));
		});
		if (!hasRelay) throw new Error("Metered did not return a TURN relay");
		return Response.json(iceServers, {
			headers: {
				"Cache-Control": "no-store",
				"Vercel-CDN-Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error("TURN credential request failed:", error);
		return Response.json(
			{ error: "TURN relay credentials are temporarily unavailable." },
			{ status: 502, headers: { "Cache-Control": "no-store" } },
		);
	}
}
