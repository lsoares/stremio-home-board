import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { restoredCollection } from "../src/addons"

const installed = (name: string, catalogs: { type: string; id: string }[] = [], version = "1") => ({
  transportUrl: `https://${name}.example/manifest.json`,
  manifest: { id: name, name, version, catalogs },
})
const names = (collection: { manifest: Record<string, unknown> }[]) => collection.map(one => one.manifest.name)

it("has, at the top of the page, buttons to back up and to restore the addons, which say what they do", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toMatch(/<button[^>]*id="backup"[^>]*title="Download a file with your addons[^"]*"/)
  expect(page).toMatch(/<button[^>]*id="restore"[^>]*title="Put your addons back from a file[^"]*"/)
})

it("puts back an addon the backup has and is not installed now, after the one that comes before it in the backup", () => {
  const collection = restoredCollection([installed("a"), installed("c")], [installed("a"), installed("b"), installed("c")])

  expect(names(collection)).toEqual(["a", "b", "c"])
})

it("puts back first the addon that is first in the backup", () => {
  const collection = restoredCollection([installed("a")], [installed("z"), installed("a")])

  expect(names(collection)).toEqual(["z", "a"])
})

it("takes nothing away: the addons installed that the backup doesn't have stay where they are", () => {
  const collection = restoredCollection([installed("x"), installed("a"), installed("y"), installed("b")], [installed("b"), installed("a")])

  expect(names(collection)).toEqual(["x", "b", "y", "a"])
})

it("brings back the lists the addon had, hidden or not and in their order", () => {
  const first = { type: "movie", id: "first" }
  const second = { type: "series", id: "second" }

  const collection = restoredCollection([installed("a", [first, second])], [installed("a", [second])])

  expect(collection[0].manifest.catalogs).toEqual([second])
})

it("keeps what the addon says now, as its version, and takes from the backup only its lists", () => {
  const collection = restoredCollection([installed("a", [], "2")], [installed("a", [], "1")])

  expect(collection[0].manifest.version).toBe("2")
})
