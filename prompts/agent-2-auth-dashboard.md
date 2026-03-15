# Agent 2 — Auth + Dashboard Frontend

Leggi CLAUDE.md prima di fare qualsiasi cosa.

Lo scaffolding è già stato creato dall'Agent 0. Il tuo compito è implementare auth Google e dashboard in Vanilla JS. Il grafo SVG è fuori scope per questo agente.

## Routing SPA

Implementa in `src/main.js` un router minimale basato su hash:

```javascript
// Rotte:
// #/          → se autenticato → #/dashboard, altrimenti mostra login
// #/dashboard → mostra dashboard
// #/tree/:id  → mostra editor (placeholder per Agent 3)

function navigate(hash) { window.location.hash = hash }
window.addEventListener('hashchange', render)
document.addEventListener('DOMContentLoaded', render)
```

Il DOM ha tre sezioni in index.html:
- `#page-login` — pagina di login
- `#page-dashboard` — dashboard alberi
- `#page-editor` — editor albero (placeholder, implementato da Agent 3)

`render()` mostra la sezione corretta e nasconde le altre.

## src/auth.js

```javascript
// Inizializza Firebase App con firebaseConfig
// Esporta:
export async function signInWithGoogle()   // popup OAuth
export async function signOut()
export function getCurrentUser()           // ritorna user Firebase o null
export function onAuthChange(callback)     // wrapper onAuthStateChanged
export async function getIdToken()         // per le chiamate API
```

Il login avviene con `signInWithPopup` e `GoogleAuthProvider`.
Dopo il login, naviga a `#/dashboard`.
Dopo il logout, naviga a `#/`.

## src/api.js

Fetch wrapper che aggiunge automaticamente il token:

```javascript
const BASE_URL = 'http://localhost:3000'

async function request(method, path, body?) {
  const token = await getIdToken()
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json()
    throw new ApiError(err.error, res.status)
  }
  return res.json()
}

// Esporta:
export const api = {
  trees: {
    list()                          // GET /trees
    get(treeId)                     // GET /trees/:treeId
    create(name)                    // POST /trees
    save(tree)                      // PUT /trees/:treeId
    delete(treeId)                  // DELETE /trees/:treeId
    export(treeId)                  // GET /trees/:treeId/export
  },
  sharing: {
    invite(treeId, email, role)     // POST /trees/:treeId/share
    updateRole(treeId, uid, role)   // PATCH /trees/:treeId/share/:uid
    remove(treeId, uid)             // DELETE /trees/:treeId/share/:uid
  }
}
```

Gestione conflitto versione (status 409): lancia `ConflictError` specifica che il chiamante può intercettare.

## src/dashboard.js

Implementa la pagina dashboard:

### Layout dashboard
```
Header: "I miei alberi genealogici"  [+ Nuovo albero]    [Logout →]
─────────────────────────────────────────────────────────────────────
Griglia di card, una per albero:
┌─────────────────────────┐
│ Nome albero             │
│ N persone · aggiornato  │
│                         │
│ [Apri]  [Condividi] [⋮] │
└─────────────────────────┘
```

### Azioni
- **Nuovo albero**: modale con input nome → `api.trees.create(name)` → ricarica lista
- **Apri**: naviga a `#/tree/:id`
- **Condividi**: modale con form (email + select ruolo viewer/editor) → `api.sharing.invite(...)`
- **Menu ⋮**: opzioni Rinomina, Elimina (con conferma)
- Mostra badge ruolo se l'utente non è owner ("editor" / "viewer")

### Stati UI
- Loading: scheletro card mentre carica
- Empty state: messaggio "Nessun albero ancora" con CTA "Crea il primo"
- Errore: messaggio inline non bloccante

## Pagina Login

In `index.html` la sezione `#page-login`:
- Centrata verticalmente
- Titolo app
- Bottone "Accedi con Google" che chiama `signInWithGoogle()`
- Nessun altro elemento

## Note
- Niente framework, niente bundler — ES modules nativi con import/export
- Niente localStorage per token (Firebase SDK li gestisce)
- CSS minimale già in style.css, aggiungi solo classi necessarie
- Tutti i testi in italiano
