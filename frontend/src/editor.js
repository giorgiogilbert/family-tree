// editor.js — coordinator for the tree editor page

import * as api from "./api.js"
import * as auth from "./auth.js"
import { initRenderer, renderGraph, highlightNode, clearHighlight, centerOnNode } from "./graph/renderer.js"
import { computeLayout } from "./graph/layout.js"
import { bindInteractions, addRoot, openPersonForm } from "./graph/interaction.js"

const MAX_DISTANCE = 3

let currentTree = null
let currentUserRole = null
let activeRootId = null

/**
 * Load the tree by id and initialize the SVG editor
 */
export async function renderEditor(treeId) {
  try {
    updateStatusLabel('Caricamento...')

    // Fetch tree from API
    currentTree = await api.getTree(treeId)

    // Get user role from tree members
    const user = auth.getCurrentUser()
    currentUserRole = currentTree.members?.[user.uid] || 'viewer'

    // Update page header
    document.getElementById('editor-tree-name').textContent = currentTree.name

    // Set up back button
    document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
      window.location.hash = '#/'
    })

    // Set up export button
    document.getElementById('btn-export')?.addEventListener('click', () => {
      exportTree(currentTree.id, currentTree.name)
    })

    // Set up back-to-root button
    document.getElementById('btn-back-root')?.addEventListener('click', () => {
      setActiveRoot(currentTree.rootId)
    })

    // Initialize SVG renderer
    const editorMain = document.getElementById('editor-main')
    initRenderer(editorMain)

    // Ensure rootId is set: fallback to first node if missing
    ensureRootId()

    // Set active root to tree root
    activeRootId = currentTree.rootId

    // Render visible subtree, centered on root
    renderVisible(true)

    // Show "add first person" button if tree is empty
    if (Object.keys(currentTree.nodes).length === 0 && currentUserRole !== 'viewer') {
      showEmptyTreeUI()
    }

    // Bind interactions
    bindInteractions(
      () => currentTree,
      onTreeChange,
      currentUserRole,
      setActiveRoot
    )

    updateStatusLabel('Salvato')
  } catch (error) {
    console.error('Error loading tree:', error)
    updateStatusLabel('Errore nel caricamento')
  }
}

/**
 * Change the active root and re-render the visible subtree, centering on the node
 */
function setActiveRoot(nodeId) {
  if (!currentTree.nodes[nodeId]) return
  activeRootId = nodeId
  renderVisible(true)
}

/**
 * Compute the visible subtree and render it.
 * If center=true, centers the viewport on the active root.
 */
function renderVisible(center = false) {
  updateActiveRootUI()

  const visibleNodeIds = getVisibleNodeIds()
  const filtered = filterTree(currentTree, visibleNodeIds)
  const { hiddenEdges, hiddenChildCouples } = getHiddenEdgeInfo(visibleNodeIds)

  const positions = computeLayout(filtered)
  renderGraph(filtered.nodes, filtered.edges, positions, activeRootId, hiddenEdges, hiddenChildCouples)

  if (center && activeRootId) {
    centerOnNode(activeRootId, positions)
  }
}

/**
 * BFS from activeRootId, return set of nodeIds at distance <= MAX_DISTANCE.
 * Distance counts edges (PARTNER_OF, CHILD_OF, ADOPTED_BY all count as 1).
 */
function getVisibleNodeIds() {
  if (!activeRootId || !currentTree.nodes[activeRootId]) {
    return new Set(Object.keys(currentTree.nodes))
  }

  // Build undirected adjacency list
  const adj = new Map()
  for (const nodeId of Object.keys(currentTree.nodes)) {
    adj.set(nodeId, [])
  }
  for (const edge of Object.values(currentTree.edges)) {
    if (adj.has(edge.from) && adj.has(edge.to)) {
      adj.get(edge.from).push(edge.to)
      adj.get(edge.to).push(edge.from)
    }
  }

  const visited = new Map() // nodeId → distance
  const queue = [{ id: activeRootId, dist: 0 }]
  visited.set(activeRootId, 0)

  while (queue.length > 0) {
    const { id, dist } = queue.shift()
    if (dist >= MAX_DISTANCE) continue

    for (const neighbor of (adj.get(id) || [])) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, dist + 1)
        queue.push({ id: neighbor, dist: dist + 1 })
      }
    }
  }

  return new Set(visited.keys())
}

/**
 * Return a tree containing only the visible nodes and edges between them
 */
function filterTree(tree, visibleNodeIds) {
  const nodes = {}
  for (const id of visibleNodeIds) {
    if (tree.nodes[id]) nodes[id] = tree.nodes[id]
  }

  const edges = {}
  for (const [edgeId, edge] of Object.entries(tree.edges)) {
    if (visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)) {
      edges[edgeId] = edge
    }
  }

  return { ...tree, nodes, edges }
}

/**
 * Compute hidden-edge info for the renderer.
 * Returns:
 *   hiddenEdges: Map<nodeId, { up, down, side }> — per-node stub directions
 *   hiddenChildCouples: Set<parentKey> — parent pairs that have visible AND hidden children
 *     (these get a dashed rail extension instead of individual down stubs)
 */
function getHiddenEdgeInfo(visibleNodeIds) {
  const hiddenEdges = new Map()
  const allEdges = Object.values(currentTree.edges)

  // Build child → parentIds map from FULL tree
  const childParents = new Map()
  for (const edge of allEdges) {
    if (edge.type !== 'CHILD_OF' && edge.type !== 'ADOPTED_BY') continue
    if (!childParents.has(edge.from)) childParents.set(edge.from, [])
    childParents.get(edge.from).push(edge.to)
  }

  // Group children by parent pair, split into visible/hidden
  const coupleChildren = new Map() // parentKey → { parentIds, hasVisible, hasHidden }
  for (const [childId, parents] of childParents) {
    const key = [...parents].sort().join(',')
    if (!coupleChildren.has(key)) coupleChildren.set(key, { parentIds: parents, hasVisible: false, hasHidden: false })
    const info = coupleChildren.get(key)
    if (visibleNodeIds.has(childId)) info.hasVisible = true
    else info.hasHidden = true
  }

  // Couples where both parents are visible AND have both visible+hidden children → rail extension
  const hiddenChildCouples = new Set()
  for (const [key, info] of coupleChildren) {
    if (info.hasVisible && info.hasHidden && info.parentIds.every(id => visibleNodeIds.has(id))) {
      hiddenChildCouples.add(key)
    }
  }

  // Per-node hidden edge directions
  for (const edge of allEdges) {
    const fromVisible = visibleNodeIds.has(edge.from)
    const toVisible = visibleNodeIds.has(edge.to)
    if (fromVisible === toVisible) continue

    if (edge.type === 'PARTNER_OF') {
      const visibleId = fromVisible ? edge.from : edge.to
      if (!hiddenEdges.has(visibleId)) hiddenEdges.set(visibleId, { up: false, down: false, side: false })
      hiddenEdges.get(visibleId).side = true
    } else if (edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') {
      if (fromVisible) {
        // child visible, parent hidden → stub UP
        if (!hiddenEdges.has(edge.from)) hiddenEdges.set(edge.from, { up: false, down: false, side: false })
        hiddenEdges.get(edge.from).up = true
      } else {
        // child hidden, parent visible → check if covered by couple rail extension
        const parents = childParents.get(edge.from) || []
        const key = [...parents].sort().join(',')
        if (!hiddenChildCouples.has(key)) {
          // Not covered → individual down stub
          if (!hiddenEdges.has(edge.to)) hiddenEdges.set(edge.to, { up: false, down: false, side: false })
          hiddenEdges.get(edge.to).down = true
        }
      }
    }
  }

  return { hiddenEdges, hiddenChildCouples }
}

/**
 * Update the header to show active root name and back button
 */
function updateActiveRootUI() {
  const activeRootEl = document.getElementById('editor-active-root')
  const backRootBtn = document.getElementById('btn-back-root')

  if (!activeRootId || !currentTree.nodes[activeRootId]) {
    if (activeRootEl) activeRootEl.textContent = ''
    if (backRootBtn) backRootBtn.classList.add('hidden')
    return
  }

  const activeNode = currentTree.nodes[activeRootId]
  if (activeRootEl) {
    activeRootEl.textContent = `Albero di ${activeNode.name} ${activeNode.surname}`
  }

  // Show back button only if active root differs from tree root
  if (backRootBtn) {
    if (activeRootId !== currentTree.rootId && currentTree.rootId && currentTree.nodes[currentTree.rootId]) {
      const rootNode = currentTree.nodes[currentTree.rootId]
      backRootBtn.textContent = `Torna a ${rootNode.name} ${rootNode.surname}`
      backRootBtn.classList.remove('hidden')
    } else {
      backRootBtn.classList.add('hidden')
    }
  }
}

/**
 * Show UI for adding the first person to an empty tree
 */
function showEmptyTreeUI() {
  const svg = document.getElementById('graph-svg')
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('id', 'empty-tree-ui')

  // Calculate center of the visible SVG viewport
  const rect = svg.getBoundingClientRect()
  const centerX = rect.width / 2
  const centerY = rect.height / 2

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', centerX)
  text.setAttribute('y', centerY - 40)
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('class', 'empty-tree-text')
  text.textContent = 'Albero vuoto'

  const btn = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  btn.setAttribute('id', 'btn-add-root')
  btn.style.cursor = 'pointer'
  btn.setAttribute('transform', `translate(${centerX}, ${centerY + 20})`)

  const btnRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  btnRect.setAttribute('x', '-60')
  btnRect.setAttribute('y', '-15')
  btnRect.setAttribute('width', '120')
  btnRect.setAttribute('height', '30')
  btnRect.setAttribute('rx', '4')
  btnRect.setAttribute('class', 'empty-tree-btn')

  const btnText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  btnText.setAttribute('text-anchor', 'middle')
  btnText.setAttribute('dy', '0.3em')
  btnText.setAttribute('class', 'empty-tree-btn-text')
  btnText.textContent = 'Aggiungi prima persona'

  btn.appendChild(btnRect)
  btn.appendChild(btnText)

  g.appendChild(text)
  g.appendChild(btn)
  svg.appendChild(g)

  btn.addEventListener('click', async () => {
    const personData = await openPersonForm()
    if (personData) {
      currentTree = addRoot(currentTree, personData)
      // Set rootId to the newly created node
      const newNodeId = Object.keys(currentTree.nodes)[0]
      currentTree = { ...currentTree, rootId: newNodeId }
      activeRootId = newNodeId
      document.getElementById('empty-tree-ui')?.remove()
      await onTreeChange(currentTree)
    }
  })
}

/**
 * Callback invoked when interaction.js mutates the tree.
 * Re-renders the graph and auto-saves.
 */
async function onTreeChange(updatedTree) {
  currentTree = updatedTree
  ensureRootId()

  // If active root was deleted, fall back to tree root
  if (!currentTree.nodes[activeRootId]) {
    activeRootId = currentTree.rootId
  }

  // Re-render
  renderVisible()

  try {
    updateStatusLabel('Salvataggio...')
    await api.saveTree(currentTree.id, currentTree)
    // Increment version locally after successful save
    currentTree = { ...currentTree, version: currentTree.version + 1 }
    updateStatusLabel('Salvato')
  } catch (error) {
    if (error.code === 'CONFLICT') {
      updateStatusLabel('Conflitto ⚠')
      if (confirm('L\'albero è stato modificato da un\'altra sessione. Ricaricare?')) {
        window.location.reload()
      }
    } else {
      console.error('Error saving tree:', error)
      updateStatusLabel('Errore nel salvataggio')
    }
  }
}

/**
 * If rootId is missing or points to a deleted node, set it to the first node.
 * The updated rootId will be persisted on the next save.
 */
function ensureRootId() {
  const nodeIds = Object.keys(currentTree.nodes)
  if (nodeIds.length === 0) return

  if (!currentTree.rootId || !currentTree.nodes[currentTree.rootId]) {
    currentTree = { ...currentTree, rootId: nodeIds[0] }
  }
}

/**
 * Update the status label in the header
 */
function updateStatusLabel(text) {
  let statusEl = document.getElementById('save-status')
  if (!statusEl) {
    statusEl = document.createElement('span')
    statusEl.setAttribute('id', 'save-status')
    const header = document.querySelector('header')
    if (header) {
      header.appendChild(statusEl)
    }
  }
  statusEl.textContent = text
}

/**
 * Export tree as JSON
 */
async function exportTree(treeId, treeName) {
  try {
    const data = await api.exportTree(treeId)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${treeName}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exporting tree:', error)
    alert('Errore nell\'esportazione: ' + error.message)
  }
}
