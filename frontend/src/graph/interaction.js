// interaction.js — user actions, forms, graph mutations

let currentGetTree = null
let currentSaveTree = null
let currentUserRole = null
let currentOnActiveRootChange = null

/**
 * Bind all user interactions on the rendered SVG:
 * - Click on node → change active root + open sidebar
 * - Click on add-child-btn → add child to couple
 * - All mutations go through the onTreeChange callback
 */
export function bindInteractions(getTree, saveTree, userRole, onActiveRootChange) {
  currentGetTree = getTree
  currentSaveTree = saveTree
  currentUserRole = userRole
  currentOnActiveRootChange = onActiveRootChange

  const svg = document.getElementById('graph-svg')

  if (svg) {
    svg.addEventListener('click', async (e) => {
      // Handle node clicks
      const nodeEl = e.target.closest('.node')
      if (nodeEl) {
        const nodeId = nodeEl.getAttribute('data-id')
        const tree = currentGetTree()
        const node = tree.nodes[nodeId]
        if (node) {
          if (currentOnActiveRootChange) currentOnActiveRootChange(nodeId)
          openNodeSidebar(node, tree)
        }
        return
      }

      // Handle add-child button clicks
      const btnEl = e.target.closest('.add-child-btn')
      if (btnEl) {
        const parentAId = btnEl.getAttribute('data-from')
        const parentBId = btnEl.getAttribute('data-to')
        const tree = currentGetTree()

        const personData = await openPersonForm()
        if (!personData) return

        const updatedTree = addChild(tree, parentAId, parentBId, personData)
        await currentSaveTree(updatedTree)
        return
      }
    })
  }
}

/**
 * Show sidebar with node details and action buttons
 */
function openNodeSidebar(node, tree) {
  let sidebar = document.getElementById('sidebar')
  if (!sidebar) {
    sidebar = document.createElement('div')
    sidebar.setAttribute('id', 'sidebar')
    document.body.appendChild(sidebar)
  }

  const parents = countParents(tree, node.id)
  const canAddParents = parents < 2

  let html = `
    <button id="btn-close-sidebar" class="sidebar-close">&times;</button>
    <h3>${node.name} ${node.surname}</h3>
    <p class="sidebar-dates">${node.birth || '?'} – ${node.death || '?'}</p>
    <p class="sidebar-gender">${node.gender}</p>
    ${node.notes ? `<p class="sidebar-notes">${node.notes}</p>` : ''}
  `

  if (currentUserRole === 'viewer') {
    sidebar.innerHTML = html
  } else {
    html += `
      <div class="sidebar-actions">
        <button id="btn-edit-node" class="primary">Modifica</button>
        <button id="btn-add-partner" class="primary">Aggiungi partner</button>
        ${canAddParents ? `<button id="btn-add-parents" class="primary">Aggiungi genitori</button>` : ''}
        <button id="btn-delete-node" class="danger">Elimina</button>
      </div>
    `
    // Clear old content and set new
    sidebar.innerHTML = html

    // Attach event listeners (safe to re-attach since innerHTML cleared them)
    const editBtn = document.getElementById('btn-edit-node')
    const addPartnerBtn = document.getElementById('btn-add-partner')
    const deleteBtn = document.getElementById('btn-delete-node')
    const addParentsBtn = document.getElementById('btn-add-parents')

    if (editBtn) {
      editBtn.addEventListener('click', async () => {
        const personData = await openPersonForm(node)
        if (personData) {
          const updatedTree = updateNode(currentGetTree(), node.id, personData)
          await currentSaveTree(updatedTree)
          sidebar.style.display = 'none'
        }
      })
    }

    if (addPartnerBtn) {
      addPartnerBtn.addEventListener('click', async () => {
        const personData = await openPersonForm()
        if (personData) {
          const updatedTree = addPartner(currentGetTree(), node.id, personData)
          await currentSaveTree(updatedTree)
          sidebar.style.display = 'none'
        }
      })
    }

    if (addParentsBtn) {
      addParentsBtn.addEventListener('click', async () => {
        const fatherData = await openPersonForm(null, '1/2 – Aggiungi genitore 1')
        if (!fatherData) return
        const motherData = await openPersonForm(null, '2/2 – Aggiungi genitore 2')
        if (!motherData) return

        const updatedTree = addParents(currentGetTree(), node.id, fatherData, motherData)
        await currentSaveTree(updatedTree)
        sidebar.style.display = 'none'
      })
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Elimina ${node.name}?`)) {
          const updatedTree = removeNode(currentGetTree(), node.id)
          await currentSaveTree(updatedTree)
          sidebar.style.display = 'none'
        }
      })
    }
  }

  sidebar.style.display = 'block'

  // Close button
  document.getElementById('btn-close-sidebar').addEventListener('click', () => {
    sidebar.style.display = 'none'
  })

  // Click-outside to close (mouse and touch)
  function onClickOutside(e) {
    if (!sidebar.contains(e.target) && !e.target.closest('.node')) {
      sidebar.style.display = 'none'
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('touchstart', onClickOutside)
    }
  }
  // Defer so the current event doesn't immediately close it
  setTimeout(() => {
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('touchstart', onClickOutside)
  }, 0)
}

/**
 * Count how many parents a node has (CHILD_OF + ADOPTED_BY edges)
 */
function countParents(tree, nodeId) {
  let count = 0
  for (const edge of Object.values(tree.edges)) {
    if ((edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') && edge.from === nodeId) {
      count++
    }
  }
  return count
}

/**
 * Show the person modal pre-filled with data (or empty for new).
 * Returns a Promise that resolves to PersonNode data on confirm, null on cancel.
 */
export function openPersonForm(existing = null, title = null) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay')
    const form = document.getElementById('person-form')
    const titleEl = document.getElementById('modal-title')

    if (existing) {
      titleEl.textContent = title || 'Modifica persona'
      form.elements.name.value = existing.name
      form.elements.surname.value = existing.surname
      form.elements.birth.value = existing.birth || ''
      form.elements.death.value = existing.death || ''
      form.elements.gender.value = existing.gender
      form.elements.notes.value = existing.notes || ''
    } else {
      titleEl.textContent = title || 'Nuova persona'
      form.reset()
    }

    overlay.classList.remove('hidden')

    const handleSubmit = (e) => {
      e.preventDefault()
      const personData = {
        name: form.elements.name.value,
        surname: form.elements.surname.value,
        birth: form.elements.birth.value || undefined,
        death: form.elements.death.value || undefined,
        gender: form.elements.gender.value,
        notes: form.elements.notes.value || undefined
      }
      cleanup()
      resolve(personData)
    }

    const handleCancel = () => {
      cleanup()
      resolve(null)
    }

    const cleanup = () => {
      overlay.classList.add('hidden')
      form.removeEventListener('submit', handleSubmit)
      document.getElementById('modal-cancel').removeEventListener('click', handleCancel)
    }

    form.addEventListener('submit', handleSubmit)
    document.getElementById('modal-cancel').addEventListener('click', handleCancel)
  })
}

// ============================================================
// Pure graph mutation functions
// ============================================================

/**
 * Create root node (only when tree.nodes is empty)
 */
export function addRoot(tree, personData) {
  const nodeId = crypto.randomUUID()
  const node = {
    id: nodeId,
    ...personData
  }
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: node
    }
  }
}

/**
 * Add a partner for nodeId.
 * Creates PersonNode Y + PARTNER_OF X→Y + PARTNER_OF Y→X
 */
export function addPartner(tree, nodeId, personData) {
  const partnerId = crypto.randomUUID()
  const partnerNode = {
    id: partnerId,
    ...personData
  }

  const edge1Id = crypto.randomUUID()
  const edge2Id = crypto.randomUUID()

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [partnerId]: partnerNode
    },
    edges: {
      ...tree.edges,
      [edge1Id]: {
        id: edge1Id,
        type: 'PARTNER_OF',
        from: nodeId,
        to: partnerId
      },
      [edge2Id]: {
        id: edge2Id,
        type: 'PARTNER_OF',
        from: partnerId,
        to: nodeId
      }
    }
  }
}

/**
 * Add a child to a couple (parentAId, parentBId must have PARTNER_OF edge).
 * Precondition: symmetric PARTNER_OF pair must exist
 */
export function addChild(tree, parentAId, parentBId, personData) {
  const childId = crypto.randomUUID()
  const childNode = {
    id: childId,
    ...personData
  }

  const edge1Id = crypto.randomUUID()
  const edge2Id = crypto.randomUUID()

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [childId]: childNode
    },
    edges: {
      ...tree.edges,
      [edge1Id]: {
        id: edge1Id,
        type: 'CHILD_OF',
        from: childId,
        to: parentAId
      },
      [edge2Id]: {
        id: edge2Id,
        type: 'CHILD_OF',
        from: childId,
        to: parentBId
      }
    }
  }
}

/**
 * Add two parents to nodeId.
 * Creates father, mother, PARTNER_OF pair, and two CHILD_OF edges
 */
export function addParents(tree, nodeId, fatherData, motherData) {
  const fatherId = crypto.randomUUID()
  const motherId = crypto.randomUUID()

  const fatherNode = {
    id: fatherId,
    ...fatherData
  }

  const motherNode = {
    id: motherId,
    ...motherData
  }

  const partnerEdge1Id = crypto.randomUUID()
  const partnerEdge2Id = crypto.randomUUID()
  const childEdge1Id = crypto.randomUUID()
  const childEdge2Id = crypto.randomUUID()

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [fatherId]: fatherNode,
      [motherId]: motherNode
    },
    edges: {
      ...tree.edges,
      [partnerEdge1Id]: {
        id: partnerEdge1Id,
        type: 'PARTNER_OF',
        from: fatherId,
        to: motherId
      },
      [partnerEdge2Id]: {
        id: partnerEdge2Id,
        type: 'PARTNER_OF',
        from: motherId,
        to: fatherId
      },
      [childEdge1Id]: {
        id: childEdge1Id,
        type: 'CHILD_OF',
        from: nodeId,
        to: fatherId
      },
      [childEdge2Id]: {
        id: childEdge2Id,
        type: 'CHILD_OF',
        from: nodeId,
        to: motherId
      }
    }
  }
}

/**
 * Update a node with new data
 */
export function updateNode(tree, nodeId, personData) {
  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...tree.nodes[nodeId],
        ...personData
      }
    }
  }
}

/**
 * Remove a node and all its associated edges.
 * When removing a PARTNER_OF edge, also removes the symmetric edge.
 */
export function removeNode(tree, nodeId) {
  const newNodes = { ...tree.nodes }
  delete newNodes[nodeId]

  const newEdges = {}
  const edgesToRemove = new Set()

  // Find all edges involving this node
  for (const [edgeId, edge] of Object.entries(tree.edges)) {
    if (edge.from === nodeId || edge.to === nodeId) {
      edgesToRemove.add(edgeId)

      // If it's PARTNER_OF, also remove the symmetric edge
      if (edge.type === 'PARTNER_OF') {
        for (const [otherId, otherEdge] of Object.entries(tree.edges)) {
          if (
            otherEdge.type === 'PARTNER_OF' &&
            otherEdge.from === edge.to &&
            otherEdge.to === edge.from &&
            otherId !== edgeId
          ) {
            edgesToRemove.add(otherId)
          }
        }
      }
    }
  }

  // Copy all edges except those to remove
  for (const [edgeId, edge] of Object.entries(tree.edges)) {
    if (!edgesToRemove.has(edgeId)) {
      newEdges[edgeId] = edge
    }
  }

  return {
    ...tree,
    nodes: newNodes,
    edges: newEdges
  }
}
