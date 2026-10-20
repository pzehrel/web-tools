import assert from 'node:assert/strict'
import process from 'node:process'
import { fitHudRect, updateHudRect } from '../../apps/web/src/ui-redesign-hud-geometry.prototype.ts'

const bounds = { left: 264, top: 116, right: 1428, bottom: 844 }
const start = { x: 700, y: 400, width: 400, height: 300 }
const cases = []
function contained(rect, area) {
  assert.ok(rect.x >= area.left && rect.y >= area.top)
  assert.ok(rect.x + rect.width <= area.right && rect.y + rect.height <= area.bottom)
  assert.ok(rect.width > 0 && rect.height > 0)
}
assert.deepEqual(updateHudRect(start, 'move', 20, -30, bounds), { ...start, x: 720, y: 370 })
assert.deepEqual(start, { x: 700, y: 400, width: 400, height: 300 })
for (const area of [bounds, { left: 12, top: 68, right: 308, bottom: 561 }, { left: 0, top: 0, right: 180, bottom: 120 }]) {
  const base = fitHudRect(start, area)
  for (const action of ['move', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
    for (const [dx, dy] of [[0, 0], [-100000, -100000], [100000, 100000], [-50, 30], [50, -30]]) {
      const next = updateHudRect(base, action, dx, dy, area)
      contained(next, area)
      if (action === 'move') {
        assert.equal(next.width, base.width)
        assert.equal(next.height, base.height)
      }
      else {
        if (action.includes('w'))
          assert.equal(next.x + next.width, base.x + base.width)
        if (action.includes('e'))
          assert.equal(next.x, base.x)
        if (action.includes('n'))
          assert.equal(next.y + next.height, base.y + base.height)
        if (action.includes('s'))
          assert.equal(next.y, base.y)
      }
      cases.push({ action, area, dx, dy })
    }
  }
}
process.stdout.write(JSON.stringify({ passed: true, geometryCases: cases.length, checks: ['move preserves size', 'all eight resize anchors', 'large pointer deltas stay in bounds', 'mobile clamp', 'viewport smaller than minimum', 'input rectangle unchanged'] }))
