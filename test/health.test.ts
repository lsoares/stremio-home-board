import { expect, it } from "vitest"
import { howIs } from "../src/addons"

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

it("says an addon is behind when it says another version", () => {
  const how = howIs({ id: "a", version: "0.15.1", catalogs: [rtp] }, { id: "a", version: "0.15.2", catalogs: [rtp] }, [rtp])

  expect(how).toBe("outdated")
})

it("says an addon is behind when it has a list that is new", () => {
  const how = howIs({ id: "a", version: "1", catalogs: [rtp] }, { id: "a", version: "1", catalogs: [rtp, podcasts] }, [rtp])

  expect(how).toBe("outdated")
})

it("says an addon is up to date when the only list it has that Stremio doesn't is one the person hid", () => {
  const how = howIs({ id: "a", version: "1", catalogs: [rtp] }, { id: "a", version: "1", catalogs: [rtp, podcasts] }, [rtp, podcasts])

  expect(how).toBe("up to date")
})
