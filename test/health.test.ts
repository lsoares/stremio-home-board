import { expect, it } from "vitest"
import { howIs, whatIsNew } from "../src/addons"

const rtp = { type: "tv", id: "rtp", name: "RTP Play" }
const podcasts = { type: "series", id: "rtp-podcasts", name: "Podcasts" }

it("says an addon didn't answer when there is nothing from it", () => {
  const how = howIs({ id: "a", version: "1", catalogs: [rtp] }, undefined, [rtp])

  expect(how).toBe("silent")
})

it("says an addon is up to date when it says what Stremio has, with the fields Stremio adds", () => {
  const kept = { id: "a", version: "1", logo: null, addonCatalogs: [], catalogs: [{ ...rtp, extraRequired: [], extraSupported: [] }] }

  const how = howIs(kept, { id: "a", version: "1", catalogs: [rtp] }, [rtp])

  expect(how).toBe("up to date")
})

it("doesn't say an addon is behind for its version, its text or its picture, which change nothing in Stremio", () => {
  const kept = { id: "a", name: "RTP", version: "0.15.1", description: "Old", logo: "old.png", catalogs: [rtp] }

  const how = howIs(kept, { id: "a", name: "RTP Play", version: "0.15.2", description: "New", logo: "new.png", catalogs: [rtp] }, [rtp])

  expect(how).toBe("up to date")
})

it("says an addon is behind when it has a list that is new", () => {
  const how = howIs({ id: "a", catalogs: [rtp] }, { id: "a", catalogs: [rtp, podcasts] }, [rtp])

  expect(how).toBe("outdated")
})

it("says an addon is up to date when the only list it has that Stremio doesn't is one the person hid", () => {
  const how = howIs({ id: "a", catalogs: [rtp] }, { id: "a", catalogs: [rtp, podcasts] }, [rtp, podcasts])

  expect(how).toBe("up to date")
})

it("says an addon is up to date when nothing is known of its lists before, as a hidden list can't be told from a new one", () => {
  const fresh = { id: "a", catalogs: [rtp, podcasts] }

  const how = howIs({ id: "a", catalogs: [rtp] }, fresh, fresh.catalogs)

  expect(how).toBe("up to date")
})

it("says an addon is behind when it answers to something it didn't", () => {
  const how = howIs({ id: "a", resources: ["catalog"], catalogs: [] }, { id: "a", resources: ["catalog", "stream"], catalogs: [] }, [])

  expect(how).toBe("outdated")
})

it("says what is new: the lists that are new", () => {
  const news = whatIsNew({ id: "a", catalogs: [rtp] }, { id: "a", catalogs: [rtp, podcasts] }, [rtp])

  expect(news).toEqual(["new list: Podcasts"])
})

it("says what is new: a list of Stremio's that the addon no longer has", () => {
  const news = whatIsNew({ id: "a", catalogs: [rtp, podcasts] }, { id: "a", catalogs: [rtp] }, [rtp, podcasts])

  expect(news).toEqual(["list no longer there: Podcasts"])
})

it("says what is new: what the addon answers to now, and what it no longer does", () => {
  const news = whatIsNew({ id: "a", resources: ["catalog", "meta"] }, { id: "a", resources: ["catalog", "stream"] }, [])

  expect(news).toEqual(["now also answers to stream", "no longer answers to meta"])
})
