// renderer.js — SVG rendering: nodes, edges, zoom, pan

const NODE_WIDTH = 160
const NODE_HEIGHT = 80

let svgElement = null
let graphRoot = null
let edgesLayer = null
let nodesLayer = null
let state = {
  transform: { tx: 0, ty: 0, scale: 1 },
  isPanning: false,
  panStart: { x: 0, y: 0 }
}

/**
 * Initialize the SVG renderer.
 * Mounts SVG into #editor-main and sets up zoom/pan.
 */
export function initRenderer(container) {
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
 * Initialize zoom and pan listeners
 */
function initZoomPan() {
  svgElement.addEventListener('wheel', (e) => {
    e.preventDefault()
    const scale = state.transform.scale
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    state.transform.scale = Math.max(0.2, Math.min(3, scale * delta))
    applyTransform()
  })

  svgElement.addEventListener('mousedown', (e) => {
    // Only pan on SVG background, not on interactive elements
    if (e.target === svgElement) {
      state.isPanning = true
      state.panStart = { x: e.clientX, y: e.clientY }
      svgElement.style.cursor = 'grabbing'
    }
  })

  document.addEventListener('mousemove', (e) => {
    if (state.isPanning) {
      const dx = e.clientX - state.panStart.x
      const dy = e.clientY - state.panStart.y
      state.transform.tx += dx
      state.transform.ty += dy
      state.panStart = { x: e.clientX, y: e.clientY }
      applyTransform()
    }
  })

  document.addEventListener('mouseup', () => {
    state.isPanning = false
    svgElement.style.cursor = 'grab'
  })
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
export function renderGraph(nodes, edges, positions) {
  if (!svgElement) return

  // Clear existing
  edgesLayer.innerHTML = ''
  nodesLayer.innerHTML = ''

  // Deduplicate PARTNER_OF edges (only draw one per pair)
  const drawnPartnerEdges = new Set()

  // Render edges first (so they appear behind nodes)
  for (const edge of Object.values(edges)) {
    if (edge.type === 'PARTNER_OF') {
      const key = [edge.from, edge.to].sort().join('-')
      if (drawnPartnerEdges.has(key)) continue
      drawnPartnerEdges.add(key)
    }
    renderEdge(edge, positions, nodes)
  }

  // Render nodes
  for (const [nodeId, node] of Object.entries(nodes)) {
    renderNode(node, positions)
  }

  applyTransform()
}

/**
 * Render a single node
 */
function renderNode(node, positions) {
  const pos = positions.get(node.id)
  if (!pos) return

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.classList.add('node', `node--${node.gender}`)
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
  genderIcon.setAttribute('y', '28')
  const genderSymbol = node.gender === 'M' ? '♂' : node.gender === 'F' ? '♀' : '⚬'
  genderIcon.textContent = genderSymbol

  // Name + Surname
  const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  nameText.classList.add('node-name')
  nameText.setAttribute('x', '80')
  nameText.setAttribute('y', '32')
  nameText.setAttribute('text-anchor', 'middle')
  nameText.textContent = `${node.name} ${node.surname}`.substring(0, 18)

  // Birth-Death dates
  const datesText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  datesText.classList.add('node-dates')
  datesText.setAttribute('x', '80')
  datesText.setAttribute('y', '52')
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
 * Render a single edge
 */
function renderEdge(edge, positions, nodes) {
  const fromPos = positions.get(edge.from)
  const toPos = positions.get(edge.to)
  if (!fromPos || !toPos) return

  if (edge.type === 'PARTNER_OF') {
    renderPartnerEdge(edge, fromPos, toPos)
  } else if (edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') {
    renderParentEdge(edge, fromPos, toPos)
  }
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
 * Render a CHILD_OF or ADOPTED_BY edge (vertical line from child to parents)
 */
function renderParentEdge(edge, fromPos, toPos) {
  const x1 = fromPos.x + NODE_WIDTH / 2
  const y1 = fromPos.y
  const x2 = toPos.x + NODE_WIDTH / 2
  const y2 = toPos.y + NODE_HEIGHT / 2

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
  line.classList.add('edge', edge.type === 'CHILD_OF' ? 'edge--child' : 'edge--adopted')
  line.setAttribute('x1', x1)
  line.setAttribute('y1', y1)
  line.setAttribute('x2', x2)
  line.setAttribute('y2', y2)
  line.setAttribute('stroke-width', '1.5')

  if (edge.type === 'ADOPTED_BY') {
    line.setAttribute('stroke-dasharray', '6,3')
  }

  edgesLayer.appendChild(line)
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
