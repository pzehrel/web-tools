import type { Connection, Edge, EdgeProps, Node, NodeChange, NodeProps } from '@xyflow/react'
import type { Document, Graph, Item } from './document.prototype'
import { Background, BaseEdge, Controls, EdgeLabelRenderer, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { ArrowLeft, Braces, ChevronDown, Circle, Code2, Database, Diamond, FolderPlus, Hand, HelpCircle, LayoutGrid, Maximize, Minus, MousePointer2, Plus, Redo2, Settings2, Square, Trash2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { compatibleLayout, descendants, emptyDocument, removeItems, sameMeaning, sample, writeGraph } from './document.prototype'
import { arrange, readCode, renderCode } from './engines.prototype'
import '@xyflow/react/dist/style.css'
import './workflow.prototype.scss'

type ProtoNode = Node<{ item: Item, edit: (id: string, label: string) => void, vertical: boolean }>
interface Pending { title: string, detail: string, accept: string, action: () => void }
interface History { past: Document[], future: Document[], group: string, at: number }
function DiagramNode({ data }: NodeProps<ProtoNode>) {
  const { item, edit, vertical } = data

  const [editing, setEditing] = useState(false)

  return (
    <div className={`diagram-item shape-${item.shape}`}>
      <Handle type="target" position={vertical ? Position.Top : Position.Left} />
      {item.shape === 'diamond' && <svg className="diamond-outline" viewBox="0 0 154 66" preserveAspectRatio="none" aria-hidden="true"><polygon points="77,1 153,33 77,65 1,33" /></svg>}
      {editing
        ? (
            <input
              className="nodrag nowheel"
              aria-label={`编辑 ${item.id} 文字`}
              defaultValue={item.label}
              autoFocus
              onBlur={(e) => {
                setEditing(false)

                edit(item.id, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  e.currentTarget.blur()

                if (e.key === 'Escape')
                  setEditing(false)
              }}
            />
          )
        : (
            <button
              type="button"
              className="node-label"
              onDoubleClick={() => setEditing(true)}
              title="双击编辑文字；也可展开属性 HUD"
            >
              {item.label}
            </button>
          )}
      <Handle type="source" position={vertical ? Position.Bottom : Position.Right} />
    </div>
  )
}

function DiagramEdge(props: EdgeProps) {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty, source, target, data } = props

  const offset = Number(data?.offset ?? 0)

  const loop = source === target

  const distance = Math.max(80, Math.abs(tx - sx) * 0.45)

  const path = loop
    ? `M ${sx} ${sy} C ${sx + 95} ${sy - 130 - offset}, ${tx - 95} ${ty - 130 - offset}, ${tx} ${ty}`
    : `M ${sx} ${sy} C ${sx + distance} ${sy + offset}, ${tx - distance} ${ty + offset}, ${tx} ${ty}`

  const labelX = (sx + tx) / 2

  const labelY = loop ? sy - 98 - offset : (sy + ty) / 2 + offset * 0.65

  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} markerStart={props.markerStart} style={props.style} interactionWidth={22} />
      <EdgeLabelRenderer>{props.label && <span className="edge-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>{props.label}</span>}</EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { prototype: DiagramNode }
const edgeTypes = { prototype: DiagramEdge }
const clone = <T,>(value: T): T => structuredClone(value)

function Editor() {
  const [doc, setDoc] = useState(emptyDocument)

  const currentRef = useRef(doc)

  const historyRef = useRef<History>({ past: [], future: [], group: '', at: 0 })

  const revisionRef = useRef(0)

  const initialRef = useRef(true)

  const draggingRef = useRef<Document | null>(null)

  const [selected, setSelected] = useState<string[]>([])

  const [wireId, setWireId] = useState('')

  const [pending, setPending] = useState<Pending | null>(null)

  const [busy, setBusy] = useState(false)

  const [notice, setNotice] = useState('')

  const [preview, setPreview] = useState({ code: '', svg: '', error: '' })

  const previewCacheRef = useRef(new Map<string, string>())

  const [themeEpoch, setThemeEpoch] = useState(0)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      previewCacheRef.current.clear()
      setThemeEpoch(n => n + 1)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  const [view, setView] = useState<'canvas' | 'preview'>('canvas')

  const [guide, setGuide] = useState('正常往返')

  const [step, setStep] = useState(0)

  const [elapsed, setElapsed] = useState(0)

  const [composition, setComposition] = useState(false)
  const [validationEpoch, setValidationEpoch] = useState(0)

  const compositionIdRef = useRef(0)

  const sequenceRef = useRef(0)
  const injectFailureRef = useRef(false)

  const [panel, setPanel] = useState<'code' | 'properties' | 'guide' | 'file' | null>(null)
  const [tool, setTool] = useState<'select' | 'pan'>('select')
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const flow = useReactFlow<ProtoNode>()

  const enabled = doc.mode === 'canvas' && !busy

  const put = useCallback((next: Document) => {
    currentRef.current = next

    setDoc(next)
  }, [])

  const commit = useCallback((next: Document, label: string, group = '', before?: Document) => {
    const h = historyRef.current

    const now = performance.now()

    if (!group || group !== h.group || (group === 'typing' && now - h.at > 850))
      h.past.push(clone(before ?? currentRef.current))

    h.future = []

    h.group = group

    h.at = now

    revisionRef.current++
    if (next.mode === 'checking')
      setValidationEpoch(v => v + 1)

    put(next)

    setNotice(label)
  }, [put])

  const changeCode = useCallback((code: string) => {
    commit({ ...currentRef.current, code, mode: 'checking', message: '正在校验，画布暂时不可修改' }, '代码修改已进入文档历史', composition ? `ime-${compositionIdRef.current}` : 'typing')
  }, [commit, composition])

  useEffect(() => {
    if (composition)
      return

    const version = revisionRef.current

    const code = doc.code

    const timer = window.setTimeout(async () => {
      try {
        const result = await readCode(code)

        if (version !== revisionRef.current)
          return

        let layout = result.graph ? compatibleLayout(result.graph, currentRef.current.layout) : currentRef.current.layout

        if (result.graph && initialRef.current) {
          const arranged = await arrange(result.graph)

          if (version !== revisionRef.current)
            return

          layout = arranged.layout

          setElapsed(arranged.elapsed)

          initialRef.current = false
        }

        put({ ...currentRef.current, graph: result.graph, layout, mode: result.graph ? 'canvas' : 'code', message: result.reason, lastValid: code })
      }
      catch (error) {
        if (version === revisionRef.current)
          put({ ...currentRef.current, mode: 'error', message: String(error).slice(0, 700) })
      }
    }, 180)

    return () => window.clearTimeout(timer)
  }, [doc.code, composition, validationEpoch, put])

  useEffect(() => {
    if (!doc.lastValid)
      return

    const code = doc.lastValid

    const cached = previewCacheRef.current.get(code)

    if (cached) {
      setPreview({ code, svg: cached, error: '' })

      return
    }

    let live = true

    renderCode(code, `mermaid-prototype-${++sequenceRef.current}`).then((svg) => {
      if (!live || code !== currentRef.current.lastValid)
        return

      previewCacheRef.current.set(code, svg)

      setPreview({ code, svg, error: '' })
    }).catch((error) => {
      if (live && code === currentRef.current.lastValid)
        setPreview(old => ({ ...old, error: String(error) }))
    })

    return () => {
      live = false
    }
  }, [doc.lastValid, themeEpoch])

  const moveHistory = useCallback((redo: boolean) => {
    if (busy)
      return

    const h = historyRef.current

    const from = redo ? h.future : h.past

    const to = redo ? h.past : h.future

    const next = from.pop()

    if (!next)
      return

    to.push(clone(currentRef.current))

    h.group = ''

    revisionRef.current++
    if (next.mode === 'checking')
      setValidationEpoch(v => v + 1)

    put(next)

    setNotice(redo ? '已重做：代码、图和布局一起恢复' : '已撤销：包括错误草稿和当时的布局')
  }, [busy, put])

  const mutate = useCallback((graph: Graph, label: string) => {
    const d = currentRef.current

    if (d.mode !== 'canvas' || busy)
      return

    const apply = async () => {
      const base = currentRef.current

      const version = revisionRef.current

      setBusy(true)

      try {
        const code = writeGraph(graph)

        const parsed = await readCode(code)

        if (version !== revisionRef.current)
          throw new Error('操作期间文档已变化，请重试')

        if (!parsed.graph || !sameMeaning(graph, parsed.graph))
          throw new Error('往返校验不一致，整次画布操作已回滚，源码没有变化')

        if (injectFailureRef.current) {
          injectFailureRef.current = false
          throw new Error('原型注入的转换故障：整次画布操作已回滚，文档和历史未修改')
        }
        commit({ ...base, code, graph: parsed.graph, layout: compatibleLayout(parsed.graph, base.layout), mode: 'canvas', message: '往返校验通过', normalized: true, lastValid: code }, label)
      }
      catch (error) {
        setNotice(String(error))
      }
      finally {
        setBusy(false)
      }
    }

    if (!d.normalized) {
      setPending({ title: '首次画布编辑会统一代码排版', detail: '图的含义和普通注释会保留；空格、换行和声明顺序可能变化。导入原稿独立保留，这次修改可以撤销。', accept: '保留原稿并继续', action: () => {
        void apply()
      } })
    }
    else {
      void apply()
    }
  }, [busy, commit])

  const editLabel = useCallback((id: string, label: string) => {
    const graph = currentRef.current.graph

    if (!graph || graph.items.find(i => i.id === id)?.label === label)
      return

    mutate({ ...graph, items: graph.items.map(i => i.id === id ? { ...i, label } : i) }, '已修改文字，节点身份和已有连线保留')
  }, [mutate])

  const addItem = (shape: string) => {
    const graph = currentRef.current.graph

    if (!graph)
      return

    let index = 1

    while (graph.items.some(i => i.id === `Node${index}`)) index++

    const id = `Node${index}`

    mutate({ ...graph, items: [...graph.items, { id, label: shape === 'group' ? '新分组' : '新节点', shape, styles: [] }] }, `新增 ${id}，已有位置保持不变`)

    setSelected([id])
  }

  const connect = (connection: Connection) => {
    const graph = currentRef.current.graph

    if (!graph)
      return

    mutate({ ...graph, wires: [...graph.wires, { id: `added-${++sequenceRef.current}`, source: connection.source, target: connection.target, label: '', stroke: 'normal', arrow: 'end' }] }, '已创建连线；允许平行边与自连边')
  }

  const remove = (contents = false) => {
    const graph = currentRef.current.graph

    if (!graph)
      return

    if (wireId) {
      mutate({ ...graph, wires: graph.wires.filter(w => w.id !== wireId) }, '已删除选中连线，注释转为文档注释')

      setWireId('')

      return
    }

    const groups = graph.items.filter(i => selected.includes(i.id) && i.shape === 'group')

    const linked = graph.wires.filter(w => groups.some(g => g.id === w.source || g.id === w.target))

    const apply = () => {
      mutate(removeItems(graph, selected, contents), contents ? '已删除分组及全部内容' : '已删除选中对象；分组成员保留')

      setSelected([])
    }

    if (linked.length || contents) {
      setPending({ title: contents ? '删除分组及全部内容？' : '此分组自身有连线', detail: contents ? '成员和关联连线一起删除，普通注释保留，可以撤销。' : `实验方案：解除分组、保留成员，同时删除 ${linked.length} 条以分组为端点的连线。不会猜测重接到哪个成员。此行为仍待你体验后确认。`, accept: contents ? '删除全部内容' : '解除分组并删除端点线', action: apply })
    }
    else {
      apply()
    }
  }

  const regroup = (parent: string) => {
    const graph = currentRef.current.graph

    if (!graph)
      return

    if (selected.some(id => parent && descendants(graph, id).has(parent))) {
      setNotice('不能将对象移入自身或自己的后代分组')

      return
    }

    mutate({ ...graph, items: graph.items.map(i => selected.includes(i.id) ? { ...i, parent: parent || undefined } : i) }, parent ? '通过明确操作改变了分组归属' : '已将对象移出分组')
  }

  const autoLayout = async () => {
    const base = currentRef.current

    if (!base.graph || !enabled)
      return

    const version = revisionRef.current

    setBusy(true)

    try {
      const result = await arrange(base.graph)

      if (version !== revisionRef.current)
        return

      setElapsed(result.elapsed)

      commit({ ...base, layout: result.layout }, '已自动布局；代码不变，可以一步撤销')

      window.setTimeout(() => {
        void flow.fitView({ padding: 0.15 })
      }, 50)
    }
    catch (error) {
      setNotice(`布局失败，原位置保留：${String(error)}`)
    }
    finally {
      setBusy(false)
    }
  }

  const reset = (code = sample) => {
    revisionRef.current++

    historyRef.current = { past: [], future: [], group: '', at: 0 }

    initialRef.current = true
    setValidationEpoch(v => v + 1)

    setSelected([])

    setWireId('')

    setPending(null)
    injectFailureRef.current = false
    setPreview({ code: '', svg: '', error: '' })

    setStep(0)

    put({ ...emptyDocument(), code, original: code })

    setNotice('已开始新的原型文档：没有修改真实工具数据')
  }

  const selectNodes = useCallback(({ nodes: chosen }: { nodes: ProtoNode[] }) => {
    const ids = chosen.map(n => n.id)

    setSelected(old => old.join('|') === ids.join('|') ? old : ids)
  }, [])

  const nodes: ProtoNode[] = (doc.graph?.items ?? []).map((item): ProtoNode => {
    const geometry = doc.layout[item.id] ?? { x: 0, y: 0, width: 154, height: 66 }

    const styles = Object.fromEntries(item.styles.map(s => s.split(':').map(x => x.trim())))

    return {
      id: item.id,
      parentId: item.parent,
      type: 'prototype',
      position: { x: geometry.x, y: geometry.y },
      width: geometry.width,
      height: geometry.height,
      measured: { width: geometry.width, height: geometry.height },
      style: { 'width': geometry.width, 'height': geometry.height, '--node-fill': styles.fill, '--node-color': styles.color, '--node-stroke': styles.stroke } as React.CSSProperties,
      data: { item, edit: editLabel, vertical: ['TB', 'TD', 'BT'].includes(doc.graph!.direction) },
      selected: selected.includes(item.id),
      extent: item.parent ? 'parent' : undefined,
      draggable: enabled,
      connectable: enabled,
    }
  }).sort((a, b) => {
    const depth = (n: ProtoNode): number => n.parentId ? 1 + depth({ parentId: doc.graph?.items.find(i => i.id === n.parentId)?.parent } as ProtoNode) : 0

    return depth(a) - depth(b)
  })

  const edges: Edge[] = (doc.graph?.wires ?? []).map((wire) => {
    const peers = doc.graph!.wires.filter(w => w.source === wire.source && w.target === wire.target)

    const offset = (peers.indexOf(wire) - (peers.length - 1) / 2) * 65

    return {
      id: wire.id,
      source: wire.source,
      target: wire.target,
      type: 'prototype',
      label: wire.label,
      data: { offset },
      selected: wire.id === wireId,
      markerEnd: wire.arrow === 'none' ? undefined : { type: MarkerType.ArrowClosed },
      markerStart: wire.arrow === 'both' ? { type: MarkerType.ArrowClosed } : undefined,
      style: { stroke: 'var(--muted-foreground)', strokeWidth: wire.stroke === 'thick' ? 3 : 1.6, strokeDasharray: wire.stroke === 'dotted' ? '6 4' : undefined },
    }
  })

  const nodeChanges = (changes: NodeChange<ProtoNode>[]) => {
    const positions = changes.filter(c => c.type === 'position')

    if (!positions.length)
      return

    const layout = { ...currentRef.current.layout }

    for (const c of positions) {
      if (c.type === 'position' && c.position && layout[c.id])
        layout[c.id] = { ...layout[c.id], ...c.position }
    }

    put({ ...currentRef.current, layout })
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !composition) {
        event.preventDefault()

        moveHistory(event.shiftKey)
      }

      if (event.key === 'Escape' && !composition) {
        setPending(null)
        setPanel(null)
        injectFailureRef.current = false
      }
    }

    window.addEventListener('keydown', listener)

    return () => window.removeEventListener('keydown', listener)
  }, [composition, moveHistory])

  const item = doc.graph?.items.find(i => selected.includes(i.id))

  const wire = doc.graph?.wires.find(w => w.id === wireId)

  const modes = { checking: '正在校验', canvas: '可视化编辑', code: '代码与预览', error: '错误草稿' }

  const guidance: Record<string, string[]> = {
    正常往返: ['选择或双击「任务处理」改文字；注意首次排版提示', '拖动节点，确认代码不变，再查看 Mermaid 预览', '撤销一次，确认布局回到上一步'],
    错误与降级: ['加入不支持的样式类，画布应关闭、源码仍可编辑', '再加入语法错误，查看上一次有效预览标记', '撤销并回到画布，检查原位置是否保留'],
    分组与注释: ['选中「客户端」分组，点击删除，检查端点线警告', '取消后选择「移动应用」，明确移入「核心服务」', '确认普通注释还在，再撤销这次结构变化'],
    布局与失败: ['自动布局，观察嵌套分组和跨组连线', '模拟转换失败：代码、节点和历史应都不变', '恢复导入原稿，再撤销恢复'],
  }

  const runStep = () => {
    const d = currentRef.current

    if (guide === '错误与降级') {
      if (step === 0)
        changeCode(`${d.code}\nclassDef experimental font-weight:bold\n`)

      if (step === 1)
        changeCode(`${d.code}\nsubgraph broken[\n`)

      if (step === 2)
        moveHistory(false)
    }

    if (guide === '布局与失败') {
      if (step === 0)
        void autoLayout()

      if (step === 1 && d.graph) {
        injectFailureRef.current = true
        mutate({ ...d.graph, items: d.graph.items.map(i => i.id === 'Job' ? { ...i, label: '此修改必须回滚' } : i) }, '故障操作不得提交')
      }

      if (step === 2)
        commit({ ...d, code: d.original, mode: 'checking', normalized: false }, '已恢复导入原稿，这一步可撤销')
    }

    if (guide === '正常往返') {
      if (step === 0 && d.graph)
        editLabel('Job', '任务处理（已修改）')

      if (step === 1)
        setView('preview')

      if (step === 2)
        moveHistory(false)
    }

    if (guide === '分组与注释') {
      if (step === 0) {
        setSelected(['CLIENT'])

        setNotice('已选中客户端；点击「删除 / 解除分组」观察实验方案')
      }

      if (step === 1) {
        setSelected(['App'])

        setNotice('已选中移动应用；使用「移入分组」明确操作')
      }

      if (step === 2)
        moveHistory(false)
    }

    setStep(old => Math.min(old + 1, 3))
  }

  const properties = (
    <section className="property-fields" aria-label="对象属性">
      <p className="property-selection">{item ? `${item.label} · ${item.id}` : wire ? '已选中连线' : '选择节点或连线，编辑它的文字与分组。'}</p>
      {item && (
        <label>
          显示文字
          <input
            aria-label="选中对象文字"
            key={item.id + item.label}
            defaultValue={item.label}
            disabled={!enabled}
            onBlur={e => editLabel(item.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                e.currentTarget.blur()
            }}
          />
        </label>
      )}
      {wire && (
        <label>
          连线文字
          <input
            aria-label="选中连线文字"
            key={wire.id + wire.label}
            defaultValue={wire.label}
            disabled={!enabled}
            onBlur={(e) => {
              if (doc.graph && wire.label !== e.target.value)
                mutate({ ...doc.graph, wires: doc.graph.wires.map(w => w.id === wire.id ? { ...w, label: e.target.value } : w) }, '已修改连线标签')
            }}
          />
        </label>
      )}
      <label>
        分组归属
        <select aria-label="移入分组" value="" disabled={!enabled || !selected.length} onChange={e => regroup(e.target.value === '$root' ? '' : e.target.value)}>
          <option value="">移入 / 移出分组…</option>
          <option value="$root">移到最外层</option>
          {doc.graph?.items.filter(i => i.shape === 'group').map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </label>
      <label>
        全图方向
        <select
          aria-label="全图方向"
          value={doc.graph?.direction ?? 'LR'}
          disabled={!enabled}
          onChange={(e) => {
            if (doc.graph)
              mutate({ ...doc.graph, direction: e.target.value }, '方向已更新；画布位置待主动布局')
          }}
        >
          {['LR', 'RL', 'TB', 'BT'].map(d => <option key={d}>{d}</option>)}
        </select>
      </label>
      <p className="property-hint">方向更新代码与 Mermaid 预览；点击自动布局才会重排画布。</p>
      <Button size="sm" variant="outline" disabled={!enabled || (!selected.length && !wireId)} onClick={() => remove()}>
        <Trash2 />
        删除 / 解除分组
      </Button>
      {item?.shape === 'group' && <Button size="sm" variant="outline" disabled={!enabled} onClick={() => remove(true)}>删除分组及全部内容</Button>}
    </section>
  )

  const canvas = (
    <section className="canvas-section" aria-label="图形工作区">
      <div className="section-heading">
        <h2>图形工作区</h2>
        <div className="view-tabs">
          <Button size="sm" variant={view === 'canvas' ? 'secondary' : 'ghost'} aria-pressed={view === 'canvas'} onClick={() => setView('canvas')}>编辑画布</Button>
          <Button size="sm" variant={view === 'preview' ? 'secondary' : 'ghost'} aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Mermaid 预览</Button>
        </div>
      </div>
      <div className="canvas-stage">
        <div className={view === 'canvas' ? 'canvas-layer' : 'canvas-layer hidden'}>
          <ReactFlow<ProtoNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={nodeChanges}
            onConnect={connect}
            onSelectionChange={selectNodes}
            onEdgeClick={(_, e) => {
              setWireId(e.id)

              setSelected([])
            }}
            onNodeClick={() => setWireId('')}
            onNodeDragStart={() => {
              draggingRef.current = clone(currentRef.current)

              historyRef.current.group = ''
            }}
            onNodeDragStop={() => {
              if (draggingRef.current) {
                commit(clone(currentRef.current), '节点位置已保存；源码不变', '', draggingRef.current)

                draggingRef.current = null
              }
            }}
            deleteKeyCode={null}
            nodesDraggable={enabled && tool === 'select'}
            nodesConnectable={enabled && tool === 'select'}
            elementsSelectable={enabled}
            fitView
            minZoom={0.08}
            maxZoom={4}
            selectionOnDrag={tool === 'select'}
            panOnDrag={tool === 'pan' ? true : [1, 2]}
            multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
            onInit={(instance) => {
              window.setTimeout(() => {
                void instance.fitView({ padding: 0.15 })
              }, 800)
            }}
          >
            <Background color="var(--border)" />
            <Controls showInteractive={false} showZoom={false} showFitView={false}>
              <Button size="icon-sm" variant="ghost" aria-label="Zoom In" title="放大" onClick={() => { void flow.zoomIn() }}><Plus /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Zoom Out" title="缩小" onClick={() => { void flow.zoomOut() }}><Minus /></Button>
              <Button size="icon-sm" variant="ghost" aria-label="Fit View" title="适应画布" onClick={() => { void flow.fitView({ padding: 0.15 }) }}><Maximize /></Button>
            </Controls>
          </ReactFlow>
          {!enabled && (
            <div className="canvas-lock">
              <strong>{busy ? '正在处理操作' : modes[doc.mode]}</strong>
              <p>{doc.message}</p>
              <Button variant="secondary" size="sm" onClick={() => setView('preview')}>查看 Mermaid 预览</Button>
            </div>
          )}
        </div>
        {view === 'preview' && (
          <div className="mermaid-stage">
            <p className="preview-caption">
              Mermaid 自动布局；不会覆盖编辑画布位置。
              {preview.svg && preview.code !== doc.code && '来自上一次有效代码。'}
            </p>
            {preview.error && <p className="prototype-warning">{preview.error}</p>}
            <div className="svg-output" dangerouslySetInnerHTML={{ __html: preview.svg }} />
            {!preview.svg && <p>正在生成预览，或尚无有效预览。</p>}
          </div>
        )}
      </div>
      <p className="canvas-footnote">拖圆点连线 · 双击文字编辑 · Shift / ⌘ 多选 · 中键或右键平移 · 滚轮缩放。触屏可点击两端圆点连接。</p>
      <p className="canvas-footnote">原型限制：ELK 按层级计算节点位置；画布路径为简化曲线，尚未实现避障路由。原生 Safari / 触屏仍需实际设备验证。</p>
    </section>
  )

  const code = (
    <section className="code-section">
      <div className="section-heading">
        <h2>当前 Mermaid 代码</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(doc.code).then(() => setNotice('已复制当前代码，不包含手动坐标'))
          }}
        >
          复制代码
        </Button>
      </div>
      <textarea
        aria-label="当前 Mermaid 代码"
        spellCheck={false}
        value={doc.code}
        onChange={e => changeCode(e.target.value)}
        onCompositionStart={() => {
          compositionIdRef.current++

          historyRef.current.group = ''

          setComposition(true)
        }}
        onCompositionEnd={() => {
          historyRef.current.group = ''

          setComposition(false)
        }}
      />
      <p className={`code-state ${doc.mode === 'error' ? 'invalid' : ''}`} role="status">
        {modes[doc.mode]}
        {' '}
        ·
        {' '}
        {doc.message}
      </p>
      <details>
        <summary>查看导入原稿（不会随编辑覆盖）</summary>
        <pre>{doc.original}</pre>
      </details>
    </section>
  )

  const guidePanel = (
    <section className="guide-section">
      <div className="section-heading">
        <h2>引导场景</h2>
        <Button size="sm" variant="ghost" onClick={() => reset()}>重置示例</Button>
      </div>
      <div className="scenario-tabs" role="tablist" aria-label="引导场景">
        {Object.keys(guidance).map(name => (
          <button
            key={name}
            role="tab"
            type="button"
            aria-selected={guide === name}
            onClick={() => {
              reset()

              setGuide(name)
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <ol>{guidance[guide].map((line, i) => <li key={line} className={i === step ? 'current-step' : ''}>{line}</li>)}</ol>
      <Button size="sm" variant="secondary" onClick={runStep} disabled={busy || doc.mode === 'checking' || step >= 3}>{step >= 3 ? '场景步骤已结束' : `执行第 ${step + 1} 步`}</Button>
    </section>
  )

  const togglePanel = (next: typeof panel) => setPanel(old => old === next ? null : next)
  const shapeButtons = [
    { shape: 'square', label: '矩形', icon: Square },
    { shape: 'round', label: '圆角', icon: Square, extra: true },
    { shape: 'diamond', label: '条件', icon: Diamond },
    { shape: 'stadium', label: '起止', icon: Circle, extra: true },
    { shape: 'circle', label: '圆形', icon: Circle, extra: true },
    { shape: 'cylinder', label: '数据库', icon: Database },
    { shape: 'group', label: '分组', icon: FolderPlus },
  ]
  const addShape = (shape: string) => {
    setTool('select')
    setView('canvas')
    addItem(shape)
  }

  return (
    <main className="mermaid-prototype mermaid-prototype-hud">
      {canvas}
      <header className="hud-surface hud-title">
        <a href="/" aria-label="返回工具首页" title="返回工具首页"><ArrowLeft size={16} /></a>
        <div>
          <h1>
            Mermaid
            <span>未命名流程图</span>
          </h1>
        </div>
        <span className="hud-prototype-label">原型</span>
        <Button size="icon-sm" variant={panel === 'file' ? 'secondary' : 'ghost'} aria-label="文档菜单" title="文档菜单" aria-expanded={panel === 'file'} onClick={() => togglePanel('file')}><ChevronDown /></Button>
      </header>

      <div className="hud-surface hud-view-actions" role="toolbar" aria-label="视图与面板">
        <div className="hud-view-tabs">
          <Button size="sm" variant={view === 'canvas' ? 'secondary' : 'ghost'} aria-pressed={view === 'canvas'} onClick={() => setView('canvas')}>编辑画布</Button>
          <Button size="sm" variant={view === 'preview' ? 'secondary' : 'ghost'} aria-pressed={view === 'preview'} onClick={() => setView('preview')}>Mermaid 预览</Button>
        </div>
        <span className="hud-divider" />
        <Button size="sm" variant={panel === 'code' ? 'secondary' : 'ghost'} aria-label="代码面板" aria-expanded={panel === 'code'} onClick={() => togglePanel('code')}>
          <Code2 />
          <span>代码</span>
        </Button>
        <Button size="icon-sm" variant={panel === 'properties' ? 'secondary' : 'ghost'} aria-label="属性面板" title="属性" aria-expanded={panel === 'properties'} onClick={() => togglePanel('properties')}><Settings2 /></Button>
        <Button size="icon-sm" variant={panel === 'guide' ? 'secondary' : 'ghost'} aria-label="体验引导" title="体验引导" aria-expanded={panel === 'guide'} onClick={() => togglePanel('guide')}><HelpCircle /></Button>
      </div>

      <div className="hud-mode" aria-label="文档状态">
        <span className={`hud-mode-dot mode-${doc.mode}`} />
        <strong>{modes[doc.mode]}</strong>
        <span>
          {doc.graph?.items.length ?? '—'}
          {' '}
          个对象 ·
          {' '}
          {doc.graph?.wires.length ?? '—'}
          {' '}
          条连线
        </span>
      </div>
      {(selected.length > 0 || wireId) && (
        <div className="hud-surface hud-selection">
          <span>{wireId ? '已选中连线' : `已选中 ${selected.length} 个对象`}</span>
          <Button size="sm" variant="ghost" onClick={() => setPanel('properties')}>属性</Button>
          <Button size="icon-sm" variant="ghost" aria-label="删除选中对象" title="删除选中对象" disabled={!enabled} onClick={() => remove()}><Trash2 /></Button>
        </div>
      )}

      <div className="hud-surface hud-history" role="toolbar" aria-label="文档历史">
        <Button size="icon-sm" variant="ghost" aria-label={`撤销 ${historyRef.current.past.length}`} title="撤销 ⌘Z" disabled={!historyRef.current.past.length || busy} onClick={() => moveHistory(false)}><Undo2 /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={`重做 ${historyRef.current.future.length}`} title="重做 ⇧⌘Z" disabled={!historyRef.current.future.length || busy} onClick={() => moveHistory(true)}><Redo2 /></Button>
      </div>

      <nav className="hud-surface hud-tools" aria-label="画布工具">
        <Button size="icon" variant={tool === 'select' ? 'secondary' : 'ghost'} aria-label="选择工具" aria-pressed={tool === 'select'} title="选择与多选" onClick={() => setTool('select')}><MousePointer2 /></Button>
        <Button size="icon" variant={tool === 'pan' ? 'secondary' : 'ghost'} aria-label="平移工具" aria-pressed={tool === 'pan'} title="拖动画布" onClick={() => setTool('pan')}><Hand /></Button>
        <span className="hud-divider" />
        {shapeButtons.map(({ shape, label, icon: Icon, extra }) => <Button key={shape} className={extra ? 'additional-shape' : ''} size="icon" variant="ghost" aria-label={`添加${label}`} title={`添加${label}`} disabled={!enabled || view !== 'canvas'} onClick={() => addShape(shape)}><Icon /></Button>)}
        <details className="hud-more-shapes">
          <summary aria-label="更多节点形状" title="更多节点形状"><Plus size={18} /></summary>
          <div className="hud-surface shape-popover">
            {shapeButtons.filter(i => i.extra).map(({ shape, label, icon: Icon }) => (
              <Button size="sm" key={shape} variant="ghost" disabled={!enabled} onClick={() => addShape(shape)}>
                <Icon />
                {label}
              </Button>
            ))}
          </div>
        </details>
        <span className="hud-divider" />
        <Button size="icon" variant="ghost" aria-label="自动布局" title="自动布局（可撤销）" disabled={!enabled} onClick={() => { void autoLayout() }}><LayoutGrid /></Button>
      </nav>
      <div className="hud-canvas-hint">
        {tool === 'pan' ? '拖动平移画布' : '双击改文字 · 拖圆点连线 · Shift 多选'}
        <span>内存原型 · 刷新不保留</span>
      </div>
      {notice && (
        <div className="hud-surface hud-notice" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="关闭操作提示" onClick={() => setNotice('')}><X size={13} /></button>
        </div>
      )}

      {panel && (
        <aside className={`hud-surface hud-panel hud-panel-${panel}`} aria-label={panel === 'code' ? '代码浮层' : panel === 'properties' ? '属性浮层' : panel === 'guide' ? '体验引导浮层' : '文档菜单浮层'}>
          <header className="hud-panel-header">
            <strong>{panel === 'code' ? 'Mermaid 代码' : panel === 'properties' ? '属性' : panel === 'guide' ? '体验与说明' : '文档'}</strong>
            <Button size="icon-sm" variant="ghost" aria-label="关闭浮层" onClick={() => setPanel(null)}><X /></Button>
          </header>
          <div className="hud-panel-content">
            {panel === 'code' && code}
            {panel === 'properties' && properties}
            {panel === 'guide' && (
              <>
                {guidePanel}
                <p className="hud-explanation">全屏画布上的工具均为悬浮 HUD，代码与属性按需展开；打开面板不会重排画布。</p>
                <p className="hud-explanation">本轮验证交互与状态。ELK 仅计算层级位置，画布使用简化曲线，没有避障。完整 Mermaid 保真、实际触屏和原生 Safari 尚未验收。</p>
                <details className="prototype-boundaries">
                  <summary>诊断状态与原型限制</summary>
                  <p>内部 FlowDB 适配仅用于锁定版本的原型。解除有端点连线分组的行为仍待确认；没有图片导出或工程保存。</p>
                  <p>
                    最近 ELK：
                    {Math.round(elapsed)}
                    {' '}
                    ms ·
                    {doc.graph?.notes.length ?? '—'}
                    {' '}
                    条普通注释
                  </p>
                  <pre>{JSON.stringify({ mode: doc.mode, normalized: doc.normalized, layout: doc.layout, graph: doc.graph, past: historyRef.current.past.length, future: historyRef.current.future.length }, null, 2)}</pre>
                </details>
                <a className="hud-issue-link" href="https://github.com/pzehrel/web-tools/issues/21" target="_blank" rel="noreferrer">查看原型决策票</a>
              </>
            )}
            {panel === 'file' && (
              <section className="hud-file-actions">
                <p>
                  未命名流程图
                  <span>仅在本次内存会话中编辑</span>
                </p>
                <label className="import-code">
                  <Braces size={16} />
                  导入 Mermaid 文件
                  <input
                    type="file"
                    accept=".mmd,.mermaid,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file)
                        void file.text().then(reset)
                      e.target.value = ''
                    }}
                  />
                </label>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => commit({ ...currentRef.current, code: currentRef.current.original, mode: 'checking', normalized: false }, '已恢复导入原稿，可以撤销')}>恢复导入原稿</Button>
                <Button size="sm" variant="ghost" onClick={() => reset()}>重置复杂图示例</Button>
                <Button size="sm" variant="ghost" onClick={() => reset('sequenceDiagram\n  用户->>服务: 请求\n  服务-->>用户: 响应\n')}>载入时序图示例</Button>
                <div className="hud-theme-row">
                  <span>界面主题</span>
                  <ThemeToggle />
                </div>
              </section>
            )}
          </div>
        </aside>
      )}
      {pending && (
        <div className="prototype-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="prototype-dialog-title" className="prototype-dialog">
            <h2 id="prototype-dialog-title">{pending.title}</h2>
            <p>{pending.detail}</p>
            <div className="action-row">
              <Button variant="outline" autoFocus onClick={() => setPending(null)}>取消</Button>
              <Button onClick={() => {
                const action = pending.action

                setPending(null)

                action()
              }}
              >
                {pending.accept}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default function MermaidEditorPrototype() {
  return <ReactFlowProvider><Editor /></ReactFlowProvider>
}
