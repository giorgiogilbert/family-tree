// dashboard.js — lista e gestione alberi

import { listTrees, createTree, deleteTree, shareMember } from "./api.js"
import { logout, getCurrentUser } from "./auth.js"

let currentTrees = []

/**
 * Initialize dashboard event listeners.
 * Call this once on page load.
 */
export function initDashboard() {
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    logout()
  })

  document.getElementById("btn-new-tree")?.addEventListener("click", handleNewTree)
}

/**
 * Render the dashboard page.
 * Fetches the user's trees and renders cards in #dashboard-list.
 */
export async function renderDashboard() {
  const listEl = document.getElementById("dashboard-list")
  if (!listEl) return

  try {
    listEl.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted);">Caricamento...</p>'

    currentTrees = await listTrees()

    if (currentTrees.length === 0) {
      listEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
          <p style="color: var(--color-text-muted); margin-bottom: 16px;">Nessun albero ancora</p>
          <button class="primary" id="btn-create-first">Crea il primo albero</button>
        </div>
      `
      document.getElementById("btn-create-first")?.addEventListener("click", handleNewTree)
      return
    }

    const currentUid = getCurrentUser()?.uid
    listEl.innerHTML = currentTrees.map(tree => {
      const nodeCount = Object.keys(tree.nodes || {}).length
      const updatedAt = new Date(tree.updatedAt).toLocaleDateString("it-IT")
      const userRole = tree.members?.[currentUid] || "viewer"
      const isOwner = userRole === "owner"

      return `
        <div class="tree-card">
          <h3>${escapeHtml(tree.name)}</h3>
          <p style="font-size: 0.875rem; color: var(--color-text-muted);">
            ${nodeCount} persone · ${updatedAt}
          </p>
          ${!isOwner ? `<p style="font-size: 0.75rem; color: var(--color-primary);">${userRole}</p>` : ''}
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="open-tree" data-id="${tree.id}">Apri</button>
            <button class="share-tree" data-id="${tree.id}" ${userRole === "viewer" ? "disabled" : ""}>Condividi</button>
            <button class="more-tree" data-id="${tree.id}" ${userRole === "owner" ? "" : "disabled"}>⋮</button>
          </div>
        </div>
      `
    }).join("")

    // Attach event listeners
    document.querySelectorAll(".open-tree").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const treeId = e.target.dataset.id
        window.location.hash = `#/tree/${treeId}`
      })
    })

    document.querySelectorAll(".share-tree").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const treeId = e.target.dataset.id
        handleShareTree(treeId)
      })
    })

    document.querySelectorAll(".more-tree").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const treeId = e.target.dataset.id
        showTreeMenu(treeId)
      })
    })

  } catch (err) {
    listEl.innerHTML = `<p style="grid-column: 1/-1; color: var(--color-danger);">Errore: ${escapeHtml(err.message)}</p>`
  }
}

/**
 * Handle "Nuovo albero" button click.
 * Prompts for a name, calls api.createTree, refreshes the list.
 */
async function handleNewTree() {
  const name = prompt("Nome del nuovo albero:")
  if (!name) return

  try {
    await createTree(name)
    await renderDashboard()
  } catch (err) {
    alert("Errore: " + err.message)
  }
}

/**
 * Handle share button click.
 */
async function handleShareTree(treeId) {
  const email = prompt("Email della persona da invitare:")
  if (!email) return

  const role = prompt("Ruolo (viewer/editor):", "viewer")
  if (!role) return

  try {
    await shareMember(treeId, email, role)
    alert("Invito inviato!")
    await renderDashboard()
  } catch (err) {
    alert("Errore: " + err.message)
  }
}

/**
 * Show context menu for a tree.
 */
function showTreeMenu(treeId) {
  const options = ["Rinomina", "Elimina", "Annulla"]
  const choice = prompt(`Scegli un'azione:\n1. ${options[0]}\n2. ${options[1]}\n3. ${options[2]}`)

  if (choice === "1") {
    handleRenameTree(treeId)
  } else if (choice === "2") {
    handleDeleteTree(treeId)
  }
}

/**
 * Rename a tree.
 */
async function handleRenameTree(treeId) {
  const tree = currentTrees.find(t => t.id === treeId)
  if (!tree) return

  const newName = prompt("Nuovo nome:", tree.name)
  if (!newName || newName === tree.name) return

  try {
    tree.name = newName
    // Will be implemented when PUT endpoint exists
    alert("Funzione rinomina non ancora implementata")
  } catch (err) {
    alert("Errore: " + err.message)
  }
}

/**
 * Delete a tree.
 */
async function handleDeleteTree(treeId) {
  if (!confirm("Sei sicuro di voler eliminare questo albero?")) return

  try {
    await deleteTree(treeId)
    await renderDashboard()
  } catch (err) {
    alert("Errore: " + err.message)
  }
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
