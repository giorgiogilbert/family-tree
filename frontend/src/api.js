// api.js — HTTP client wrapper for the backend

const BASE_URL = "http://localhost:3000"

import { getIdToken } from "./auth.js"

async function request(method, path, body) {
  const token = await getIdToken()
  const headers = {
    "Content-Type": "application/json"
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  if (res.status === 409) throw { code: "CONFLICT" }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// Trees
export const listTrees   = ()           => request("GET",    "/trees")
export const getTree     = (id)         => request("GET",    `/trees/${id}`)
export const createTree  = (name)       => request("POST",   "/trees", { name })
export const saveTree    = (id, tree)   => request("PUT",    `/trees/${id}`, tree)
export const deleteTree  = (id)         => request("DELETE", `/trees/${id}`)
export const exportTree  = (id)         => request("GET",    `/trees/${id}/export`)

// Sharing
export const shareMember  = (treeId, email, role) => request("POST",   `/trees/${treeId}/share`, { email, role })
export const updateMember = (treeId, uid,   role) => request("PATCH",  `/trees/${treeId}/share/${uid}`, { role })
export const removeMember = (treeId, uid)         => request("DELETE", `/trees/${treeId}/share/${uid}`)
