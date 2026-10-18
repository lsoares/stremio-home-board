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
