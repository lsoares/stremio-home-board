import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { manifestsDiffer, typesWithoutSearch, upgradedManifest, withCinemetaFirst } from "../src/addons"

const rtp = { type: "tv", id: "rtp", name: "RTP Play" }
const podcasts = { type: "series", id: "rtp-podcasts", name: "Podcasts" }
const recents = { type: "series", id: "rtp-recentes", name: "Programas recentes" }

it("has a button at the top of the page to upgrade all the addons, which says why", () => {
  const page = readFileSync("site/index.template.html", "utf8")

  expect(page).toMatch(/<button[^>]*id="upgrade"[^>]*title="Stremio keeps what each addon said when you installed it[^"]*"/)
})

it("takes what the addon says now, as its version and its name", () => {
  const manifest = upgradedManifest(
    { id: "a", name: "RTP", version: "0.9.0", catalogs: [rtp] },
    { id: "a", name: "RTP Play", version: "0.14.0", catalogs: [rtp] },
    [rtp],
  )

  expect(manifest).toMatchObject({ name: "RTP Play", version: "0.14.0" })
})

it("keeps hidden the list that was hidden, and shows the list that is new", () => {
  const manifest = upgradedManifest({ id: "a", catalogs: [rtp] }, { id: "a", catalogs: [rtp, podcasts, recents] }, [rtp, podcasts])

  expect(manifest.catalogs).toEqual([rtp, recents])
})

it("keeps the order the lists were given, and puts a new one after the one before it in the addon", () => {
  const manifest = upgradedManifest({ id: "a", catalogs: [podcasts, rtp] }, { id: "a", catalogs: [rtp, recents, podcasts] }, [rtp, podcasts])

  expect(manifest.catalogs).toEqual([podcasts, rtp, recents])
})

it("drops the list that the addon no longer has", () => {
  const manifest = upgradedManifest({ id: "a", catalogs: [rtp, podcasts] }, { id: "a", catalogs: [rtp] }, [rtp, podcasts])

  expect(manifest.catalogs).toEqual([rtp])
})

it("has the lists the addon has now, when it had none before", () => {
  const manifest = upgradedManifest({ id: "a", catalogs: [] }, { id: "a", catalogs: [rtp] }, [])

  expect(manifest.catalogs).toEqual([rtp])
})

it("takes for the same manifest the one Stremio keeps with fields it adds, nulls, empty lists and the keys in another order", () => {
  const kept = {
    logo: null,
    name: "RTP Play",
    id: "a",
    version: "0.14.0",
    addonCatalogs: [],
    catalogs: [{ type: "tv", id: "rtp", name: "RTP Play", extraRequired: [], extraSupported: [] }],
  }
  const given = { id: "a", name: "RTP Play", version: "0.14.0", catalogs: [{ type: "tv", id: "rtp", name: "RTP Play" }] }

  const differ = manifestsDiffer(kept, given)

  expect(differ).toBe(false)
})

it("takes for the same a list that asks for a search told in extraSupported by Stremio and in extra by the addon", () => {
  const kept = { id: "a", catalogs: [{ type: "movie", id: "all", extraRequired: [], extraSupported: ["search"] }] }
  const given = { id: "a", catalogs: [{ type: "movie", id: "all", extra: [{ name: "search", isRequired: false, options: [] }] }] }

  const differ = manifestsDiffer(kept, given)

  expect(differ).toBe(false)
})

it("finds another manifest when the version is another", () => {
  const differ = manifestsDiffer({ id: "a", version: "0.11.1", catalogs: [] }, { id: "a", version: "0.14.0", catalogs: [] })

  expect(differ).toBe(true)
})

it("finds another manifest when it has a list that is new", () => {
  const differ = manifestsDiffer({ id: "a", catalogs: [rtp] }, { id: "a", catalogs: [rtp, recents] })

  expect(differ).toBe(true)
})

const cinemeta = { manifest: { id: "com.linvo.cinemeta", resources: ["catalog", "meta"], idPrefixes: ["tt"] } }
const cotonet = { manifest: { id: "cotonet", resources: ["catalog", "meta", "stream"], idPrefixes: ["cotonet:", "tt"] } }
const torrentio = { manifest: { id: "torrentio", resources: ["stream"], idPrefixes: ["tt", "kitsu"] } }
const youtube = { manifest: { id: "youtube", resources: [{ name: "meta", idPrefixes: ["yt_"] }] } }

it.each([
  ["above an addon with the titles by IMDb's ids", [torrentio, cotonet, cinemeta], [torrentio, cinemeta, cotonet]],
  ["where it is when none with them is above it", [cinemeta, cotonet, torrentio], [cinemeta, cotonet, torrentio]],
  ["where it is when the one above has metadata for other ids only", [youtube, cinemeta], [youtube, cinemeta]],
  ["where it is when it isn't installed", [cotonet, torrentio], [cotonet, torrentio]],
])("keeps Cinemeta %s", (_, addons, expected) => {
  const kept = withCinemetaFirst(addons)

  expect(kept).toEqual(expected)
})

const popularMovies = { type: "movie", id: "top", name: "Popular", extra: [{ name: "genre" }, { name: "search" }, { name: "skip" }] }
const popularSeries = { type: "series", id: "top", name: "Popular", extra: [{ name: "genre" }, { name: "search" }, { name: "skip" }] }
const tmdbMovies = { type: "movie", id: "tmdb", name: "TMDB", extraSupported: ["search"] }
const featuredMovies = { type: "movie", id: "imdbRating", name: "Featured", extra: [{ name: "genre" }, { name: "skip" }] }

it.each([
  ["nothing, when the lists that take a search are kept", [popularMovies, popularSeries], []],
  ["the type of the list that takes a search and is hidden", [popularSeries], ["movie"]],
  ["both types, when all the lists that take a search are hidden", [featuredMovies], ["movie", "series"]],
  ["nothing, when another addon takes the search of that type", [popularSeries, tmdbMovies], []],
])("tells %s", (_, kept, expected) => {
  const whole = [popularMovies, popularSeries, featuredMovies]

  const types = typesWithoutSearch(kept, whole)

  expect(types).toEqual(expected)
})

it("asks for no search of an addon that never had one", () => {
  const types = typesWithoutSearch([], [featuredMovies])

  expect(types).toEqual([])
})
