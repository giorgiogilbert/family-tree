// auth.js — Google OAuth via Firebase Auth SDK

import { initializeApp } from "firebase/app"
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth"
import { firebaseConfig } from "./firebase-config.js"

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

/**
 * Sign in with Google popup.
 * Navigates to #/dashboard on success.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  window.location.hash = "#/dashboard"
  return result.user
}

/**
 * Sign out the current user.
 * Navigates to #/login.
 */
export async function logout() {
  await signOut(auth)
  window.location.hash = "#/"
}

/**
 * Get the current Firebase ID token for API requests.
 * Returns null if not authenticated.
 * forceRefresh ensures we get a fresh token if expired.
 */
export async function getIdToken() {
  const user = auth.currentUser
  if (!user) return null
  return await user.getIdToken(true)
}

/**
 * Get current user or null.
 */
export function getCurrentUser() {
  return auth.currentUser
}

/**
 * Subscribe to auth state changes.
 * Calls callback(user) where user is null when signed out.
 */
export function onAuthChanged(callback) {
  return onAuthStateChanged(auth, callback)
}
