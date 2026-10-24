# Addon manager

A page to look after your Stremio addons: put them in the order you want, hide the lists you don't want on the Board, back them up, and uninstall the ones you don't use. It is one static page: no server, no account, nothing is collected.

**Open it:** https://lsoares.github.io/stremio-home-board/

## What it does

- **Order.** Drag an addon by its icon or name, or use the arrows. The order of the addons is the order of their rows on the Board, and of the streams.
- **Lists.** Open an addon to tick or untick each of its lists, and to put the ones left in order. An addon with every list unticked stays installed, for its streams or its search, and stays on the page.
- **Cinemeta's place is warned about, not kept.** Put Cinemeta below an addon that has titles of its own with ids of its own (such as Cotonet's) and a ⚠️ says the addons that find streams only know the ids of IMDb, and may find nothing. Nothing stops you.
- **Upgrade all.** Stremio keeps what each addon said when you installed it and doesn't ask again. This asks each addon what it says now and puts it in your account, keeping the lists you hid and the order you gave.
- **Back up and Restore.** Back up downloads a file with your addons as they are. Restore reads it, shows what would change (addons to put back, lists, order), and only does it when you say so. Nothing is uninstalled by a restore.
- **Configure** opens the addon's own page, in another tab.
- Only the addons with lists for the Board are shown, and a line says so; the others are left alone, in the places they had.

`?first=<addon id>` puts that addon second, after Cinemeta (first when there is no Cinemeta); addons use it for a "put me first" button.

## What it knows, and where it goes

Stremio's own page asks you to say yes and sends you back with your session after a `#`, which never reaches a server. The page keeps it in your browser (`localStorage`) until you press Log out, and uses it only to read and write your addon collection at `api.strem.io`. To know every list an addon has, it asks the addon for its manifest at its own address (not for the ones on your computer or your network).

The file from Back up has the addresses of your addons, and some have keys or an id of yours in them: keep it to yourself.

Nothing is sent anywhere else, there is no analytics, and no script that isn't in this repository runs.

## How it works

What you do is kept as changes (move this one before that one, uninstall this, show this list), and each save puts them over the collection Stremio has *then*, so what was done elsewhere meanwhile, such as an addon installed, stays; a change to an addon that is no longer there is dropped.

The functions that decide (`src/addons.ts`) are written into the page by `build.mjs` from their own source, so what the tests run is what the page runs.

```sh
npm install
npm run check   # biome, knip, tsc, vitest
npm run build   # dist/, to serve with any static server
```

It is deployed to GitHub Pages by the workflow in `.github/workflows`.

## Licence

MIT.
