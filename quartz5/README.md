# Quartz 5 integration

The Obsidian plugin edits map data; this companion extension renders it in Quartz 5. Your existing `azgaar-map` fenced blocks work in both applications.

The website viewer supports zoom/pan, location and region search, visible saved regions and custom pins, built-in relief symbols, a settlement-pin toggle, full-screen expansion where supported, and links to published notes. Website visitors cannot edit your vault, draw regions, create notes, or save server-side changes.

## Install once

From this package, copy these three files into your Quartz repository's `quartz/plugins/transformers/` folder:

- `azgaarAtlas.ts`
- `azgaarAtlas.runtime.ts`
- `azgaarAtlasCore.ts`

Updating from 0.3.0: replace `azgaarAtlas.ts` and `azgaarAtlasCore.ts`, add `azgaarAtlas.runtime.ts`, and delete the old `azgaarAtlas.inline.ts`. Keep your existing `quartz.ts` registrations, then rebuild. Version 0.3.0 used a filename that triggered Quartz's special inline-script loader and produced a quoted script rather than executable viewer code.

Updating from 0.3.1: replace all three companion files with the latest copies. For previously imported maps, restore relief in Obsidian using the new command, sync the changed atlas data into Quartz content, and rebuild. The runtime contains the symbol artwork, so no separate artwork directory needs to be deployed.

Updating from 0.4.0: replace all three companion files with the 0.5.0 copies and rebuild. Existing relief data needs no reimport. The viewer now renders terrain by zoom threshold and viewport, using the preferences saved in Obsidian. **Terrain detail** also lets website visitors adjust thresholds for their current view without saving changes to your vault.

Add this import to the existing `quartz.ts` at the repository root:

```ts
import { AzgaarAtlas, AzgaarAtlasAssets } from "./quartz/plugins/transformers/azgaarAtlas"
```

Immediately after the existing `const config = await loadQuartzConfig()`, add:

```ts
config.plugins.transformers.unshift(AzgaarAtlas())
config.plugins.emitters.push(AzgaarAtlasAssets())
config.configuration.ignorePatterns.push("**/*.atlas.json", "**/*.map")
```

Keep the file's existing imports, overrides, exports, and layout. The transformer must run before syntax highlighting: use `unshift` as shown.

The ignore rules prevent Quartz's generic asset copier from uploading raw map data and source files. The Atlas emitter reads referenced atlas files itself and exports only the viewer data needed for published map notes. It removes note links whose targets did not survive Quartz publication filters.

If your Quartz asset configuration publishes a different vault directory directly, apply the same ignore rules there. A map's place names, map artwork, pins, and regions are public when you publish the map; remove annotations you do not want shown before building.

## Content layout

Copy the map note, its `.atlas.json` file, and the notes you want to publish into Quartz's content directory, preserving their vault-relative paths. For example:

```text
content/
  Maps/
    Boury Map.md
    Boury.atlas.json
    Locations/
      Example Place.md
```

The map note keeps its normal block:

```azgaar-map
Maps/Boury.atlas.json
```

Linked notes must retain their exact vault-relative paths inside the content directory. The emitter uses Quartz's actual published slugs, including normalized filenames and folder index pages, to create web links.

Run your usual full Quartz build:

```sh
npx quartz build
```

Deploy its entire output directory as usual, including `_atlas/` and generated JavaScript/CSS assets. This works with GitHub Pages repository subpaths: the viewer resolves its map assets and note links relative to the Quartz site root.

After editing your map in Obsidian, sync the changed atlas data to the content directory and run a full build again. Live partial-build updates have not been validated; use a full build for map-data changes.

## Validation

Built with upstream Quartz v5.0.0 using the Boury 1.154.0 map, a saved custom region, a published linked note, and a draft linked note. The map note produced a viewer mount point and a shared JSON asset. The published link was converted to its Quartz slug, and the draft note link was excluded. TypeScript checks passed for the companion files.

DOM checks cover the website viewer's read-only controls, settlement visibility, map-data loading under a GitHub Pages-style subpath, and mounting after Quartz navigation events. Actual browser rendering and deployment to your specific Quartz repository still need verification.
