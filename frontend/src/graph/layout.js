// layout.js — automatic generational layout

const NODE_WIDTH = 220
const NODE_HEIGHT = 110
const H_GAP = 30
const V_GAP = 140

const GENERATION_Y = (g) => 60 + g * (NODE_HEIGHT + V_GAP)

/**
 * Compute (x, y) positions for every node in the tree.
 * Layout strategy:
 * - Y axis = generation (parents above children)
 * - X axis = horizontal distribution within each generation
 * - Partners placed side by side on the same Y
 * Returns a Map<nodeId, { x, y }>
 */
export function computeLayout(tree) {
  if (Object.keys(tree.nodes).length === 0) {
    return new Map()
  }

  const generations = assignGenerations(tree)
  const positions = new Map()
  const edges = Object.values(tree.edges)

  // ── helpers ──────────────────────────────────────────────
  function getParents(nodeId) {
    const out = []
    for (const e of edges) {
      if ((e.type === 'CHILD_OF' || e.type === 'ADOPTED_BY') && e.from === nodeId) out.push(e.to)
    }
    return out
  }

  function getPartnerInGen(nodeId, nodeIds) {
    for (const e of edges) {
      if (e.type === 'PARTNER_OF' && e.from === nodeId && nodeIds.includes(e.to)) return e.to
    }
    return null
  }

  function getPartnersInGen(nodeId, nodeIds) {
    const partners = []
    const seen = new Set()
    for (const e of edges) {
      if (e.type === 'PARTNER_OF' && e.from === nodeId && nodeIds.includes(e.to) && !seen.has(e.to)) {
        partners.push(e.to)
        seen.add(e.to)
      }
    }
    return partners
  }

  // ── Step 1: group by generation ─────────────────────────
  const genGroups = {}
  for (const [nodeId, gen] of generations.entries()) {
    if (!genGroups[gen]) genGroups[gen] = []
    genGroups[gen].push(nodeId)
  }
  const sortedGens = Object.keys(genGroups).map(Number).sort((a, b) => a - b)

  // ── Step 2: order every generation ──────────────────────
  // Chain traversal: follow partner → siblings → partner → siblings.
  // Start from a node without parents (external person) so it ends up leftmost.
  // This naturally produces: Anna → Giuseppe (partner) → Giorgio (sibling) → Ilary (partner) → Danny (sibling)
  function orderGeneration(gen) {
    const nodeIds = genGroups[gen]

    // Build sibling map (nodes sharing at least one parent)
    const siblingMap = new Map() // nodeId → [siblingIds]
    for (const nodeId of nodeIds) {
      const parents = getParents(nodeId)
      if (parents.length === 0) continue
      const parentKey = parents.sort().join(',')
      for (const otherId of nodeIds) {
        if (otherId === nodeId) continue
        const otherParents = getParents(otherId)
        if (otherParents.length > 0 && otherParents.sort().join(',') === parentKey) {
          if (!siblingMap.has(nodeId)) siblingMap.set(nodeId, [])
          siblingMap.get(nodeId).push(otherId)
        }
      }
    }

    // Build partner map (within this generation) — supports multiple partners
    const partnersMap = new Map()
    for (const nodeId of nodeIds) {
      const partners = getPartnersInGen(nodeId, nodeIds)
      if (partners.length > 0) partnersMap.set(nodeId, partners)
    }

    // Pick starting node: prefer chain endpoint (external with exactly 1 partner)
    // Among endpoints, pick the one with the longest chain to a sibling node
    let startNode = null
    const externalEndpoints = nodeIds.filter(id =>
      getParents(id).length === 0 &&
      partnersMap.has(id) &&
      (partnersMap.get(id) || []).length === 1
    )
    if (externalEndpoints.length > 0) {
      let bestDist = -1
      for (const ep of externalEndpoints) {
        let dist = 0
        let current = ep
        const seen = new Set()
        while (current) {
          seen.add(current)
          dist++
          if (siblingMap.has(current)) break
          const partners = partnersMap.get(current) || []
          current = partners.find(p => !seen.has(p)) || null
        }
        if (dist > bestDist) {
          bestDist = dist
          startNode = ep
        }
      }
    }
    if (!startNode) startNode = nodeIds.find(id => getParents(id).length === 0 && partnersMap.has(id))
    if (!startNode) startNode = nodeIds.find(id => getParents(id).length === 0)
    if (!startNode) startNode = nodeIds[0]

    // Chain traversal: visit all partners, then siblings, recursively
    const ordered = []
    const visited = new Set()

    function visit(nodeId) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      ordered.push(nodeId)

      // Follow all partners
      const partners = partnersMap.get(nodeId) || []
      for (const partner of partners) {
        if (!visited.has(partner)) {
          visit(partner)
        }
      }

      // Follow siblings
      const siblings = siblingMap.get(nodeId) || []
      for (const sib of siblings) {
        if (!visited.has(sib)) {
          visit(sib)
        }
      }
    }

    visit(startNode)

    // Add any remaining unvisited nodes (disconnected from chain)
    for (const nodeId of nodeIds) {
      if (!visited.has(nodeId)) {
        visit(nodeId)
      }
    }

    return ordered
  }

  // ── Step 3: find widest generation ──────────────────────
  let widestGen = sortedGens[0]
  for (const gen of sortedGens) {
    if (genGroups[gen].length > genGroups[widestGen].length) widestGen = gen
  }

  const columnWidth = NODE_WIDTH + H_GAP
  const maxGenSize = genGroups[widestGen].length
  const treeLeftEdge = 500 - (maxGenSize * columnWidth) / 2

  // Helper: find children of a node
  function getChildren(nodeId) {
    const out = []
    for (const e of edges) {
      if ((e.type === 'CHILD_OF' || e.type === 'ADOPTED_BY') && e.to === nodeId) out.push(e.from)
    }
    return out
  }

  // ── Step 4: Position top-down ─────────────────────────
  // Process generations from top (gen 0) to bottom.
  // The widest generation gets constant spacing; all others center on relatives.

  // Helper: order nodes for a non-top generation using already-positioned parents.
  // Strategy: build sibling groups, then merge groups connected by couples into
  // clusters. Within each cluster, traverse: sibling → partner (from other group)
  // → partner's siblings → their partners → etc. Sort clusters by parent centroid.
  function orderByParentPosition(gen) {
    const nodeIds = genGroups[gen]

    // Build sibling groups (nodes sharing same parents)
    const siblingGroups = [] // [{key, parentIds, childIds}]
    const nodeToGroup = new Map() // nodeId → group index
    for (const nodeId of nodeIds) {
      const parents = getParents(nodeId)
      if (parents.length === 0) continue
      const key = [...parents].sort().join(',')
      let groupIdx = siblingGroups.findIndex(g => g.key === key)
      if (groupIdx === -1) {
        groupIdx = siblingGroups.length
        siblingGroups.push({ key, parentIds: parents, childIds: [] })
      }
      siblingGroups[groupIdx].childIds.push(nodeId)
      nodeToGroup.set(nodeId, groupIdx)
    }

    // Build partner map within this generation — supports multiple partners
    const partnersOf = new Map() // nodeId → [partnerIds]
    for (const nodeId of nodeIds) {
      const partners = getPartnersInGen(nodeId, nodeIds)
      if (partners.length > 0) partnersOf.set(nodeId, partners)
    }

    // Merge sibling groups into clusters connected by partner edges.
    // A cluster is a chain of groups: groupA ←partner→ groupB ←partner→ groupC
    const groupVisited = new Set()
    const clusters = [] // [{groupIndices: [...], centroid}]

    for (let gi = 0; gi < siblingGroups.length; gi++) {
      if (groupVisited.has(gi)) continue
      const clusterGroups = []
      const queue = [gi]
      groupVisited.add(gi)
      while (queue.length > 0) {
        const idx = queue.shift()
        clusterGroups.push(idx)
        // Find partner connections to other groups
        for (const childId of siblingGroups[idx].childIds) {
          const partners = partnersOf.get(childId) || []
          for (const partner of partners) {
            if (nodeToGroup.has(partner)) {
              const partnerGroup = nodeToGroup.get(partner)
              if (!groupVisited.has(partnerGroup)) {
                groupVisited.add(partnerGroup)
                queue.push(partnerGroup)
              }
            }
          }
        }
      }
      clusters.push({ groupIndices: clusterGroups })
    }

    // Sort clusters by average parent centroid
    clusters.sort((a, b) => {
      const allParentsA = a.groupIndices.flatMap(gi => siblingGroups[gi].parentIds)
      const allParentsB = b.groupIndices.flatMap(gi => siblingGroups[gi].parentIds)
      return avgX(allParentsA) - avgX(allParentsB)
    })

    // Within each cluster, produce chain order by visiting groups one at a time.
    // Within each group: entry sibling first (connects to previous group),
    // then non-connecting siblings, then exit sibling last (connects to next group).
    // This keeps siblings together and connecting partners adjacent across groups.
    const ordered = []
    const placed = new Set()

    for (const cluster of clusters) {
      // Sort groups in cluster by parent centroid (left to right)
      const sortedGroupIdxs = [...cluster.groupIndices].sort((a, b) => {
        return avgX(siblingGroups[a].parentIds) - avgX(siblingGroups[b].parentIds)
      })

      // BFS at group level to determine traversal order
      const groupOrder = []
      const visitedGroups = new Set()
      const entryOf = new Map() // groupIdx → nodeId in that group that connects to previous group
      const groupQueue = [sortedGroupIdxs[0]]
      visitedGroups.add(sortedGroupIdxs[0])

      while (groupQueue.length > 0) {
        const gi = groupQueue.shift()
        groupOrder.push(gi)
        for (const sib of siblingGroups[gi].childIds) {
          const partners = partnersOf.get(sib) || []
          for (const partner of partners) {
            const pgi = nodeToGroup.get(partner)
            if (pgi !== undefined && !visitedGroups.has(pgi)) {
              visitedGroups.add(pgi)
              groupQueue.push(pgi)
              entryOf.set(pgi, partner) // partner is the entry sibling in the next group
            }
          }
        }
      }

      // Add any unvisited groups in cluster
      for (const gi of sortedGroupIdxs) {
        if (!visitedGroups.has(gi)) groupOrder.push(gi)
      }

      // Emit nodes for each group in order
      for (let q = 0; q < groupOrder.length; q++) {
        const gi = groupOrder[q]
        const siblings = siblingGroups[gi].childIds
        const entrySib = entryOf.get(gi) || null // sibling connecting to previous group

        // Find exit siblings: those whose partner is in a later group in groupOrder
        const exitSibs = new Set()
        for (const sib of siblings) {
          const partners = partnersOf.get(sib) || []
          for (const partner of partners) {
            const pgi = nodeToGroup.get(partner)
            if (pgi !== undefined && groupOrder.indexOf(pgi) > q) {
              exitSibs.add(sib)
            }
          }
        }

        // Order: entry first, then middle siblings, then exit last
        if (entrySib && !placed.has(entrySib)) {
          placed.add(entrySib); ordered.push(entrySib)
        }
        for (const sib of siblings) {
          if (sib === entrySib || exitSibs.has(sib) || placed.has(sib)) continue
          placed.add(sib); ordered.push(sib)
        }
        for (const sib of siblings) {
          if (exitSibs.has(sib) && !placed.has(sib)) {
            placed.add(sib); ordered.push(sib)
          }
        }
      }
    }

    // Add external partners (no parents) on the OUTER side of their sibling group.
    // If the node is the first of its siblings in the chain → partner LEFT.
    // If the node is the last of its siblings → partner RIGHT.
    // Build a map: for each node, is it the first or last sibling encountered in `ordered`?
    const siblingPosition = new Map() // nodeId → 'first' | 'last' | 'middle'
    const groupFirstSeen = new Map()  // groupIdx → first nodeId in ordered
    const groupLastSeen = new Map()   // groupIdx → last nodeId in ordered
    for (const nodeId of ordered) {
      const gi = nodeToGroup.get(nodeId)
      if (gi === undefined) continue
      if (!groupFirstSeen.has(gi)) groupFirstSeen.set(gi, nodeId)
      groupLastSeen.set(gi, nodeId)
    }
    for (const nodeId of ordered) {
      const gi = nodeToGroup.get(nodeId)
      if (gi === undefined) continue
      if (groupFirstSeen.get(gi) === nodeId && groupLastSeen.get(gi) === nodeId) {
        siblingPosition.set(nodeId, 'only') // sole sibling
      } else if (groupFirstSeen.get(gi) === nodeId) {
        siblingPosition.set(nodeId, 'first')
      } else if (groupLastSeen.get(gi) === nodeId) {
        siblingPosition.set(nodeId, 'last')
      } else {
        siblingPosition.set(nodeId, 'middle')
      }
    }

    // Helper: collect chain of external nodes starting from startId,
    // following partner edges through nodes that are also external (no parents)
    function collectExternalChain(startId) {
      const chain = []
      let current = startId
      const seen = new Set()
      while (current && !nodeToGroup.has(current) && !seen.has(current)) {
        seen.add(current)
        chain.push(current)
        const partners = (partnersOf.get(current) || [])
          .filter(p => !nodeToGroup.has(p) && !seen.has(p))
        current = partners[0] || null
      }
      return chain
    }

    const finalOrdered = []
    const finalPlaced = new Set()
    for (const nodeId of ordered) {
      const partners = partnersOf.get(nodeId) || []
      const externals = partners.filter(p => !nodeToGroup.has(p) && !finalPlaced.has(p))
      const pos = siblingPosition.get(nodeId)

      // External partner goes LEFT if node is first/only in its group
      // Chain through external partners so e.g. Guascone-Sabrina both go left of Dario
      if (externals.length > 0 && (pos === 'first' || pos === 'only')) {
        const chain = collectExternalChain(externals[0])
        // Insert reversed so furthest external is leftmost
        for (let i = chain.length - 1; i >= 0; i--) {
          if (!finalPlaced.has(chain[i])) {
            finalOrdered.push(chain[i])
            finalPlaced.add(chain[i])
          }
        }
      }

      finalPlaced.add(nodeId)
      finalOrdered.push(nodeId)

      // Remaining external partners go RIGHT (with chaining)
      for (const ext of externals) {
        if (!finalPlaced.has(ext)) {
          const chain = collectExternalChain(ext)
          for (const c of chain) {
            if (!finalPlaced.has(c)) {
              finalOrdered.push(c)
              finalPlaced.add(c)
            }
          }
        }
      }
    }

    // Add any remaining unplaced nodes (disconnected, no parents, no partner link)
    for (const nodeId of nodeIds) {
      if (!finalPlaced.has(nodeId)) {
        finalOrdered.push(nodeId)
        finalPlaced.add(nodeId)
      }
    }

    return finalOrdered
  }

  // Helper: average x of already-positioned nodes
  function avgX(nodeIds) {
    const xs = nodeIds.map(id => positions.get(id)).filter(Boolean).map(p => p.x)
    if (xs.length === 0) return 0
    return xs.reduce((a, b) => a + b) / xs.length
  }

  // Helper: sort a subset of nodeIds within a generation by chain traversal
  // (partner first, then siblings)
  function chainSort(subsetIds, allGenIds) {
    if (subsetIds.length <= 1) return subsetIds
    const subset = new Set(subsetIds)
    const partnersMap = new Map()
    for (const nodeId of subsetIds) {
      const partners = getPartnersInGen(nodeId, allGenIds).filter(p => subset.has(p))
      if (partners.length > 0) partnersMap.set(nodeId, partners)
    }
    // Start from first node without a partner in subset, or first node
    let start = subsetIds.find(id => !partnersMap.has(id)) || subsetIds[0]
    const result = []
    const visited = new Set()
    function visit(id) {
      if (!subset.has(id) || visited.has(id)) return
      visited.add(id)
      result.push(id)
      const partners = partnersMap.get(id) || []
      for (const partner of partners) visit(partner)
    }
    visit(start)
    for (const id of subsetIds) {
      if (!visited.has(id)) { visited.add(id); result.push(id) }
    }
    return result
  }

  // Position a generation using already-positioned parents above
  function positionGenFromParents(gen) {
    const ordered = orderByParentPosition(gen)
    const y = GENERATION_Y(gen)
    const isWidest = gen === widestGen

    // Compute desired x: center sibling groups under parent centroid
    const desiredX = new Map()
    const siblingGroups = []
    for (const nodeId of ordered) {
      const parents = getParents(nodeId)
      if (parents.length > 0) {
        const key = [...parents].sort().join(',')
        let group = siblingGroups.find(g => g.key === key)
        if (!group) {
          group = { key, parentIds: parents, childIds: [] }
          siblingGroups.push(group)
        }
        group.childIds.push(nodeId)
      }
    }

    for (const group of siblingGroups) {
      const parentXs = group.parentIds.map(id => positions.get(id)).filter(Boolean).map(p => p.x)
      if (parentXs.length === 0) continue
      const parentCentroid = parentXs.reduce((a, b) => a + b) / parentXs.length
      const n = group.childIds.length
      const startX = parentCentroid - ((n - 1) * columnWidth) / 2
      for (let i = 0; i < n; i++) {
        desiredX.set(group.childIds[i], startX + i * columnWidth)
      }
    }

    // For nodes without parents, position relative to their partner
    for (const nodeId of ordered) {
      if (desiredX.has(nodeId)) continue
      const partners = getPartnersInGen(nodeId, genGroups[gen])
      const positionedPartner = partners.find(p => desiredX.has(p))
      if (positionedPartner) {
        // Place on whichever side keeps the order from `ordered`
        const myIdx = ordered.indexOf(nodeId)
        const partnerIdx = ordered.indexOf(positionedPartner)
        if (myIdx < partnerIdx) {
          desiredX.set(nodeId, desiredX.get(positionedPartner) - columnWidth)
        } else {
          desiredX.set(nodeId, desiredX.get(positionedPartner) + columnWidth)
        }
      }
    }

    if (isWidest) {
      // Widest generation: use chain traversal for ordering (better when most
      // nodes lack positioned parents) with constant spacing
      const widestOrder = orderGeneration(gen)
      for (let i = 0; i < widestOrder.length; i++) {
        positions.set(widestOrder[i], { x: treeLeftEdge + i * columnWidth, y })
      }
    } else {
      // Non-widest: use desired x with collision avoidance
      let minNextX = -Infinity
      for (const nodeId of ordered) {
        let x = desiredX.get(nodeId)
        if (x === undefined) x = minNextX === -Infinity ? treeLeftEdge : minNextX
        if (x < minNextX) x = minNextX
        positions.set(nodeId, { x, y })
        minNextX = x + columnWidth
      }
    }
  }

  // Position a generation ABOVE already-positioned children (bottom-up)
  function positionGenFromChildren(gen) {
    const nodeIds = genGroups[gen]
    const y = GENERATION_Y(gen)

    // Group into parent couples/triples/singles based on shared children
    const parentGroups = []
    const assigned = new Set()
    for (const nodeId of nodeIds) {
      if (assigned.has(nodeId)) continue
      const children = getChildren(nodeId).filter(cid => positions.has(cid))
      const partners = getPartnersInGen(nodeId, nodeIds).filter(p => !assigned.has(p))
      if (partners.length === 2) {
        // Node with 2 partners: partner1 - node - partner2
        const allChildren = [...children]
        for (const p of partners) {
          for (const c of getChildren(p).filter(cid => positions.has(cid))) {
            if (!allChildren.includes(c)) allChildren.push(c)
          }
        }
        parentGroups.push({ nodeIds: [partners[0], nodeId, partners[1]], children: allChildren })
        assigned.add(nodeId)
        assigned.add(partners[0])
        assigned.add(partners[1])
      } else if (partners.length === 1) {
        const allChildren = [...children]
        for (const c of getChildren(partners[0]).filter(cid => positions.has(cid))) {
          if (!allChildren.includes(c)) allChildren.push(c)
        }
        parentGroups.push({ nodeIds: [nodeId, partners[0]], children: allChildren })
        assigned.add(nodeId)
        assigned.add(partners[0])
      } else {
        parentGroups.push({ nodeIds: [nodeId], children })
        assigned.add(nodeId)
      }
    }

    // Compute desired x: center parent group over children centroid
    const desiredX = new Map()
    for (const group of parentGroups) {
      const childXs = (group.children || []).map(cid => positions.get(cid)).filter(Boolean).map(p => p.x)
      if (childXs.length > 0) {
        const childCentroid = childXs.reduce((a, b) => a + b) / childXs.length
        const n = group.nodeIds.length
        const startX = childCentroid - ((n - 1) * columnWidth) / 2
        for (let i = 0; i < n; i++) {
          desiredX.set(group.nodeIds[i], startX + i * columnWidth)
        }
      }
    }

    // Sort parent groups by desired x, then flatten
    parentGroups.sort((a, b) => {
      const xa = Math.min(...a.nodeIds.map(id => desiredX.get(id) ?? Infinity))
      const xb = Math.min(...b.nodeIds.map(id => desiredX.get(id) ?? Infinity))
      return xa - xb
    })
    const ordered = parentGroups.flatMap(g => g.nodeIds)

    // Place with collision avoidance
    let minNextX = -Infinity
    for (const nodeId of ordered) {
      let x = desiredX.get(nodeId)
      if (x === undefined) x = minNextX === -Infinity ? treeLeftEdge : minNextX
      if (x < minNextX) x = minNextX
      positions.set(nodeId, { x, y })
      minNextX = x + columnWidth
    }
  }

  // ── Execution order ───────────────────────────────────
  // 1. Position generations above widest, top-down (gen 0 first)
  const gensAboveTopDown = sortedGens.filter(g => g < widestGen)  // [0, 1, ...] ascending
  // But we need gen 0 positioned first. Gen 0 has no parents above, so use chain order.
  // For gen 0 (topmost): just use chain ordering with constant spacing
  if (gensAboveTopDown.length > 0) {
    // Position topmost generation first with chain ordering
    const topGen = gensAboveTopDown[0]
    const topOrdered = orderGeneration(topGen)
    const topY = GENERATION_Y(topGen)
    const topWidth = topOrdered.length
    const topLeftEdge = 500 - (topWidth * columnWidth) / 2
    for (let i = 0; i < topOrdered.length; i++) {
      positions.set(topOrdered[i], { x: topLeftEdge + i * columnWidth, y: topY })
    }
    // Position remaining gens above widest, top-down
    for (let i = 1; i < gensAboveTopDown.length; i++) {
      positionGenFromParents(gensAboveTopDown[i])
    }
  }

  // 2. Position widest generation (using parent positions if available)
  if (gensAboveTopDown.length > 0) {
    // Parents are positioned, so order widest by parent position
    positionGenFromParents(widestGen)
  } else {
    // No parents above — widest is the topmost, use chain ordering
    const widestOrder = orderGeneration(widestGen)
    const widestY = GENERATION_Y(widestGen)
    for (let i = 0; i < widestOrder.length; i++) {
      positions.set(widestOrder[i], { x: treeLeftEdge + i * columnWidth, y: widestY })
    }
  }

  // 3. Position generations below widest, top-down
  const gensBelow = sortedGens.filter(g => g > widestGen)
  for (const gen of gensBelow) positionGenFromParents(gen)

  // 4. Position any generations above widest that don't have parents (bottom-up pass)
  //    This handles the case where topmost gen needs to center over its children
  //    Re-position gens above widest bottom-up using children positions
  const gensAboveBottomUp = sortedGens.filter(g => g < widestGen).reverse() // descending
  for (const gen of gensAboveBottomUp) positionGenFromChildren(gen)

  return positions
}

/**
 * Assign generation numbers to each node.
 * Generation = max(parent generations) + 1
 * For root nodes: generation = 0
 * Partners always get the same generation (take max to align with children)
 */
function assignGenerations(tree) {
  const generations = new Map()
  const unprocessed = new Set(Object.keys(tree.nodes))

  // First pass: iteratively assign generations based on parents
  let changed = true
  while (changed && unprocessed.size > 0) {
    changed = false

    for (const nodeId of unprocessed) {
      const parentEdges = []
      for (const edge of Object.values(tree.edges)) {
        if ((edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') && edge.from === nodeId) {
          parentEdges.push(edge.to)
        }
      }

      if (parentEdges.length === 0) {
        // Root node (no parents)
        generations.set(nodeId, 0)
        unprocessed.delete(nodeId)
        changed = true
      } else if (parentEdges.every(parentId => generations.has(parentId))) {
        // All parents assigned, so assign this node
        const parentGens = parentEdges.map(parentId => generations.get(parentId))
        const maxParentGen = Math.max(...parentGens)
        generations.set(nodeId, maxParentGen + 1)
        unprocessed.delete(nodeId)
        changed = true
      }
    }
  }

  // Handle any remaining unprocessed nodes (disconnected from parent chain)
  for (const nodeId of unprocessed) {
    generations.set(nodeId, 0)
  }

  // Second pass: ensure partners have the same generation
  // Partners take the max generation to align with children properly
  for (const edge of Object.values(tree.edges)) {
    if (edge.type === 'PARTNER_OF') {
      const gen1 = generations.get(edge.from)
      const gen2 = generations.get(edge.to)
      if (gen1 !== gen2) {
        const maxGen = Math.max(gen1, gen2)
        generations.set(edge.from, maxGen)
        generations.set(edge.to, maxGen)
      }
    }
  }

  // Third pass: ensure siblings (children of the same parents) share the same generation.
  // If a sibling was bumped (e.g. by partner alignment), bump all siblings to match,
  // then bump parents upward as needed. Repeat until stable.
  let stable = false
  while (!stable) {
    stable = true

    // Group children by parent-set
    const siblingGroups = new Map() // parentKey → [childIds]
    for (const nodeId of Object.keys(tree.nodes)) {
      const parentIds = []
      for (const edge of Object.values(tree.edges)) {
        if ((edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') && edge.from === nodeId) {
          parentIds.push(edge.to)
        }
      }
      if (parentIds.length > 0) {
        const key = parentIds.sort().join(',')
        if (!siblingGroups.has(key)) siblingGroups.set(key, [])
        siblingGroups.get(key).push(nodeId)
      }
    }

    // Align siblings to max generation in group
    for (const [parentKey, childIds] of siblingGroups) {
      const gens = childIds.map(id => generations.get(id))
      const maxGen = Math.max(...gens)
      for (const childId of childIds) {
        if (generations.get(childId) < maxGen) {
          generations.set(childId, maxGen)
          stable = false
        }
      }

      // Ensure parents are at childGen - 1 (at least)
      const parentIds = parentKey.split(',')
      for (const parentId of parentIds) {
        const parentGen = generations.get(parentId)
        if (parentGen >= maxGen) {
          // Parent was bumped to or past children's gen (by partner/sibling cascade)
          // Push children down so they remain below their parent
          const newChildGen = parentGen + 1
          for (const childId of childIds) {
            if (generations.get(childId) < newChildGen) {
              generations.set(childId, newChildGen)
              stable = false
            }
          }
        } else if (parentGen < maxGen - 1) {
          generations.set(parentId, maxGen - 1)
          stable = false
        }
      }
    }

    // Re-align partners after sibling adjustments
    for (const edge of Object.values(tree.edges)) {
      if (edge.type === 'PARTNER_OF') {
        const gen1 = generations.get(edge.from)
        const gen2 = generations.get(edge.to)
        if (gen1 !== gen2) {
          const maxGen = Math.max(gen1, gen2)
          generations.set(edge.from, maxGen)
          generations.set(edge.to, maxGen)
          stable = false
        }
      }
    }
  }

  return generations
}
