export type PersonNode = {
  id: string
  name: string
  surname: string
  birth?: string   // ISO 8601 "YYYY-MM-DD"
  death?: string   // ISO 8601 "YYYY-MM-DD"
  gender: "M" | "F" | "other"
  notes?: string
}

export type RelationEdge = {
  id: string
  type: "PARTNER_OF" | "CHILD_OF" | "ADOPTED_BY"
  from: string  // nodeId
  to: string    // nodeId
  props?: {
    since?: string  // PARTNER_OF: data inizio relazione
    until?: string  // PARTNER_OF: data fine (separazione/morte)
  }
}

export type MemberRole = "owner" | "editor" | "viewer"

export type Tree = {
  id: string
  name: string
  ownerId: string
  members: Record<string, MemberRole>
  version: number  // optimistic locking
  nodes: Record<string, PersonNode>
  edges: Record<string, RelationEdge>
  createdAt: string  // ISO 8601
  updatedAt: string  // ISO 8601
}

export type ApiError = {
  error: string
  code?: string
}

export type AuthenticatedRequest = Request & {
  user: { uid: string; email?: string }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConflictError"
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForbiddenError"
  }
}
