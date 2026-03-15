# Genealogy Tree App

## Overview
Web app per creare e navigare alberi genealogici. Frontend Vanilla JS con grafo SVG interattivo, backend Node.js TypeScript, persistenza su Firestore.

## Stack
- **Frontend**: Vanilla JS, ES Modules + importmap, SVG per il grafo, Firebase SDK (no framework)
- **Backend**: Node.js, TypeScript, Express, Firebase Admin SDK
- **Server**: Monolith — backend serve frontend statico + API
- **Database**: Firestore (documento unico per albero)
- **Auth**: Google OAuth via Firebase
- **Deploy**: Fly.io (backend + frontend monolith)

---

## Struttura del progetto

```
/
├── CLAUDE.md
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── src/
│       ├── main.js              entry point, routing SPA minimale
│       ├── auth.js              Google OAuth + Firebase Auth SDK
│       ├── dashboard.js         lista "i miei alberi"
│       ├── api.js               chiamate al backend (fetch wrapper)
│       ├── editor.js            coordinatore editor albero
│       └── graph/
│           ├── renderer.js      SVG: nodi, archi, zoom, pan
│           ├── layout.js        posizionamento automatico per generazioni
│           └── interaction.js   click, add nodo, azioni contestuali
│
└── backend/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts             entry point Express
        ├── types/
        │   └── index.ts         tutti i tipi condivisi
        ├── middleware/
        │   └── authGuard.ts     verifica Firebase ID token
        ├── routes/
        │   ├── trees.ts         CRUD alberi
        │   └── sharing.ts       inviti e gestione ruoli
        └── services/
            ├── treeService.ts   logica business alberi
            └── shareService.ts  logica condivisione
```

---

## Modello dati

### PersonNode
```typescript
type PersonNode = {
  id: string
  name: string
  surname: string
  birth?: string        // ISO 8601 string "YYYY-MM-DD"
  death?: string        // ISO 8601 string "YYYY-MM-DD"
  gender: "M" | "F" | "other"
  notes?: string
}
```

### RelationEdge
```typescript
type RelationEdge = {
  id: string
  type: "PARTNER_OF" | "CHILD_OF" | "ADOPTED_BY"
  from: string          // nodeId
  to: string            // nodeId
  props?: {
    since?: string      // PARTNER_OF: data inizio relazione
    until?: string      // PARTNER_OF: data fine (separazione/morte)
  }
}
```

### Tree (documento Firestore: /trees/{treeId})
```typescript
type Tree = {
  id: string
  name: string
  ownerId: string
  members: Record<string, "owner" | "editor" | "viewer">
  rootId: string | null                // id del nodo radice dell'albero
  version: number                      // ottimistic locking
  nodes: Record<string, PersonNode>
  edges: Record<string, RelationEdge>
  createdAt: string                    // ISO 8601
  updatedAt: string                    // ISO 8601
}
```

---

## Regole del modello dati

### PARTNER_OF
- Sempre due archi simmetrici: A→B e B→A
- Gli archi PARTNER_OF vengono sempre creati e cancellati in coppia
- Un nodo può avere N partner (relazioni multiple/successive)
- Props opzionali: since, until

### CHILD_OF
- Un arco per ogni genitore biologico (massimo 2 archi CHILD_OF per nodo)
- Semantica esclusiva con ADOPTED_BY: un nodo non può avere sia CHILD_OF che ADOPTED_BY

### ADOPTED_BY
- Sostituisce CHILD_OF, stesso schema, semantica esclusiva
- Massimo 2 archi ADOPTED_BY per nodo

### Invarianti da validare
- Un figlio non può avere sia CHILD_OF che ADOPTED_BY verso qualsiasi nodo
- PARTNER_OF esiste sempre in coppia simmetrica
- Per aggiungere un figlio a una coppia, l'arco PARTNER_OF deve esistere prima
- Massimo 2 genitori totali (CHILD_OF + ADOPTED_BY combinati ≤ 2)

---

## Azioni UX → operazioni sul grafo

### Aggiungi root (primo nodo dell'albero)
```
- crea PersonNode
- nessun arco
- disponibile solo se nodes è vuoto
```

### Aggiungi partner di X
```
- precondizione: nodo X esiste
- crea PersonNode Y
- crea PARTNER_OF X→Y
- crea PARTNER_OF Y→X
- IDs generati con crypto.randomUUID()
```

### Aggiungi figlio della coppia X+Y
```
- precondizione: PARTNER_OF X→Y e Y→X esistono entrambi
- UI: pulsante visivamente posizionato sull'arco PARTNER_OF
- crea PersonNode figlio
- crea CHILD_OF figlio→X
- crea CHILD_OF figlio→Y
```

### Aggiungi coppia di genitori di X
```
- precondizione: nodo X esiste, X non ha già 2 genitori
- crea PersonNode padre
- crea PersonNode madre
- crea PARTNER_OF padre→madre
- crea PARTNER_OF madre→padre
- crea CHILD_OF X→padre
- crea CHILD_OF X→madre
```

---

## Ottimistic locking

Ogni update passa per una Firestore transaction che verifica la versione:

```typescript
async function saveTree(tree: Tree): Promise<void> {
  const ref = doc(db, "trees", tree.id)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const current = snap.data() as Tree

    if (current.version !== tree.version) {
      throw new ConflictError("CONFLICT: tree modified by another session")
    }

    tx.update(ref, {
      ...tree,
      version: tree.version + 1,
      updatedAt: new Date().toISOString()
    })
  })
}
```

Il frontend in caso di CONFLICT mostra un avviso e offre di ricaricare l'albero remoto.

---

## API Backend

### Auth
Ogni richiesta protetta porta header: `Authorization: Bearer <firebase-id-token>`
Il middleware `authGuard` verifica il token con Firebase Admin SDK e popola `req.user`.

### Endpoints

```
POST   /trees                     crea nuovo albero
GET    /trees                     lista alberi dell'utente (owner o member)
GET    /trees/:treeId             leggi albero completo
PUT    /trees/:treeId             salva albero completo (con version check)
DELETE /trees/:treeId             elimina albero (solo owner)

POST   /trees/:treeId/share       invita utente per email con ruolo
PATCH  /trees/:treeId/share/:uid  aggiorna ruolo membro
DELETE /trees/:treeId/share/:uid  rimuovi membro

GET    /trees/:treeId/export      restituisce JSON puro (nodes + edges)
```

### Convenzioni
- Errori: 400 input invalido, 401 non autenticato, 403 non autorizzato, 404 non trovato, 409 conflict versione
- Tutti gli ID: `crypto.randomUUID()`
- Date: ISO 8601 string, mai timestamp numerico
- async/await ovunque, no callbacks

---

## Ruoli e permessi

```
owner   → tutto: read, write, share, delete
editor  → read, write (no delete albero, no gestione membri)
viewer  → solo read ed export
```

---

## Frontend — note implementative

### Routing SPA
Senza framework — routing minimale basato su `window.location.hash`:
```
#/          → redirect a #/dashboard se autenticato, altrimenti login
#/dashboard → lista alberi
#/tree/:id  → editor albero
```

### Grafo SVG
- Zoom e pan: transform su un gruppo `<g>` root, gestito con wheel + drag
- Layout per generazioni: asse Y = generazione, asse X = distribuzione orizzontale
- Nodi: `<foreignObject>` o `<rect>` + `<text>` per ogni PersonNode
- Archi PARTNER_OF: linea orizzontale tra partner con indicatore visivo centrale
- Archi CHILD_OF / ADOPTED_BY: linea verticale dal nodo figlio verso la linea dei genitori
- Pulsante "aggiungi figlio" visivamente centrato sull'arco PARTNER_OF
- Pulsante "aggiungi partner" visivamente ancorato al nodo
- Pulsante "aggiungi genitori" visivamente ancorato al nodo (se < 2 genitori)

### UI minimale
- Palette colori: massimo 3 colori + neutri
- Niente animazioni decorative, solo feedback funzionali
- Font system stack (no Google Fonts)
- Modale unico riusabile per form add/edit persona

---

## Frontend — ES Modules e importmap

Il frontend usa ES Modules (import/export) con un importmap che mappa i moduli Firebase SDK dalle CDN:

```html
<script type="importmap">
  {
    "imports": {
      "firebase/app": "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js",
      "firebase/auth": "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js",
      "firebase/firestore": "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
    }
  }
</script>
```

Tutti i moduli frontend (auth.js, dashboard.js, editor.js, etc.) usano import/export standard ES6.
Il backend serve index.html con una Content Security Policy che consente:
- Inline script per importmap (`'unsafe-inline'`)
- CDN Firebase gstatic.com
- Connessioni a Firebase (*.firebaseio.com, *.googleapis.com)

---

## Firebase config (placeholder)

Il file `frontend/src/firebase-config.js` contiene la config Firebase.
In sviluppo usa variabili d'ambiente o un file `.env` non committato.

```javascript
// frontend/src/firebase-config.js
export const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID"
}
```

Il backend legge le credenziali Admin SDK da variabile d'ambiente:
```
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

---

## Comandi di sviluppo

**Monolith** — backend serve il frontend:

```bash
cd backend
npm install
npm run dev          # ts-node-dev con hot reload
```

Il server gira su `http://localhost:3000` e serve sia l'API che i file frontend statici.
Non è necessario avviare un server separato per il frontend.

---

## Note per gli agenti

- Leggere sempre questo file prima di scrivere qualsiasi codice
- **Monolith**: il backend serve il frontend statico + API su una singola porta (3000)
- Il frontend non usa nessun framework JS (no React, no Vue)
- Frontend: ES Modules con importmap, niente bundler
- Non usare localStorage per dati sensibili (token gestiti da Firebase SDK)
- Validare sempre gli invarianti del modello lato backend prima di salvare
- Non salvare archi ridondanti (no SIBLING_OF, no archi inversi per CHILD_OF)
