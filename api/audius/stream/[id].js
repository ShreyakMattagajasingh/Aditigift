export function GET(request) {
	const pathname = new URL(request.url).pathname;
	const trackId = decodeURIComponent(pathname.split("/").pop() || "");
	if (!/^[A-Za-z0-9_-]{1,64}$/.test(trackId)) {
		return new Response("Invalid Audius track", {
			status: 400,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: `https://api.audius.co/v1/tracks/${encodeURIComponent(trackId)}/stream`,
			"Cache-Control": "no-store",
		},
	});
}
