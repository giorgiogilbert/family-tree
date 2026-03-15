// layout.js — automatic generational layout

const NODE_WIDTH = 160
const NODE_HEIGHT = 80
const H_GAP = 40
const V_GAP = 120

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

  // Group nodes by generation
  const genGroups = {}
  for (const [nodeId, gen] of generations.entries()) {
    if (!genGroups[gen]) genGroups[gen] = []
    genGroups[gen].push(nodeId)
  }

  // For each generation, compute horizontal positions
  for (const gen in genGroups) {
    const nodeIds = genGroups[gen]
    const y = GENERATION_Y(parseInt(gen))

    // Simple distribution: calculate total width, center, then spread
    const totalWidth = nodeIds.length * NODE_WIDTH + (nodeIds.length - 1) * H_GAP
    const startX = 400 - totalWidth / 2 // Center around x=400

    nodeIds.forEach((nodeId, idx) => {
      const x = startX + idx * (NODE_WIDTH + H_GAP)
      positions.set(nodeId, { x, y })
    })
  }

  return positions
}

/**
 * Assign generation numbers to each node via BFS on CHILD_OF / ADOPTED_BY edges.
 * Generation 0 = root nodes (no incoming parent edges)
 * Returns a Map<nodeId, generationNumber>
 */
function assignGenerations(tree) {
  const generations = new Map()
  const visited = new Set()

  // Find root nodes: nodes with no incoming CHILD_OF or ADOPTED_BY edges
  const hasIncomingParent = new Set()
  for (const edge of Object.values(tree.edges)) {
    if (edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') {
      hasIncomingParent.add(edge.from)
    }
  }

  const roots = []
  for (const nodeId of Object.keys(tree.nodes)) {
    if (!hasIncomingParent.has(nodeId)) {
      roots.push(nodeId)
      generations.set(nodeId, 0)
      visited.add(nodeId)
    }
  }

  // BFS from roots: traverse children via CHILD_OF / ADOPTED_BY edges
  const queue = [...roots]
  while (queue.length > 0) {
    const nodeId = queue.shift()
    const currentGen = generations.get(nodeId)

    // Find all children (nodes where there's an edge childId -> nodeId)
    for (const edge of Object.values(tree.edges)) {
      if ((edge.type === 'CHILD_OF' || edge.type === 'ADOPTED_BY') && edge.to === nodeId) {
        const childId = edge.from
        if (!visited.has(childId)) {
          generations.set(childId, currentGen + 1)
          visited.add(childId)
          queue.push(childId)
        }
      }
    }

    // Partner relationship: same generation
    for (const edge of Object.values(tree.edges)) {
      if (edge.type === 'PARTNER_OF' && edge.from === nodeId) {
        const partnerId = edge.to
        if (!visited.has(partnerId)) {
          generations.set(partnerId, currentGen)
          visited.add(partnerId)
          queue.push(partnerId)
        }
      }
    }
  }

  // Assign generation 0 to any remaining disconnected nodes
  for (const nodeId of Object.keys(tree.nodes)) {
    if (!visited.has(nodeId)) {
      generations.set(nodeId, 0)
    }
  }

  return generations
}
