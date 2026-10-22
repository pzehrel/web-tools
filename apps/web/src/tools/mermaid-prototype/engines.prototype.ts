import type { ElkNode } from 'elkjs/lib/elk-api'
import type { Document, Geometry, Graph, Item, Note, Wire } from './document.prototype'
import ELK from 'elkjs/lib/elk.bundled.js'
import mermaid from 'mermaid'

interface Vertex { id: string, text?: string, type?: string, styles: string[], classes: string[], labelType: string, link?: string }
interface EdgeRecord { start: string, end: string, text: string, type?: string, stroke?: string, classes: string[] }
interface Subgraph { id: string, title: string, nodes: string[], dir?: string, classes: string[] }
interface FlowDb {
  getVertices: () => Map<string, Vertex>
  getEdges: () => EdgeRecord[]
  getSubGraphs: () => Subgraph[]
  getDirection: () => string | undefined
}

mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, flowchart: { htmlLabels: false }, theme: 'base' })
const elk = new ELK()
let queue: Promise<unknown> = Promise.resolve()

// Pin this internal DB adapter for the prototype; it is not a public Mermaid AST contract.
// 此内部 DB 适配仅用于锁定版本的原型，不代表 Mermaid 的公开 AST 契约。
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task)
  queue = next.catch(() => {})
  return next
}

function text(value = ''): string {
  return value.replaceAll(/<br\s*(?:\/\s*)?>/gi, '\n').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
}

export function readCode(code: string): Promise<{ graph: Graph | null, reason: string }> {
  return serialized(async () => {
    const parsed = await mermaid.parse(code)
    if (!parsed || !parsed.diagramType.startsWith('flowchart'))
      return { graph: null, reason: '该图种仅支持代码与 Mermaid 预览' }
    if (/classDef|:::|\bclass\s|click\s|@\{|%%\{|^---|linkStyle|<[^>]+>|`/m.test(code.replaceAll(/<br\s*(?:\/\s*)?>/gi, '')))
      return { graph: null, reason: '含样式类、富文本、元数据或自定义配置；原文保留，画布修改关闭' }
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(code)
    const db = diagram.db as FlowDb
    const groups = db.getSubGraphs()
    const groupIds = new Set(groups.map(g => g.id))
    const items: Item[] = groups.map(g => ({ id: g.id, label: text(g.title), shape: 'group', direction: g.dir, styles: [] }))
    const allowed = new Set(['square', 'rect', 'round', 'diamond', 'circle', 'cylinder', 'stadium'])
    for (const vertex of db.getVertices().values()) {
      if (groupIds.has(vertex.id))
        continue
      if (!allowed.has(vertex.type ?? 'square') || vertex.classes.length || vertex.link || vertex.labelType === 'markdown')
        return { graph: null, reason: '该节点形状或交互超出原型支持集，源码没有被改写' }
      if (vertex.styles.some(s => !/^(?:fill|stroke|color)\s*:/.test(s)))
        return { graph: null, reason: '含原型不支持的样式属性，保留代码并预览' }
      items.push({ id: vertex.id, label: text(vertex.text ?? vertex.id), shape: vertex.type ?? 'square', styles: vertex.styles })
    }
    for (const item of items) {
      const parents = groups.filter(g => g.id !== item.id && g.nodes.includes(item.id))
      item.parent = parents.sort((a, b) => a.nodes.length - b.nodes.length)[0]?.id
    }
    const wires: Wire[] = db.getEdges().map((e, i) => ({
      id: `wire-${i}`,
      source: e.start,
      target: e.end,
      label: text(e.text),
      stroke: e.stroke ?? 'normal',
      arrow: e.type?.startsWith('double_') ? 'both' : e.type === 'arrow_open' ? 'none' : 'end',
    }))
    if (db.getEdges().some(e => !['arrow_point', 'double_arrow_point', 'arrow_open'].includes(e.type ?? '') || e.classes.length || e.stroke === 'invisible'))
      return { graph: null, reason: '该箭头、隐形边或样式类超出原型支持集' }
    const notes: Note[] = []
    const lines = code.split('\n')
    let edgeIndex = 0
    const pending: Note[] = []
    for (const line of lines) {
      const commentStart = line.indexOf('%%')
      const body = (commentStart < 0 ? line : line.slice(0, commentStart)).trim()
      if (body && !/^(?:flowchart|graph|direction|end)\b/.test(body)) {
        const owner = /-->|---|-\.->|==>|<-->/.test(body) ? wires[edgeIndex++]?.id : body.match(/^(?:subgraph\s+)?([\w-]+)/)?.[1]
        for (const note of pending.splice(0))
          note.owner = owner
        if (commentStart >= 0)
          notes.push({ text: line.slice(commentStart), owner })
      }
      else if (commentStart >= 0) {
        const note = { text: line.slice(commentStart) }
        notes.push(note)
        pending.push(note)
      }
    }
    return { graph: { direction: db.getDirection() ?? 'TB', items, wires, notes }, reason: '可通过画布编辑' }
  })
}

export function renderCode(code: string, id: string): Promise<string> {
  return serialized(async () => {
    if (/\bimg\s*:|\bimage\s*:|https?:\/\/|url\s*\(/i.test(code))
      throw new Error('原型不加载代码中的外部资源，请移除远程图片或链接后预览')
    const palette = getComputedStyle(document.documentElement)
    const swatch = document.createElement('canvas')
    swatch.width = swatch.height = 1
    const context = swatch.getContext('2d', { willReadFrequently: true })!
    const color = (token: string) => {
      context.fillStyle = palette.getPropertyValue(token).trim()
      context.fillRect(0, 0, 1, 1)
      return `#${[...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}`
    }
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      flowchart: { htmlLabels: false },
      theme: 'base',
      themeVariables: {
        primaryColor: color('--secondary'),
        primaryTextColor: color('--foreground'),
        primaryBorderColor: color('--primary'),
        lineColor: color('--muted-foreground'),
        clusterBkg: color('--muted'),
        clusterBorder: color('--border'),
        fontFamily: 'system-ui, sans-serif',
      },
    })
    return (await mermaid.render(id, code)).svg
  })
}

export async function arrange(graph: Graph): Promise<{ layout: Document['layout'], elapsed: number }> {
  const start = performance.now()
  const layout: Record<string, Geometry> = {}
  const ancestors = (id: string, parent?: string): string | undefined => {
    const item = graph.items.find(i => i.id === id)
    if (!item)
      return undefined
    return item.parent === parent ? id : item.parent ? ancestors(item.parent, parent) : undefined
  }
  const descend = async (parent?: string) => {
    const children = graph.items.filter(i => i.parent === parent)
    for (const child of children.filter(i => i.shape === 'group'))
      await descend(child.id)
    const direction = graph.items.find(i => i.id === parent)?.direction ?? graph.direction
    const dir: Record<string, string> = { LR: 'RIGHT', RL: 'LEFT', TB: 'DOWN', TD: 'DOWN', BT: 'UP' }
    const tree: ElkNode = {
      id: parent ?? 'root-layout',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': dir[direction] ?? 'DOWN', 'elk.spacing.nodeNode': '38', 'elk.layered.spacing.nodeNodeBetweenLayers': '72', 'elk.padding': '[top=56,left=28,bottom=28,right=28]' },
      children: children.map(i => ({ id: i.id, width: layout[i.id]?.width ?? 154, height: layout[i.id]?.height ?? 66 })),
      edges: graph.wires.flatMap((w, index) => {
        const a = ancestors(w.source, parent)
        const b = ancestors(w.target, parent)
        return a && b && a !== b ? [{ id: `layout-edge-${index}`, sources: [a], targets: [b] }] : []
      }),
    }
    const result = await elk.layout(tree)
    for (const child of result.children ?? [])
      layout[child.id] = { x: child.x ?? 0, y: child.y ?? 0, width: child.width ?? 154, height: child.height ?? 66 }
    if (parent)
      layout[parent] = { x: 0, y: 0, width: result.width ?? 350, height: result.height ?? 220 }
  }
  await descend()
  return { layout, elapsed: performance.now() - start }
}
