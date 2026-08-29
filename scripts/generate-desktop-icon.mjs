import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

await mkdir(resolve("build"), { recursive: true });
await sharp(resolve("icon.svg")).resize(512, 512).png().toFile(resolve("build", "icon.png"));
