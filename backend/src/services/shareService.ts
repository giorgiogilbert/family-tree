import { MemberRole, ForbiddenError, NotFoundError } from "../types"
import * as admin from "firebase-admin"

const db = admin.firestore()
const auth = admin.auth()

export async function inviteMember(
  treeId: string,
  requestorId: string,
  email: string,
  role: MemberRole
): Promise<void> {
  const treeDoc = await db.collection("trees").doc(treeId).get()

  if (!treeDoc.exists) {
    throw new NotFoundError(`Tree ${treeId} not found`)
  }

  const tree = treeDoc.data() as any

  // Only owner can invite members
  if (tree.ownerId !== requestorId) {
    throw new ForbiddenError(`Only the owner can invite members to tree ${treeId}`)
  }

  // Look up user by email
  let targetUid: string
  try {
    const userRecord = await auth.getUserByEmail(email)
    targetUid = userRecord.uid
  } catch (err) {
    throw new NotFoundError(`User with email ${email} not found`)
  }

  // Add to members
  await db.collection("trees").doc(treeId).update({
    [`members.${targetUid}`]: role,
  })
}

export async function updateMemberRole(
  treeId: string,
  requestorId: string,
  targetUid: string,
  role: MemberRole
): Promise<void> {
  const treeDoc = await db.collection("trees").doc(treeId).get()

  if (!treeDoc.exists) {
    throw new NotFoundError(`Tree ${treeId} not found`)
  }

  const tree = treeDoc.data() as any

  // Only owner can change roles
  if (tree.ownerId !== requestorId) {
    throw new ForbiddenError(`Only the owner can update member roles in tree ${treeId}`)
  }

  if (!tree.members[targetUid]) {
    throw new NotFoundError(`User ${targetUid} is not a member of tree ${treeId}`)
  }

  // Update role
  await db.collection("trees").doc(treeId).update({
    [`members.${targetUid}`]: role,
  })
}

export async function removeMember(
  treeId: string,
  requestorId: string,
  targetUid: string
): Promise<void> {
  const treeDoc = await db.collection("trees").doc(treeId).get()

  if (!treeDoc.exists) {
    throw new NotFoundError(`Tree ${treeId} not found`)
  }

  const tree = treeDoc.data() as any

  // Only owner can remove members
  if (tree.ownerId !== requestorId) {
    throw new ForbiddenError(`Only the owner can remove members from tree ${treeId}`)
  }

  // Owner cannot remove themselves
  if (tree.ownerId === targetUid) {
    throw new ForbiddenError(`Owner cannot remove themselves from tree ${treeId}`)
  }

  if (!tree.members[targetUid]) {
    throw new NotFoundError(`User ${targetUid} is not a member of tree ${treeId}`)
  }

  // Remove member
  await db.collection("trees").doc(treeId).update({
    [`members.${targetUid}`]: admin.firestore.FieldValue.delete(),
  })
}
