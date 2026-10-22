export interface Item {
  id: string
  label: string
  shape: string
  parent?: string
  direction?: string
  styles: string[]
}

export interface Wire {
  id: string
  source: string
  target: string
  label: string
  stroke: string
  arrow: string
}

export interface Note { text: string, owner?: string }
export interface Graph { direction: string, items: Item[], wires: Wire[], notes: Note[] }
export interface Geometry { x: number, y: number, width: number, height: number }
export interface Document {
  code: string
  original: string
  graph: Graph | null
  layout: Record<string, Geometry>
  mode: 'checking' | 'canvas' | 'code' | 'error'
  message: string
  normalized: boolean
  lastValid: string
}

export const sample = `flowchart LR
  %% 接入层负责接收请求，普通注释应完整保留。
  subgraph CLIENT["客户端"]
    Browser(["浏览器"])
    App["移动应用"]
  end
  subgraph PLATFORM["服务平台"]
    Gateway["接入网关"]
    Check{"校验通过？"}
    subgraph CORE["核心服务"]
      Job["任务处理"]
      Cache[("缓存")]
    end
    Retry("重试队列")
  end
  DB[("业务数据库")]
  Browser --> Gateway
  App --> Gateway
  Gateway --> Check
  Check -->|是| Job
  Check -.->|否| Retry
  Retry --> Check
  Job --> DB
  Job -.-> Cache
  Cache --> Job
  Job -->|异步| DB
  Job -->|重入| Job
  CLIENT -->|调用服务组| PLATFORM
`

export function emptyDocument(): Document {
  return { code: sample, original: sample, graph: null, layout: {}, mode: 'checking', message: '正在加载原型引擎', normalized: false, lastValid: '' }
}

const wrappers: Record<string, [string, string]> = {
  square: ['[', ']'],
  rect: ['[', ']'],
  round: ['(', ')'],
  diamond: ['{', '}'],
  circle: ['((', '))'],
  cylinder: ['[(', ')]'],
  stadium: ['([', '])'],
}

const quote = (value: string) => `"${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('\n', '<br/>')}"`

export function writeGraph(graph: Graph): string {
  const lines = [`flowchart ${graph.direction}`]
  const owners = new Set([...graph.items.map(i => i.id), ...graph.wires.map(w => w.id)])
  const notes = (id: string | undefined, pad: string) => {
    for (const note of graph.notes) {
      if (id === undefined ? !note.owner || !owners.has(note.owner) : note.owner === id)
        lines.push(pad + note.text)
    }
  }
  notes(undefined, '  ')
  const descend = (parent?: string, level = 1) => {
    const pad = '  '.repeat(level)
    for (const item of graph.items.filter(i => i.parent === parent)) {
      notes(item.id, pad)
      if (item.shape === 'group') {
        lines.push(`${pad}subgraph ${item.id}[${quote(item.label)}]`)
        if (item.direction)
          lines.push(`${pad}  direction ${item.direction}`)
        descend(item.id, level + 1)
        lines.push(`${pad}end`)
      }
      else {
        const [a, b] = wrappers[item.shape] ?? wrappers.square
        lines.push(`${pad}${item.id}${a}${quote(item.label)}${b}`)
      }
    }
  }
  descend()
  for (const wire of graph.wires) {
    notes(wire.id, '  ')
    const arrows: Record<string, Record<string, string>> = {
      normal: { end: '-->', both: '<-->', none: '---' },
      dotted: { end: '-.->', both: '<-.->', none: '-.-' },
      thick: { end: '==>', both: '<==>', none: '===' },
    }
    const arrow = arrows[wire.stroke]?.[wire.arrow] ?? '-->'
    lines.push(`  ${wire.source} ${arrow}${wire.label ? `|${quote(wire.label)}|` : ''} ${wire.target}`)
  }
  for (const item of graph.items) {
    if (item.styles.length)
      lines.push(`  style ${item.id} ${item.styles.join(',')}`)
  }
  return `${lines.join('\n')}\n`
}

export function descendants(graph: Graph, id: string): Set<string> {
  const found = new Set([id])
  for (const item of graph.items) {
    if (item.parent === id) {
      for (const nested of descendants(graph, item.id))
        found.add(nested)
    }
  }
  return found
}

export function removeItems(graph: Graph, ids: string[], removeContents: boolean): Graph {
  const deleted = new Set(ids.flatMap(id => removeContents ? [...descendants(graph, id)] : [id]))
  const parentOf = (id: string | undefined): string | undefined => {
    if (!id || !deleted.has(id))
      return id
    return parentOf(graph.items.find(i => i.id === id)?.parent)
  }
  return {
    ...graph,
    items: graph.items.filter(i => !deleted.has(i.id)).map(i => ({ ...i, parent: parentOf(i.parent) })),
    wires: graph.wires.filter(w => !deleted.has(w.source) && !deleted.has(w.target)),
  }
}

export function compatibleLayout(graph: Graph, old: Document['layout']): Document['layout'] {
  return Object.fromEntries(graph.items.map((item, index) => [item.id, old[item.id] ?? {
    x: 30 + index % 4 * 190,
    y: 55 + Math.floor(index / 4) * 110,
    width: item.shape === 'group' ? 430 : 154,
    height: item.shape === 'group' ? 280 : 66,
  }]))
}

export function sameMeaning(a: Graph, b: Graph): boolean {
  const value = (g: Graph) => JSON.stringify({
    direction: g.direction,
    items: g.items.map(i => [i.id, i.label, i.shape === 'rect' ? 'square' : i.shape, i.parent ?? '', i.direction ?? '', [...i.styles].sort()]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    wires: g.wires.map(w => [w.source, w.target, w.label, w.stroke, w.arrow]).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
    notes: g.notes.map(n => n.text).sort(),
  })
  return value(a) === value(b)
}
