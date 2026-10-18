import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import { manifestsDiffer, restoredCollection, upgradedManifest, withCinemetaFirst } from "./src/addons.ts"

// The page is one file with its style and two pictures: the functions that are tested are written into it from their source, so what is tested is what runs
const functions = [upgradedManifest, manifestsDiffer, restoredCollection, withCinemetaFirst].map(one => `const ${one.name} = ${one.toString()}`).join("\n")
const template = await readFile("site/index.template.html", "utf8")
await mkdir("dist", { recursive: true })
await writeFile("dist/index.html", template.replace("// FUNCTIONS", functions))
for (const file of ["style.css", "logo.png", "favicon.png"]) await cp(`site/${file}`, `dist/${file}`)
