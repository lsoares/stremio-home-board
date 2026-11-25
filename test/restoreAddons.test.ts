import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { firstChange, installedCollection, movedCollection, restoredCollection } from "../src/addons"

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

it("has a form to send a message to the author, and not his address", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toContain('action="https://api.web3forms.com/submit"')
  expect(page).not.toContain("mailto:")
})

it("opens the form in a dialog from a link under the box, not inside the box", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toMatch(/<\/main>\s*<nav class="foot-links"[^>]*>\s*<button[^>]*class="open-contact"[^>]*>Send feedback<\/button>/)
  expect(page).toMatch(/<dialog id="contact-dialog"[^>]*>[\s\S]*<form[^>]*id="contact"[\s\S]*<\/dialog>/)
  expect(page.slice(0, page.indexOf("</main>"))).not.toContain('id="contact"')
})

it("has scripts that compile, each in its own scope", () => {
  const page = readFileSync("site/index.template.html", "utf8")
  const scripts = [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]

  expect(scripts.length).toBeGreaterThan(1)
  for (const [, attributes, code] of scripts) {
    if (attributes.includes("module")) new Function(`return async () => {${code.replace(/^\s*import .*$/gm, "")}}`)
    else new Function(code)
  }
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

it("has a popup with the titles of a list, each a link to its page in Stremio web", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toContain('<dialog id="peek-dialog"')
  expect(page).toContain("https://web.stremio.com/#/detail/")
})

it("puts an addon found in the directory after the ones installed", () => {
  const collection = installedCollection([installed("a"), installed("b")], installed("c"))

  expect(names(collection)).toEqual(["a", "b", "c"])
})

it("doesn't install again an addon that is installed already", () => {
  const collection = installedCollection([installed("a"), installed("b")], installed("a"))

  expect(names(collection)).toEqual(["a", "b"])
})

it("moves an addon among all of them, the ones with no lists included, when it is told to", () => {
  const collection = [installed("a", [{ type: "movie", id: "x" }]), installed("search"), installed("b", [{ type: "movie", id: "y" }])]

  const result = movedCollection(collection, { address: collection[2].transportUrl, before: collection[1].transportUrl }, () => true)

  expect(names(result)).toEqual(["a", "b", "search"])
})

it("moves an addon among the ones it is told of only, and the others stay where they were", () => {
  const collection = [installed("a", [{ type: "movie", id: "x" }]), installed("search"), installed("b", [{ type: "movie", id: "y" }])]

  const result = movedCollection(
    collection,
    { address: collection[2].transportUrl, before: collection[0].transportUrl },
    one => one.manifest.catalogs.length > 0,
  )

  expect(names(result)).toEqual(["b", "search", "a"])
})

it("opens on the view the address asks for, with ?view=, and on all the addons when it asks for none", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toContain('new URLSearchParams(location.search).get("view")')
  expect(page).toContain('["catalog", "streams", "all"]')
  expect(page).toContain('|| "all"')
})

const first = (collection: ReturnType<typeof installed>[], shown: ReturnType<typeof installed>[], id: string) => {
  const change = firstChange(collection, shown, id)
  return change ? names(movedCollection(collection, change, () => true)) : "first already"
}

it("puts an addon first below Cinemeta, even when it is above it and Cinemeta is not among the ones shown", () => {
  const collection = [installed("a"), installed("com.linvo.cinemeta"), installed("x"), installed("b")]

  expect(first(collection, [collection[0], collection[2], collection[3]], "a")).toEqual(["com.linvo.cinemeta", "a", "x", "b"])
})

it("puts an addon first below Cinemeta, before the first of the ones shown that is below it", () => {
  const collection = [installed("a"), installed("com.linvo.cinemeta"), installed("x"), installed("b")]

  expect(first(collection, [collection[0], collection[2], collection[3]], "b")).toEqual(["a", "com.linvo.cinemeta", "b", "x"])
})

it("says nothing is to be done when the addon is first below Cinemeta already", () => {
  const collection = [installed("a"), installed("com.linvo.cinemeta"), installed("x")]

  expect(first(collection, [collection[0], collection[2]], "x")).toBe("first already")
})
