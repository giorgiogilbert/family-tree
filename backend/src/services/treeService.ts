import { randomUUID } from "crypto"
import {
  Tree,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  RelationEdge,
} from "../types"
import * as admin from "firebase-admin"

const db = admin.firestore()

export async function createTree(ownerId: string, name: string): Promise<Tree> {
  const treeId = randomUUID()
  const now = new Date().toISOString()

  const tree: Tree = {
    id: treeId,
    name,
    ownerId,
    members: { [ownerId]: "owner" },
    memberIds: [ownerId],
    rootId: null,
    version: 1,
    nodes: {},
    edges: {},
    createdAt: now,
    updatedAt: now,
  }

  await db.collection("trees").doc(treeId).set(tree)
  return tree
}

export async function listTrees(userId: string): Promise<Tree[]> {
  // Query 1: Trees where user is owner
  const ownerSnapshot = await db
    .collection("trees")
    .where("ownerId", "==", userId)
    .get()

  // Query 2: Trees where user is a member (in the memberIds array)
  const memberSnapshot = await db
    .collection("trees")
    .where("memberIds", "array-contains", userId)
    .get()

  // Deduplicate by id and return
  const treeMap = new Map<string, Tree>()

  ownerSnapshot.docs.forEach((doc) => {
    treeMap.set(doc.id, doc.data() as Tree)
  })

  memberSnapshot.docs.forEach((doc) => {
    treeMap.set(doc.id, doc.data() as Tree)
  })

  return Array.from(treeMap.values())
}

export async function getTree(treeId: string, userId: string): Promise<Tree> {
  const doc = await db.collection("trees").doc(treeId).get()

  if (!doc.exists) {
    throw new NotFoundError(`Tree ${treeId} not found`)
  }

  const tree = doc.data() as Tree

  if (!tree.members[userId]) {
    throw new ForbiddenError(`User ${userId} has no access to tree ${treeId}`)
  }

  return tree
}

export async function saveTree(tree: Tree, userId: string): Promise<void> {
  // Validate that user is editor or owner
  const userRole = tree.members[userId]
  if (userRole !== "editor" && userRole !== "owner") {
    throw new ForbiddenError(
      `User ${userId} does not have write permission on tree ${tree.id}`
    )
  }

  // Validate tree structure
  validateTree(tree)

  // Optimistic locking via transaction
  await db.runTransaction(async (tx: any) => {
    const ref = db.collection("trees").doc(tree.id)
    const snap = await tx.get(ref)

    if (!snap.exists) {
      throw new NotFoundError(`Tree ${tree.id} not found`)
    }

    const current = snap.data() as Tree

    if (current.version !== tree.version) {
      throw new ConflictError(
        "CONFLICT: tree modified by another session"
      )
    }

    tx.update(ref, {
      ...tree,
      version: tree.version + 1,
      updatedAt: new Date().toISOString(),
    })
  })
}

export async function deleteTree(treeId: string, userId: string): Promise<void> {
  const tree = await getTree(treeId, userId)

  if (tree.ownerId !== userId) {
    throw new ForbiddenError(
      `Only the owner can delete tree ${treeId}`
    )
  }

  await db.collection("trees").doc(treeId).delete()
}

/**
 * Validates tree structure against invariants:
 * - Every PARTNER_OF has symmetric reverse edge
 * - No node has both CHILD_OF and ADOPTED_BY
 * - No node has more than 2 parents (CHILD_OF + ADOPTED_BY combined ≤ 2)
 * - Edge references point to existing nodes
 */
export function validateTree(tree: Tree): void {
  const errors: string[] = []

  // Check rootId references existing node
  if (tree.rootId && !tree.nodes[tree.rootId]) {
    errors.push(`rootId "${tree.rootId}" references non-existent node`)
  }

  // Check symmetric PARTNER_OF edges
  for (const edgeId in tree.edges) {
    const edge = tree.edges[edgeId]

    if (edge.type === "PARTNER_OF") {
      const reverseEdgeId = Object.keys(tree.edges).find(
        (id) =>
          tree.edges[id].type === "PARTNER_OF" &&
          tree.edges[id].from === edge.to &&
          tree.edges[id].to === edge.from
      )

      if (!reverseEdgeId) {
        errors.push(
          `PARTNER_OF edge ${edgeId} (${edge.from} → ${edge.to}) has no symmetric reverse`
        )
      }
    }

    // Check edge references point to existing nodes
    if (!tree.nodes[edge.from]) {
      errors.push(
        `Edge ${edgeId} references non-existent node ${edge.from}`
      )
    }
    if (!tree.nodes[edge.to]) {
      errors.push(
        `Edge ${edgeId} references non-existent node ${edge.to}`
      )
    }
  }

  // Check no node has both CHILD_OF and ADOPTED_BY
  for (const nodeId in tree.nodes) {
    const childOfEdges = Object.values(tree.edges).filter(
      (e) => e.type === "CHILD_OF" && e.from === nodeId
    )
    const adoptedByEdges = Object.values(tree.edges).filter(
      (e) => e.type === "ADOPTED_BY" && e.from === nodeId
    )

    if (childOfEdges.length > 0 && adoptedByEdges.length > 0) {
      errors.push(
        `Node ${nodeId} has both CHILD_OF and ADOPTED_BY edges`
      )
    }

    // Check max 2 parents
    const parentEdges = childOfEdges.length + adoptedByEdges.length
    if (parentEdges > 2) {
      errors.push(
        `Node ${nodeId} has ${parentEdges} parent edges (max 2 allowed)`
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(`Tree validation failed:\n${errors.join("\n")}`)
  }
}
