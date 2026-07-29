const AUDIUS_API = "https://api.audius.co/v1";

function cleanTrack(track) {
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

export async function GET(request) {
	const url = new URL(request.url);
	const query = String(url.searchParams.get("q") || "").trim().slice(0, 80);
	const endpoint = query
		? `${AUDIUS_API}/tracks/search?query=${encodeURIComponent(query)}&limit=18`
		: `${AUDIUS_API}/tracks/trending?limit=18`;

	try {
		const response = await fetch(endpoint, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(10000),
		});
		if (!response.ok) throw new Error(`Audius returned ${response.status}`);
		const payload = await response.json();
		const tracks = (Array.isArray(payload.data) ? payload.data : [])
			.map(cleanTrack)
			.filter(Boolean);
		return Response.json(tracks, {
			headers: {
				"Cache-Control": "public, max-age=60",
				"Vercel-CDN-Cache-Control": "public, max-age=60",
			},
		});
	} catch (error) {
		console.error("Audius request failed:", error);
		return Response.json(
			{ error: "Audius is temporarily unavailable." },
			{ status: 502, headers: { "Cache-Control": "no-store" } },
		);
	}
}
