import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist");
const runtimeEntries = ["index.html", "js", "assets", "data"];
const criticalAssets = [
	"assets/characters/player_badger.png",
	"assets/characters/npc_shreyak_v4.png",
	"assets/outsidesax/saxony-transparent.png",
];

async function validateAsset(relativePath) {
	const absolutePath = path.join(ROOT, relativePath);
	const info = await stat(absolutePath);
	if (!info.isFile() || info.size === 0) throw new Error(`Missing deployment asset: ${relativePath}`);

	const header = await readFile(absolutePath, { encoding: "utf8", flag: "r" })
		.then((value) => value.slice(0, 48))
		.catch(() => "");
	if (header.startsWith("version https://git-lfs.github.com/spec/v1")) {
		throw new Error(`Git LFS pointer was not resolved: ${relativePath}`);
	}
}

await Promise.all(criticalAssets.map(validateAsset));
await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });

for (const entry of runtimeEntries) {
	await cp(path.join(ROOT, entry), path.join(OUTPUT, entry), { recursive: true });
}

console.log(`Vercel static build ready: ${runtimeEntries.join(", ")}`);
