// editor.js — coordinator for the tree editor page

import * as api from "./api.js"
import { initRenderer, renderGraph, highlightNode, clearHighlight } from "./graph/renderer.js"
import { computeLayout } from "./graph/layout.js"
import { bindInteractions, addRoot, openPersonForm } from "./graph/interaction.js"

let currentTree = null
let currentUserRole = null

/**
 * Load the tree by id and initialize the SVG editor
 */
export async function renderEditor(treeId, userRole = 'owner') {
  try {
    updateStatusLabel('Caricamento...')
    currentUserRole = userRole

    // Fetch tree from API
    currentTree = await api.getTree(treeId)

    // Update page header
    document.getElementById('editor-tree-name').textContent = currentTree.name

    // Initialize SVG renderer
    const editorMain = document.getElementById('editor-main')
    initRenderer(editorMain)

    // Compute layout and render
    const positions = computeLayout(currentTree)
    renderGraph(currentTree.nodes, currentTree.edges, positions)

    // Show "add first person" button if tree is empty
    if (Object.keys(currentTree.nodes).length === 0 && userRole !== 'viewer') {
      showEmptyTreeUI()
    }

    // Bind interactions
    bindInteractions(
      () => currentTree,
      onTreeChange,
      userRole
    )

    updateStatusLabel('Salvato')
  } catch (error) {
    console.error('Error loading tree:', error)
    updateStatusLabel('Errore nel caricamento')
  }
}

/**
 * Show UI for adding the first person to an empty tree
 */
function showEmptyTreeUI() {
  const svg = document.getElementById('graph-svg')
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('id', 'empty-tree-ui')

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', '50%')
  text.setAttribute('y', '50%')
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dy', '-1em')
  text.setAttribute('class', 'empty-tree-text')
  text.textContent = 'Albero vuoto'

  const btn = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  btn.setAttribute('id', 'btn-add-root')
  btn.style.cursor = 'pointer'
  btn.setAttribute('transform', 'translate(50%, 50%)')

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', '-60')
  rect.setAttribute('y', '-15')
  rect.setAttribute('width', '120')
  rect.setAttribute('height', '30')
  rect.setAttribute('rx', '4')
  rect.setAttribute('class', 'empty-tree-btn')

  const btnText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  btnText.setAttribute('text-anchor', 'middle')
  btnText.setAttribute('dy', '0.3em')
  btnText.setAttribute('class', 'empty-tree-btn-text')
  btnText.textContent = 'Aggiungi prima persona'

  btn.appendChild(rect)
  btn.appendChild(btnText)

  g.appendChild(text)
  g.appendChild(btn)
  svg.appendChild(g)

  btn.addEventListener('click', async () => {
    const personData = await openPersonForm()
    if (personData) {
      currentTree = addRoot(currentTree, personData)
      const positions = computeLayout(currentTree)
      renderGraph(currentTree.nodes, currentTree.edges, positions)
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

  // Re-render
  const positions = computeLayout(currentTree)
  renderGraph(currentTree.nodes, currentTree.edges, positions)

  try {
    updateStatusLabel('Salvataggio...')
    await api.saveTree(currentTree.id, currentTree)
    currentTree = { ...updatedTree, version: (updatedTree.version || 0) + 1 }
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
