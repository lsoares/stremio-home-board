type Catalog = { type: string; id: string; name?: string }
type Manifest = { catalogs?: Catalog[] } & Record<string, unknown>

// An addon's manifest as the addon says it now, with what the person did to its lists kept: the ones they hid stay hidden, and so does the order they gave
// the ones they left, while a list that is new is shown, after the one that comes before it in the addon, and one the addon no longer has is gone. Plain
// code with nothing outside it, and no function that has a name, as the page has its source, which the build changes if it has one: it is written into it
export function upgradedManifest(current: Manifest, fresh: Manifest, known: Catalog[]): Manifest {
  const lists = fresh.catalogs || []
  // A list is told by its type, id and name, as an addon can give several of a type the one id
  const keys = lists.map(list => [list.type, list.id, list.name || ""].join("|"))
  const before = known.map(list => [list.type, list.id, list.name || ""].join("|"))
  const picked = (current.catalogs || []).map(list => [list.type, list.id, list.name || ""].join("|")).filter(key => keys.includes(key))
  keys.forEach((key, at) => {
    if (picked.includes(key) || before.includes(key)) return
    let place = 0
    for (let earlier = at - 1; earlier >= 0 && !place; earlier--) place = picked.indexOf(keys[earlier]) + 1
    picked.splice(place, 0, key)
  })
  return { ...fresh, catalogs: picked.map(key => lists[keys.indexOf(key)]) }
}

type Serving = { manifest: { id?: string; idPrefixes?: string[]; resources?: (string | { name: string; idPrefixes?: string[] })[] } }

// The addons with Cinemeta put above the first that has the metadata of titles by IMDb's ids, as Stremio takes a title's page from the first addon that has it. One
// that has them with ids of its own, as Cotonet's, leaves the addons that find streams, which only know IMDb's, nothing to be asked for. Plain code, as the ones above
export function withCinemetaFirst<T extends Serving>(addons: T[]): T[] {
  const rest = addons.slice()
  const cinemeta = rest.findIndex(addon => addon.manifest.id === "com.linvo.cinemeta")
  const first = rest.findIndex(
    addon =>
      addon.manifest.id !== "com.linvo.cinemeta" &&
      (addon.manifest.resources || []).some(
        resource =>
          (typeof resource === "string" ? resource : resource.name) === "meta" &&
          ((typeof resource === "string" ? undefined : resource.idPrefixes) || addon.manifest.idPrefixes || ["tt"]).some(prefix => prefix.startsWith("tt")),
      ),
  )
  if (cinemeta === -1 || first === -1 || first > cinemeta) return rest
  rest.splice(first, 0, ...rest.splice(cinemeta, 1))
  return rest
}

// The types that nothing is left to search for: Stremio searches through the lists of the addons that take a search, so when the ones of an addon that had them are hidden
// (Cinemeta's are its two Popular lists, one for movies and one for series) and no other addon has one of the type, a search finds none of it, though the addon is the first.
// Kept are the lists of all the addons, as another addon may do the search; whole are the lists the addon had. Plain code, as the ones above
export function typesWithoutSearch(kept: Catalog[], whole: Catalog[]): string[] {
  const [then, now] = [whole, kept].map(lists =>
    (lists as { type: string; extra?: { name: string }[]; extraSupported?: string[] }[])
      .filter(list => (list.extra || []).some(extra => extra.name === "search") || (list.extraSupported || []).includes("search"))
      .map(list => list.type),
  )
  return [...new Set(then)].filter(type => !now.includes(type))
}

type Addon = { transportUrl: string; manifest: Manifest }

// The addons put as a backup has them: the ones the backup has and are not installed now come back, after the one before them in the backup; the ones that are
// installed keep what they say now, but their lists, hidden or not and in the order they had, are the ones of the backup, and take the places of each other so the ones
// installed that the backup doesn't have never move; nothing is taken away. Plain code, as the ones above
export function restoredCollection(current: Addon[], backup: Addon[]): Addon[] {
  const wanted = backup.filter(addon => addon && typeof addon.transportUrl === "string" && addon.manifest)
  const there = current.map(addon => addon.transportUrl)
  const order = wanted.map(addon => addon.transportUrl).filter(address => there.includes(address))
  let next = 0
  const result = current.map(addon => {
    if (!order.includes(addon.transportUrl)) return addon
    const address = order[next++]
    const kept = current.find(other => other.transportUrl === address) as Addon
    const asked = wanted.find(other => other.transportUrl === address) as Addon
    return { ...kept, manifest: { ...kept.manifest, catalogs: asked.manifest.catalogs || kept.manifest.catalogs } }
  })
  wanted.forEach((addon, at) => {
    if (there.includes(addon.transportUrl)) return
    let place = 0
    for (let earlier = at - 1; earlier >= 0 && !place; earlier--) place = result.findIndex(other => other.transportUrl === wanted[earlier].transportUrl) + 1
    result.splice(place, 0, JSON.parse(JSON.stringify(addon)))
  })
  return result
}

// The addon put at the end of the ones installed, as Stremio does it, unless one with that address is there already. Plain code, as the ones above
export function installedCollection(current: Addon[], addon: Addon): Addon[] {
  if (current.some(other => other.transportUrl === addon.transportUrl)) return current
  return [...current, JSON.parse(JSON.stringify(addon))]
}

// Whether two manifests say something else, and not only that Stremio keeps one in another form than the addon gives it: with fields it adds (empty lists, nulls),
// the keys in another order, and the lists that ask for something told in extraRequired and extraSupported and not in extra; of what a list asks for the page keeps the
// names and which are required, as the options of a genre are not what is upgraded. Plain code, as the one above
export function manifestsDiffer(current: Manifest, fresh: Manifest): boolean {
  const [told, now] = [current, fresh].map(manifest =>
    JSON.stringify(
      {
        ...manifest,
        catalogs: undefined,
        lists: (manifest.catalogs || []).map(list => {
          const asked: Record<string, string> = {}
          for (const name of (list as { extraSupported?: string[] }).extraSupported || []) asked[name] = "0"
          for (const name of (list as { extraRequired?: string[] }).extraRequired || []) asked[name] = "1"
          for (const extra of (list as { extra?: { name: string; isRequired?: boolean }[] }).extra || []) asked[extra.name] = extra.isRequired ? "1" : "0"
          return [
            list.type,
            list.id,
            list.name || "",
            ...Object.keys(asked)
              .sort()
              .map(name => [name, asked[name]].join("=")),
          ].join("|")
        }),
      },
      (_key, value) => {
        if (value === null || (Array.isArray(value) && !value.length)) return undefined
        if (value && typeof value === "object" && !Array.isArray(value))
          return Object.fromEntries(Object.entries(value).sort(([one], [other]) => (one < other ? -1 : 1)))
        return value
      },
    ),
  )
  return told !== now
}

// What an addon says now that matters to Stremio and Stremio doesn't have: a list that is new since the lists the person last knew (known), a list of Stremio's that the addon
// no longer has, and what it answers to (catalog, meta, stream...). Its version, its text and its picture are not here: nothing changes in Stremio with them, and the person's
// choice of lists, hidden or put in another order, is what this page is for, so it is never a difference. Plain code, as the ones above
export function whatIsNew(current: Manifest, fresh: Manifest, known: Catalog[]): string[] {
  const fromCurrent = current.catalogs || []
  const fromFresh = fresh.catalogs || []
  const [now, then] = [fromCurrent, fromFresh].map(lists => lists.map(list => [list.type, list.id, list.name || ""].join("|")))
  const before = known.map(list => [list.type, list.id, list.name || ""].join("|"))
  const added = fromFresh.filter((_list, at) => !now.includes(then[at]) && !before.includes(then[at])).map(list => list.name || list.id)
  const gone = fromCurrent.filter((_list, at) => !then.includes(now[at])).map(list => list.name || list.id)
  const [was, is] = [current, fresh].map(manifest =>
    ((manifest.resources as (string | { name: string })[] | undefined) || []).map(resource => (typeof resource === "string" ? resource : resource.name)),
  )
  const gained = is.filter(name => !was.includes(name))
  const lost = was.filter(name => !is.includes(name))
  const news = [
    ...(added.length ? [`new ${added.length === 1 ? "list" : "lists"}: ${added.join(", ")}`] : []),
    ...(gone.length ? [`${gone.length === 1 ? "list" : "lists"} no longer there: ${gone.join(", ")}`] : []),
    ...(gained.length ? [`now also answers to ${gained.join(", ")}`] : []),
    ...(lost.length ? [`no longer answers to ${lost.join(", ")}`] : []),
  ]
  const [kept, said] = [current, fresh].map(manifest => ({ resources: manifest.resources, types: manifest.types, idPrefixes: manifest.idPrefixes }))
  if (!gained.length && !lost.length && manifestsDiffer(kept, said)) news.push("answers for other types or ids")
  return news
}

// How an addon is, by what it says now (nothing, when it doesn't answer) and what Stremio has of it: behind only when something that matters to Stremio is new, and nothing
// of what the person chose. Plain code, as the ones above
export function howIs(current: Manifest, fresh: Manifest | undefined, known: Catalog[]): "silent" | "outdated" | "up to date" {
  if (!fresh) return "silent"
  return whatIsNew(current, fresh, known).length ? "outdated" : "up to date"
}
