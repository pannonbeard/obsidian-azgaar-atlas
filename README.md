# Azgaar Atlas for Obsidian

Version 0.5.0 — explore fantasy maps with relief artwork, draw custom regions, connect locations to notes, and publish maps through Quartz 5.

Updating from an older version: close Obsidian, replace the plugin's `main.js`, `manifest.json`, and `styles.css`, then reopen Obsidian. Existing maps, pins, and links continue to work. The land and lake masks required to display water are restored when an existing map is opened.

To add relief artwork to an existing import: open its map note and run **Azgaar Atlas: Restore relief artwork from Azgaar .map**. Confirm the existing `.atlas.json` path, then select the original Azgaar `.map` file. This adds the stored tree/mountain data while preserving existing pins, regions, and note links. Sync the updated atlas data to Quartz and rebuild after updating the companion extension.

## Install

1. Close Obsidian.
2. Copy the `azgaar-atlas` folder from this ZIP into your vault's `.obsidian/plugins/` folder.
3. Confirm that `manifest.json`, `main.js`, and `styles.css` are directly inside `.obsidian/plugins/azgaar-atlas/`.
4. Open Obsidian. In **Settings → Community plugins**, allow community plugins and enable **Azgaar Atlas**.
5. Open the command palette and run **Azgaar Atlas: Import Azgaar map or SVG**.
6. Select a saved Azgaar `.map` or exported `.svg`. The plugin creates a note in `Maps/`. Open that note in **Reading view**.

No npm installation is needed to use the packaged plugin. This is a manual installation, not a published Obsidian community plugin.

## Use

- Scroll to zoom and drag to pan. The +, −, and Fit map controls also work.
- Search for a settlement or custom pin, then select a result to focus the map.
- Select a settlement pin and click **Create note**, **Open note**, or **Link existing note**.
- New location notes are created beneath the map's `Locations/` folder. Existing notes can be linked from anywhere in the vault.
- Click **Add pin**, then click the map and enter a name. Select a custom pin to link, unlink, or delete it.
- Purple pins have note links; gold pins are settlements; teal pins are custom locations.
- The map uses its exported layer visibility, with no layer checkboxes to configure. **Expand** opens a larger viewer.
- Plugin settlement pins are hidden by default. **Show settlement pins** turns them on or off, and that choice is saved per map. Custom pins remain visible. Settlement search and note actions remain available when settlement pins are hidden.
- Artwork already drawn in the exported SVG follows the export's visibility; the settlement checkbox controls only the pins added by this plugin.

## Terrain performance

Click **Terrain detail** to choose the minimum zoom for each terrain type. **Fit map** is 1×; set 0 to always show a type, or uncheck it to hide it. The default thresholds are 1× for mountains and volcanoes, 2× for hills and dunes, 3× for trees and cacti, and 4× for grass and swamps. The status line shows the current zoom and rendered symbol count.

These settings are saved per map in Obsidian. Sync the changed `.atlas.json` to Quartz and rebuild to publish them. Website visitors can adjust terrain detail for their current view; their changes are temporary.

Only symbols intersecting the visible map area are added to the SVG. A spatial index avoids scanning the whole icon collection for each zoomed viewport; panning and zooming updates are limited to one per animation frame. Original symbol artwork, size, placement, and drawing order are preserved. The source relief layer's saved visibility still applies. These controls apply to relief restored from `.map` data; terrain already baked into a standalone SVG export is preserved as exported.

Updating from 0.4.0 requires no map reimport. Replace the plugin files and all three Quartz companion files, then rebuild Quartz.

## Draw regions

1. Click **Draw region**.
2. Choose **Polygon** and click the boundary corners, or choose **Freehand** and drag an outline on the map.
3. Click **Finish region** to close the boundary, then enter a name and a hex color such as `#58a6c9`.
4. Select the region to create or link a note, change its name or color, redraw its boundary, or delete it.

**Undo point** removes the most recent point. **Cancel drawing** discards the draft. While the map drawing surface is focused, Enter finishes, Escape cancels, and Backspace undoes a point. At least three points are required. Zoom works while drawing; panning works outside drawing mode.

Regions are translucent overlays stored in the atlas data file. They are searchable alongside pins and settlements. They do not change Azgaar's original countries, provinces, biomes, or source file, and they do not export back to Azgaar. Custom pins can be placed inside regions.

The imported map and note links live in a `.atlas.json` file in the vault. They persist across restarts and can travel with the vault. Markdown note renames update stored links. Do not rename or move an atlas data file without updating the path in its embedding block.

Embed the same map in another note with a vault-relative path:

```azgaar-map
Maps/My World.atlas.json
```

## Supported input

- Azgaar's line-delimited `.map` format, including plain, base64-encoded, and gzip-compressed files.
- Settlement positions, names, states, and capital flags are read from the map's saved entity data.
- SVG exports preserve exported geometry and styles; they do not contain the settlement database, so use custom pins with those.
- External fonts and resources are stripped. Embedded PNG/JPEG/WebP images and local SVG symbol references are retained.
- The original file is not modified. Imported notes and pins are separate from Azgaar's world data.

Newer Azgaar versions store relief separately from the SVG. This plugin restores built-in tree, mountain, hill, dune, grass, and swamp artwork using the saved positions, variants, size, set, and active-layer setting. All five built-in sets (simple, colored, gray, illustrated, stickers) are bundled for offline use. Artwork is displayed through shared SVG symbols rather than downloaded from Azgaar at runtime.

Custom Icon Library art outside those relief sets is not bundled. For graphics such as custom emblems that still rely on Azgaar's application renderer, use a self-contained SVG export.

## Publish with Quartz 5

The `quartz5/` folder contains a companion transformer, asset emitter, and generated viewer runtime. See `quartz5/README.md` for the three files to copy into your Quartz repository and the additions to `quartz.ts`.

Quartz renders the same `azgaar-map` blocks as interactive read-only maps. Regions, pins, search, zoom, settlement visibility, and published-note links carry over. Map drawing and note editing stay in Obsidian. Sync changed map data into Quartz content and rebuild to publish your edits.

## Scope and current limits

This is an atlas and note integration, not the full Azgaar world editor. It does not regenerate terrain, change Azgaar's political entities or borders, calculate routes or distances, or sync edits back to the original `.map`. You can draw and edit your own region overlays.

- Reading view is the supported note surface. Live Preview needs testing inside Obsidian.
- Zoom and selected location survive map data edits in an open viewer but reset when the viewer is reopened. The settlement-pin and terrain-detail choices persist in the map data file.
- Pins use the SVG's x/y coordinate system, not geographic latitude and longitude.
- The viewer uses the layers present in the saved SVG; it does not create missing layers.
- Deleted linked notes are not recreated automatically; unlink the pin to create a replacement.
- Touch supports one-finger pan and the zoom buttons. Two-finger pinch is not implemented.
- Leaflet code blocks and PNG import are not included. Website publishing currently targets Quartz 5 through the bundled companion extension.
- Mobile runtime testing remains outstanding.

## Validation

Automated tests cover format handling, corrupt-file errors, filename handling, region and relief validation, concurrent saves, and save recovery. Import parsing also succeeded against the upstream Azgaar repository's real 1.112.1, 1.139.4, and 1.143.1 fixtures (753, 888, and 1,291 settlements).

Version 0.1.1 also passed DOM regression checks for unchanged source-layer visibility, independent settlement-pin visibility, restored saved preferences, and preserved zoom and selection during edits. The optional check is in `test/viewer-dom.mjs` and requires Happy DOM on the development machine.

Version 0.2.0 adds checks for region-data validation, region drawing and actions, old-map compatibility, and water-mask restoration on the user's Boury 1.154.0 file. The missing land mask had allowed a full-size land rectangle to obscure the ocean; Azgaar normally supplies that rule from its application stylesheet.

Version 0.3.0 built successfully with upstream Quartz v5.0.0, including a real Boury map, saved region, linked published note, and linked draft note. The draft link was excluded from exported viewer data. Companion TypeScript checks and public-viewer DOM checks passed. The extension supports site subpaths and Quartz's navigation events; actual browser rendering and deployment to your repository remain to be checked.

Version 0.3.1 fixes the quoted runtime emitted by Quartz's special `.inline.ts` loader in 0.3.0. Regression testing now executes the JavaScript asset emitted by a real Quartz build, rather than only checking the source string and asset presence. The public-viewer source test in 0.3.0 did not catch this packaging error.

Version 0.4.0 resolves and renders all 13,849 relief symbols in Boury, with no missing built-in artwork. DOM checks also cover inactive-layer behavior, duplicate prevention, and variant resolution across all five sets.

Version 0.5.0 passes 12 unit tests and adds zoom-threshold and spatial-index checks against full-scan results, including edge overlaps, large icons, and size scaling. DOM checks cover removing offscreen symbols, restoring them in paint order, and saving terrain preferences. Boury has 13,849 relief symbols; the default fit query selects 236, and a sampled 4× viewport selects 1,583. A minimal upstream Quartz v5.0.0 build preserved the settings in its published JSON, and its emitted inline JavaScript passed the public-viewer DOM checks. The fresh upstream dependency setup had type incompatibilities in third-party plugin sources, so a complete repository TypeScript check was not clean.

This environment did not have Obsidian or an available browser executable. Interactive rendering, plugin lifecycle, installation, and mobile behavior have not yet been validated in the actual app. A browser smoke test is included in `test/viewer.cjs` for a development machine with Playwright.

## Development

Requires Node.js 18+ for the build and Node.js 22+ for all decoding tests.

```sh
npm run build
npm test
```

The build has no package dependencies and generates a single CommonJS `main.js` with only Obsidian as an external runtime dependency.

Source references:

- Azgaar format: https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/services/io/save.ts
- Azgaar loader: https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/src/services/io/load.ts
- Obsidian API: https://github.com/obsidianmd/obsidian-api

## License

MIT for this plugin's code. Imported maps and artwork retain their owners' licenses. Azgaar's application code and Obsidian binaries are not bundled. Bundled relief artwork is from Azgaar's Fantasy Map Generator and uses the MIT license included at `assets/AZGAAR-LICENSE.txt`.
