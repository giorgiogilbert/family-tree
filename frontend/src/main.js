// main.js — SPA entry point, hash-based routing
// Routes:
//   #/           → redirect to #/dashboard if authenticated, else show #/login
//   #/dashboard  → dashboard page
//   #/tree/:id   → tree editor

import { onAuthChanged, getCurrentUser, signInWithGoogle } from "./auth.js"
import { renderDashboard, initDashboard } from "./dashboard.js"
import { renderEditor } from "./editor.js"

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"))
  document.getElementById(id)?.classList.remove("hidden")
}

function initLoginButton() {
  document.getElementById("btn-google-login")?.addEventListener("click", signInWithGoogle)
}

async function route() {
  const user = getCurrentUser()
  const hash = window.location.hash || "#/"

  if (!user) {
    showPage("page-login")
    return
  }

  if (hash === "#/" || hash === "#/dashboard") {
    await renderDashboard()
    showPage("page-dashboard")
  } else if (hash.startsWith("#/tree/")) {
    const treeId = hash.slice("#/tree/".length)
    await renderEditor(treeId)
    showPage("page-editor")
  } else {
    window.location.hash = "#/"
  }
}

// Initial route and setup
document.addEventListener("DOMContentLoaded", () => {
  initLoginButton()
  initDashboard()

  // Subscribe to auth changes after app is ready
  onAuthChanged((user) => {
    route()
  })

  // Initial route
  route()
})

window.addEventListener("hashchange", route)
