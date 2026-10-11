import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import type { Root, Element } from "hast"
import type { QuartzTransformerPlugin, QuartzEmitterPlugin } from "../types"
import { pathToRoot, simplifySlug, type FullSlug } from "../../util/path"
import runtime from "./azgaarAtlas.runtime"
import Core from "./azgaarAtlasCore"

function walk(node: any, visitor: (node: Element, parent: any, index: number) => void) {
  if (!node.children) return
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    if (child.type === "element") visitor(child, node, i)
    walk(node.children[i], visitor)
  }
}
function text(node: any): string {
  return node.type === "text" ? node.value : (node.children ?? []).map(text).join("")
}
async function sourcePath(directory: string, requested: string): Promise<string> {
  if (!requested.endsWith(".atlas.json") || requested.includes("\\") || requested.includes("\n"))
    throw Error("An azgaar-map block must contain one vault-relative .atlas.json path.")
  const root = await fs.realpath(directory)
  const resolved = await fs.realpath(path.resolve(root, requested))
  if (!resolved.startsWith(root + path.sep)) throw Error("Atlas path escapes the content directory.")
  return resolved
}
function idFor(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 24)
}

export const AzgaarAtlas: QuartzTransformerPlugin = () => ({
  name: "AzgaarAtlas",
  htmlPlugins: (ctx) => [
    () => async (tree: Root, file: any) => {
      const blocks: { code: Element; parent: any; index: number }[] = []
      walk(tree, (node, parent, index) => {
        if (node.tagName !== "pre") return
        const code = node.children.find((child: any) =>
          child.type === "element" && child.tagName === "code" &&
          (child.properties?.className ?? []).includes("language-azgaar-map"),
        ) as Element | undefined
        if (code) blocks.push({ code, parent, index })
      })
      for (const { code, parent, index } of blocks) {
        const requested = text(code).trim()
        await sourcePath(ctx.argv.directory, requested)
        const id = idFor(requested)
        parent.children[index] = {
          type: "element", tagName: "div",
          properties: {
            className: ["azgaar-atlas-public"],
            dataAtlasSource: requested, dataAtlasId: id,
            dataAtlasRoot: pathToRoot(file.data.slug as FullSlug),
            dataAtlasUrl: "_atlas/" + id + ".json",
          },
          children: [{ type: "text", value: "Loading fantasy map…" }],
        }
      }
    },
  ],
  externalResources: () => ({
    js: [{ script: runtime, loadTime: "afterDOMReady", contentType: "inline" }],
    css: [{
      content: ".azgaar-atlas-public{margin:1rem 0;min-height:200px;--text-normal:var(--dark,#222);--background-secondary:var(--lightgray,#ddd);--background-modifier-border:var(--gray,#aaa)}.azgaar-atlas-public:fullscreen{background:var(--light,#fff);padding:1rem;overflow:auto;--atlas-height:80vh}",
      inline: true,
    }],
  }),
})

export const AzgaarAtlasAssets: QuartzEmitterPlugin = () => ({
  name: "AzgaarAtlasAssets",
  async *emit(ctx, content) {
    const sources = new Map<string, string>()
    const published = new Map<string, string>()
    for (const [tree, file] of content) {
      const notePath = path.relative(path.resolve(ctx.argv.directory), path.resolve(String(file.data.filePath))).split(path.sep).join("/")
      if (notePath.endsWith(".md")) published.set(notePath, String(simplifySlug(file.data.slug as FullSlug)))
      walk(tree, (node) => {
        if (node.properties?.dataAtlasSource) {
          const source = String(node.properties.dataAtlasSource)
          sources.set(source, idFor(source))
        }
      })
    }
    for (const [source, id] of sources) {
      const raw = JSON.parse(await fs.readFile(await sourcePath(ctx.argv.directory, source), "utf8"))
      const atlas = Core.validateAtlas(raw)
      // Export only mapped links to notes that survived Quartz's publication filters.
      const links: Record<string, string> = {}
      for (const [key, target] of Object.entries(atlas.links)) {
        const slug = published.get(String(target))
        if (slug !== undefined) links[key] = !slug || slug === "/" ? "." : slug.replace(/^\//, "")
      }
      const safe = {
        schema: 1, title: atlas.title, sourceVersion: atlas.sourceVersion, svg: atlas.svg,
        settlements: atlas.settlements, pins: atlas.pins, regions: atlas.regions,
        viewSettings: atlas.viewSettings, relief: atlas.relief, links,
      }
      const destination = path.join(ctx.argv.output, "_atlas", id + ".json")
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.writeFile(destination, JSON.stringify(safe))
      yield destination as any
    }
  },
})
