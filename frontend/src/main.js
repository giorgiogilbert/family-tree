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

  console.log("[ROUTE] Routing - user:", user?.email, "hash:", hash)

  // If no user, always show login and redirect to #/
  if (!user) {
    console.log("[ROUTE] No user, showing login")
    showPage("page-login")
    if (hash !== "#/") {
      window.location.hash = "#/"
    }
    return
  }

  // If user is authenticated but on login page, redirect to dashboard
  if (hash === "#/" || hash === "#/dashboard") {
    console.log("[ROUTE] Loading dashboard...")
    try {
      await renderDashboard()
      showPage("page-dashboard")
      console.log("[ROUTE] Dashboard loaded")
    } catch (err) {
      console.error("[ROUTE] Dashboard error:", err)
    }
  } else if (hash.startsWith("#/tree/")) {
    const treeId = hash.slice("#/tree/".length)
    console.log("[ROUTE] Loading editor for tree:", treeId)
    try {
      showPage("page-editor")
      await renderEditor(treeId)
    } catch (err) {
      console.error("[ROUTE] Editor error:", err)
    }
  } else {
    // Unknown route, redirect to dashboard if authenticated
    window.location.hash = "#/dashboard"
  }
}

// Initial route and setup
document.addEventListener("DOMContentLoaded", () => {
  console.log("[INIT] DOMContentLoaded fired")
  initLoginButton()
  initDashboard()

  // Subscribe to auth changes — this is the single point of routing decisions
  onAuthChanged((user) => {
    console.log("[AUTH-LISTENER] Auth state changed - user:", user?.email || "null")
    route()
  })
})

window.addEventListener("hashchange", route)
