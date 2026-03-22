// renderer.js — SVG rendering: nodes, edges, zoom, pan

const NODE_WIDTH = 220
const NODE_HEIGHT = 110

let svgElement = null
let graphRoot = null
let edgesLayer = null
let nodesLayer = null
let state = {
  transform: { tx: 0, ty: 0, scale: 1 },
  isPanning: false,
  panStart: { x: 0, y: 0 }
}
// Store bound handlers so we can remove them on cleanup
let _onMouseMove = null
let _onMouseUp = null

/**
 * Initialize the SVG renderer.
 * Mounts SVG into #editor-main and sets up zoom/pan.
 */
export function initRenderer(container) {
  // Cleanup previous instance
  destroyRenderer()

  // Reset transform state
  state = { transform: { tx: 0, ty: 0, scale: 1 }, isPanning: false, panStart: { x: 0, y: 0 } }

  // Create SVG structure
  svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svgElement.setAttribute('id', 'graph-svg')
  svgElement.setAttribute('width', '100%')
  svgElement.setAttribute('height', '100%')
  svgElement.style.cursor = 'grab'

  graphRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  graphRoot.setAttribute('id', 'graph-root')

  edgesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  edgesLayer.setAttribute('id', 'edges-layer')

  nodesLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  nodesLayer.setAttribute('id', 'nodes-layer')

  graphRoot.appendChild(edgesLayer)
  graphRoot.appendChild(nodesLayer)
  svgElement.appendChild(graphRoot)

  container.appendChild(svgElement)

  initZoomPan()
}

/**
 * Remove previous SVG and document listeners
 */
function destroyRenderer() {
  if (_onMouseMove) document.removeEventListener('mousemove', _onMouseMove)
  if (_onMouseUp) document.removeEventListener('mouseup', _onMouseUp)
  _onMouseMove = null
  _onMouseUp = null
  if (svgElement && svgElement.parentNode) {
    svgElement.parentNode.removeChild(svgElement)
  }
  svgElement = null
  graphRoot = null
  edgesLayer = null
  nodesLayer = null
}

/**
 * Initialize zoom and pan listeners (mouse + touch)
 */
function initZoomPan() {
  // ── Mouse: wheel zoom ─────────────────────────────────────
  svgElement.addEventListener('wheel', (e) => {
    e.preventDefault()
    const oldScale = state.transform.scale
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    const newScale = Math.max(0.2, Math.min(3, oldScale * delta))

    // Anchor zoom to viewport center
    const svgRect = svgElement.getBoundingClientRect()
    const cx = svgRect.width / 2
    const cy = svgRect.height / 2

    state.transform.tx = cx - (cx - state.transform.tx) * (newScale / oldScale)
    state.transform.ty = cy - (cy - state.transform.ty) * (newScale / oldScale)
    state.transform.scale = newScale
    applyTransform()
  })

  // ── Mouse: pan ────────────────────────────────────────────
  svgElement.addEventListener('mousedown', (e) => {
    if (e.target === svgElement) {
      state.isPanning = true
      state.panStart = { x: e.clientX, y: e.clientY }
      svgElement.style.cursor = 'grabbing'
    }
  })

  _onMouseMove = (e) => {
    if (state.isPanning) {
      const dx = e.clientX - state.panStart.x
      const dy = e.clientY - state.panStart.y
      state.transform.tx += dx
      state.transform.ty += dy
      state.panStart = { x: e.clientX, y: e.clientY }
      applyTransform()
    }
  }

  _onMouseUp = () => {
    state.isPanning = false
    if (svgElement) svgElement.style.cursor = 'grab'
  }

  document.addEventListener('mousemove', _onMouseMove)
  document.addEventListener('mouseup', _onMouseUp)

  // ── Touch: pan + pinch-to-zoom ────────────────────────────
  let touchStartPos = null
  let touchIsDragging = false
  let lastPinchDist = null
  let lastPinchCenter = null

  function pinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function pinchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    }
  }

  svgElement.addEventListener('touchstart', (e) => {
    e.preventDefault()
    const touches = Array.from(e.touches)

    if (touches.length === 1) {
      touchStartPos = { x: touches[0].clientX, y: touches[0].clientY }
      touchIsDragging = false
      state.panStart = { x: touches[0].clientX, y: touches[0].clientY }
      lastPinchDist = null
      lastPinchCenter = null
    } else if (touches.length === 2) {
      touchIsDragging = true
      lastPinchDist = pinchDist(touches)
      lastPinchCenter = pinchCenter(touches)
    }
  }, { passive: false })

  svgElement.addEventListener('touchmove', (e) => {
    e.preventDefault()
    const touches = Array.from(e.touches)

    if (touches.length === 1) {
      const dx = touches[0].clientX - state.panStart.x
      const dy = touches[0].clientY - state.panStart.y

      if (!touchIsDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        touchIsDragging = true
      }

      if (touchIsDragging) {
        state.transform.tx += dx
        state.transform.ty += dy
        state.panStart = { x: touches[0].clientX, y: touches[0].clientY }
        applyTransform()
      }
    } else if (touches.length === 2 && lastPinchDist !== null) {
      const svgRect = svgElement.getBoundingClientRect()
      const newDist = pinchDist(touches)
      const newCenter = pinchCenter(touches)

      const ratio = newDist / lastPinchDist
      const oldScale = state.transform.scale
      const newScale = Math.max(0.2, Math.min(3, oldScale * ratio))

      // Map old pinch center in graph space to new pinch center in viewport space
      const cxOld = lastPinchCenter.x - svgRect.left
      const cyOld = lastPinchCenter.y - svgRect.top
      const cxNew = newCenter.x - svgRect.left
      const cyNew = newCenter.y - svgRect.top

      state.transform.tx = cxNew - (cxOld - state.transform.tx) * (newScale / oldScale)
      state.transform.ty = cyNew - (cyOld - state.transform.ty) * (newScale / oldScale)
      state.transform.scale = newScale

      lastPinchDist = newDist
      lastPinchCenter = newCenter
      applyTransform()
    }
  }, { passive: false })

  svgElement.addEventListener('touchend', (e) => {
    const remaining = e.touches.length
    const changed = Array.from(e.changedTouches)

    // Tap: single finger lifted without dragging → simulate click
    if (remaining === 0 && !touchIsDragging && touchStartPos && changed.length === 1) {
      const touch = changed[0]
      const el = document.elementFromPoint(touch.clientX, touch.clientY)
      if (el) {
        el.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY
        }))
      }
    }

    if (remaining < 2) {
      lastPinchDist = null
      lastPinchCenter = null
    }

    if (remaining === 0) {
      touchStartPos = null
      touchIsDragging = false
    } else if (remaining === 1) {
      // Transition from 2→1 finger: reset pan origin
      state.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      touchIsDragging = false
    }
  }, { passive: false })
}

/**
 * Apply the current transform (zoom + pan) to the graph root
 */
function applyTransform() {
  const { tx, ty, scale } = state.transform
  graphRoot.setAttribute('transform', `translate(${tx}, ${ty}) scale(${scale})`)
}

/**
 * Render the complete graph with nodes and edges
 */
export function renderGraph(nodes, edges, positions, activeRootId = null, hiddenEdges = null, hiddenChildCouples = null) {
  if (!svgElement) return

  // Clear existing
  edgesLayer.innerHTML = ''
  nodesLayer.innerHTML = ''

  const edgeList = Object.values(edges)

  // Deduplicate PARTNER_OF edges (only draw one per pair)
  const drawnPartnerEdges = new Set()

  // Render PARTNER_OF edges
  for (const edge of edgeList) {
    if (edge.type !== 'PARTNER_OF') continue
    const key = [edge.from, edge.to].sort().join('-')
    if (drawnPartnerEdges.has(key)) continue
    drawnPartnerEdges.add(key)
    const fromPos = positions.get(edge.from)
    const toPos = positions.get(edge.to)
    if (fromPos && toPos) renderPartnerEdge(edge, fromPos, toPos)
  }

  // Group CHILD_OF/ADOPTED_BY edges by parent pair → render as branching tree
  const childGroups = new Map()
  for (const edge of edgeList) {
    if (edge.type !== 'CHILD_OF' && edge.type !== 'ADOPTED_BY') continue
    const childId = edge.from
    if (!childGroups.has(childId)) {
      childGroups.set(childId, { parentIds: [], type: edge.type })
    }
    childGroups.get(childId).parentIds.push(edge.to)
  }

  // Now group children by parent-set
  const familyGroups = new Map()
  for (const [childId, info] of childGroups) {
    const key = [...info.parentIds].sort().join(',')
    if (!familyGroups.has(key)) {
      familyGroups.set(key, { parentIds: info.parentIds, children: [] })
    }
    familyGroups.get(key).children.push({ childId, type: info.type })
  }

  // Render each family group as a branching connector
  for (const [key, group] of familyGroups) {
    const railInfo = renderFamilyEdges(group, positions)

    // If this couple has hidden children, extend the rail with a dashed stub
    if (railInfo && hiddenChildCouples && hiddenChildCouples.has(key)) {
      renderHiddenChildRail(railInfo)
    }
  }

  // Render nodes
  for (const [nodeId, node] of Object.entries(nodes)) {
    renderNode(node, positions, nodeId === activeRootId)
  }

  // Render hidden-edge stubs (dashed lines indicating off-screen relationships)
  if (hiddenEdges) {
    for (const [nodeId, dirs] of hiddenEdges) {
      renderHiddenStubs(nodeId, dirs, positions)
    }
  }

  applyTransform()
}

/**
 * Render a single node
 */
function renderNode(node, positions, isRoot = false) {
  const pos = positions.get(node.id)
  if (!pos) return

  const genderClass = node.gender === 'M' ? 'male' : node.gender === 'F' ? 'female' : 'other'
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.classList.add('node', `node--${genderClass}`)
  if (isRoot) g.classList.add('node--root')
  g.setAttribute('data-id', node.id)
  g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`)

  // Background rectangle
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('width', NODE_WIDTH)
  rect.setAttribute('height', NODE_HEIGHT)
  rect.setAttribute('rx', '8')
  rect.setAttribute('class', 'node-rect')

  // Gender icon
  const genderIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  genderIcon.classList.add('node-gender-icon')
  genderIcon.setAttribute('x', '16')
  genderIcon.setAttribute('y', '35')
  const genderSymbol = node.gender === 'M' ? '♂' : node.gender === 'F' ? '♀' : '⚬'
  genderIcon.textContent = genderSymbol

  // Name + Surname
  const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  nameText.classList.add('node-name')
  nameText.setAttribute('x', '110')
  nameText.setAttribute('y', '42')
  nameText.setAttribute('text-anchor', 'middle')
  nameText.textContent = `${node.name} ${node.surname}`

  // Birth-Death dates
  const datesText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  datesText.classList.add('node-dates')
  datesText.setAttribute('x', '110')
  datesText.setAttribute('y', '68')
  datesText.setAttribute('text-anchor', 'middle')
  const birth = node.birth ? node.birth.substring(0, 4) : '?'
  const death = node.death ? node.death.substring(0, 4) : ''
  datesText.textContent = death ? `${birth}–${death}` : birth

  g.appendChild(rect)
  g.appendChild(genderIcon)
  g.appendChild(nameText)
  g.appendChild(datesText)

  nodesLayer.appendChild(g)
}

/**
 * Render a PARTNER_OF edge (horizontal line with add-child button)
 */
function renderPartnerEdge(edge, fromPos, toPos) {
  const x1 = fromPos.x + NODE_WIDTH / 2
  const y1 = fromPos.y + NODE_HEIGHT / 2
  const x2 = toPos.x + NODE_WIDTH / 2
  const y2 = toPos.y + NODE_HEIGHT / 2

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.classList.add('edge', 'edge--partner')
  line.setAttribute('x1', x1)
  line.setAttribute('y1', y1)
  line.setAttribute('x2', x2)
  line.setAttribute('y2', y2)
  line.setAttribute('stroke-width', '2')

  edgesLayer.appendChild(line)

  // Add child button at midpoint
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2

  const btnGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  btnGroup.classList.add('add-child-btn')
  btnGroup.setAttribute('data-from', edge.from)
  btnGroup.setAttribute('data-to', edge.to)
  btnGroup.setAttribute('transform', `translate(${mx}, ${my})`)
  btnGroup.style.cursor = 'pointer'

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('r', '12')
  circle.setAttribute('class', 'add-child-btn-circle')

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dy', '0.3em')
  text.setAttribute('class', 'add-child-btn-text')
  text.textContent = '+'

  btnGroup.appendChild(circle)
  btnGroup.appendChild(text)
  edgesLayer.appendChild(btnGroup)
}

/**
 * Render family edges: from the midpoint of a parent couple, a single trunk
 * drops down, then a horizontal rail connects to vertical drops to each child.
 *
 * Shape:
 *   Parent A ——●—— Parent B      (partner edge drawn separately)
 *              |                   trunk (vertical from couple midpoint)
 *        ┌─────┼─────┐            rail (horizontal across children)
 *        |     |     |            drops (vertical to each child)
 *      Child1 Child2 Child3
 */
function renderFamilyEdges(group, positions) {
  const { parentIds, children } = group
  const isAdopted = children.some(c => c.type === 'ADOPTED_BY')

  // Compute parent midpoint (top of trunk)
  const parentPositions = parentIds.map(id => positions.get(id)).filter(Boolean)
  if (parentPositions.length === 0) return null
  const parentMidX = parentPositions.reduce((sum, p) => sum + p.x + NODE_WIDTH / 2, 0) / parentPositions.length
  const parentMidY = parentPositions[0].y + NODE_HEIGHT / 2

  // Compute child positions
  const childPositions = children
    .map(c => ({ ...c, pos: positions.get(c.childId) }))
    .filter(c => c.pos)
  if (childPositions.length === 0) return null

  // Rail Y sits halfway between parent bottom and child top
  const childTopY = childPositions[0].pos.y
  const railY = parentMidY + (childTopY - parentMidY) / 2

  const cssClass = isAdopted ? 'edge--adopted' : 'edge--child'
  const dashArray = isAdopted ? '6,3' : null

  function makeLine(x1, y1, x2, y2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.classList.add('edge', cssClass)
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    line.setAttribute('stroke-width', '1.5')
    if (dashArray) line.setAttribute('stroke-dasharray', dashArray)
    edgesLayer.appendChild(line)
  }

  // Trunk: vertical from parent midpoint down to rail
  const ADD_BTN_RADIUS = 12
  makeLine(parentMidX, parentMidY + ADD_BTN_RADIUS, parentMidX, railY)

  const childXs = childPositions.map(c => c.pos.x + NODE_WIDTH / 2)
  const railLeft = Math.min(...childXs, parentMidX)
  const railRight = Math.max(...childXs, parentMidX)

  if (childPositions.length === 1) {
    // Single child: straight vertical line from rail to child top
    const cx = childPositions[0].pos.x + NODE_WIDTH / 2
    makeLine(parentMidX, railY, cx, childPositions[0].pos.y)
  } else {
    // Multiple children: horizontal rail + vertical drops
    makeLine(railLeft, railY, railRight, railY)

    for (const child of childPositions) {
      const cx = child.pos.x + NODE_WIDTH / 2
      makeLine(cx, railY, cx, child.pos.y)
    }
  }

  return { railY, railLeft, railRight, parentMidX }
}

/**
 * Render a dashed horizontal extension on a family rail to indicate hidden children.
 * Extends from the rightmost point of the rail.
 */
function renderHiddenChildRail(railInfo) {
  const STUB_LEN = 30
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.classList.add('edge', 'edge--hidden-stub')
  line.setAttribute('x1', railInfo.railRight)
  line.setAttribute('y1', railInfo.railY)
  line.setAttribute('x2', railInfo.railRight + STUB_LEN)
  line.setAttribute('y2', railInfo.railY)
  edgesLayer.appendChild(line)
}

/**
 * Render dashed stub lines from a node to indicate hidden relationships.
 * up = hidden parents, down = hidden children, side = hidden partner
 */
function renderHiddenStubs(nodeId, dirs, positions) {
  const pos = positions.get(nodeId)
  if (!pos) return

  const STUB_LEN = 30
  const SIDE_STUB_LEN = 15  // shorter to avoid touching neighboring siblings
  const cx = pos.x + NODE_WIDTH / 2

  function makeStub(x1, y1, x2, y2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.classList.add('edge', 'edge--hidden-stub')
    line.setAttribute('x1', x1)
    line.setAttribute('y1', y1)
    line.setAttribute('x2', x2)
    line.setAttribute('y2', y2)
    edgesLayer.appendChild(line)
  }

  if (dirs.up) {
    makeStub(cx, pos.y, cx, pos.y - STUB_LEN)
  }
  if (dirs.down) {
    makeStub(cx, pos.y + NODE_HEIGHT, cx, pos.y + NODE_HEIGHT + STUB_LEN)
  }
  if (dirs.side) {
    makeStub(pos.x + NODE_WIDTH, pos.y + NODE_HEIGHT / 2, pos.x + NODE_WIDTH + SIDE_STUB_LEN, pos.y + NODE_HEIGHT / 2)
  }
}

/**
 * Center the viewport on a given node position.
 * Preserves the current zoom level.
 */
export function centerOnNode(nodeId, positions) {
  if (!svgElement || !positions) return
  const pos = positions.get(nodeId)
  if (!pos) return

  const nodeCenterX = pos.x + NODE_WIDTH / 2
  const nodeCenterY = pos.y + NODE_HEIGHT / 2

  function apply() {
    const svgRect = svgElement.getBoundingClientRect()
    if (svgRect.width === 0 || svgRect.height === 0) {
      requestAnimationFrame(apply)
      return
    }
    const scale = state.transform.scale
    state.transform.tx = svgRect.width / 2 - nodeCenterX * scale
    state.transform.ty = svgRect.height / 2 - nodeCenterY * scale
    applyTransform()
  }

  apply()
}

/**
 * Highlight a node
 */
export function highlightNode(nodeId) {
  const node = nodesLayer.querySelector(`[data-id="${nodeId}"]`)
  if (node) {
    node.classList.add('highlighted')
  }
}

/**
 * Clear node highlighting
 */
export function clearHighlight() {
  nodesLayer.querySelectorAll('.highlighted').forEach(el => {
    el.classList.remove('highlighted')
  })
}
