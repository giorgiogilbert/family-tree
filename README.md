# 🌳 Genealogy Tree

Web app per creare, navigare e condividere alberi genealogici interattivi.

Grafo SVG navigabile con zoom e pan, autenticazione Google, condivisione con ruoli, esportazione JSON.

---

## Stack

| Layer | Tecnologia |
|---|---|
| Frontend | Vanilla JS + SVG |
| Backend | Node.js + TypeScript + Express |
| Database | Firestore (documento unico per albero) |
| Auth | Firebase Auth (Google OAuth) |
| Deploy backend | Fly.io |
| Deploy frontend | Firebase Hosting |

---

## Prerequisiti

- Node.js 18+
- Un account Google
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- [Claude Code](https://claude.ai/code) (solo per il setup iniziale da template): `npm install -g @anthropic-ai/claude-code`

---

## Setup Firebase

### 1. Crea il progetto
1. Vai su [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuovo progetto
3. Disabilita Google Analytics (non necessario)

### 2. Abilita Authentication
1. Nel menu laterale: **Build → Authentication**
2. Click **Get started**
3. Tab **Sign-in method** → abilita **Google**
4. Salva

### 3. Crea il database Firestore
1. Nel menu laterale: **Build → Firestore Database**
2. Click **Create database**
3. Scegli **Start in production mode**
4. Seleziona la region più vicina (es. `europe-west1`)

### 4. Regole Firestore
In **Firestore → Rules**, sostituisci le regole di default con:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trees/{treeId} {
      allow read, write: if false; // tutto passa dal backend
    }
  }
}
```

Il backend usa Firebase Admin SDK con privilegi completi — il frontend non accede direttamente a Firestore.

### 5. Service Account (per il backend)
1. **Impostazioni progetto → Account di servizio**
2. Click **Genera nuova chiave privata**
3. Salva il file JSON scaricato come `backend/service-account.json`
4. ⚠️ Non committare questo file — è già in `.gitignore`

### 6. Configurazione frontend
1. **Impostazioni progetto → Le tue app → Aggiungi app → Web**
2. Registra l'app, copia l'oggetto `firebaseConfig`
3. Incollalo in `frontend/src/firebase-config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
}
```

---

## Configurazione locale

### Backend
```bash
cd backend
cp .env.example .env
```

Modifica `.env`:
```
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
PORT=3000
```

### Frontend
Niente da configurare oltre a `firebase-config.js` — niente bundler, niente `.env`.

---

## Avvio in sviluppo

**Backend** (terminale 1):
```bash
cd backend
npm install
npm run dev
```

Il backend gira su `http://localhost:3000`.

**Frontend** (terminale 2):
```bash
cd frontend
npx serve . -p 5000
```

Il frontend è su `http://localhost:5000`.

---

## Struttura del progetto

```
/
├── CLAUDE.md                  specifiche per Claude Code
├── README.md
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── src/
│       ├── main.js            router SPA (hash-based)
│       ├── auth.js            Google OAuth + Firebase Auth
│       ├── dashboard.js       lista e gestione alberi
│       ├── api.js             client HTTP verso il backend
│       ├── editor.js          coordinatore editor albero
│       ├── firebase-config.js config Firebase (non committare i valori reali)
│       └── graph/
│           ├── renderer.js    SVG: nodi, archi, zoom, pan
│           ├── layout.js      posizionamento automatico per generazioni
│           └── interaction.js azioni utente, form, operazioni sul grafo
│
└── backend/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── index.ts
        ├── types/index.ts
        ├── middleware/authGuard.ts
        ├── routes/
        │   ├── trees.ts
        │   └── sharing.ts
        └── services/
            ├── treeService.ts
            └── shareService.ts
```

---

## Modello dati

L'albero è un singolo documento JSON con nodi e archi.

```typescript
type Tree = {
  id: string
  name: string
  ownerId: string
  members: Record<string, "owner" | "editor" | "viewer">
  version: number          // ottimistic locking
  nodes: Record<string, PersonNode>
  edges: Record<string, RelationEdge>
  createdAt: string
  updatedAt: string
}
```

### Tipi di relazione

| Tipo | Descrizione | Note |
|---|---|---|
| `PARTNER_OF` | Relazione di coppia | Sempre due archi simmetrici A→B e B→A |
| `CHILD_OF` | Figlio biologico | Max 2 per nodo, esclusivo con ADOPTED_BY |
| `ADOPTED_BY` | Figlio adottivo | Sostituisce CHILD_OF, max 2 per nodo |

Le relazioni derivate (fratellanza, discendenza) non sono salvate — vengono inferite a runtime dagli archi esistenti.

---

## API

Tutti gli endpoint richiedono header `Authorization: Bearer <firebase-id-token>`.

```
POST   /trees                     crea nuovo albero
GET    /trees                     lista alberi dell'utente
GET    /trees/:treeId             leggi albero completo
PUT    /trees/:treeId             salva albero (con version check)
DELETE /trees/:treeId             elimina albero (solo owner)

POST   /trees/:treeId/share       invita membro per email
PATCH  /trees/:treeId/share/:uid  aggiorna ruolo
DELETE /trees/:treeId/share/:uid  rimuovi membro

GET    /trees/:treeId/export      scarica JSON puro (nodes + edges)
```

---

## Ruoli

| Ruolo | Lettura | Modifica | Condivisione | Elimina |
|---|---|---|---|---|
| `owner` | ✅ | ✅ | ✅ | ✅ |
| `editor` | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ |

---

## Deploy

### Backend su Fly.io

```bash
# Installa flyctl
brew install flyctl        # macOS
# oppure: curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Dalla cartella backend/
cd backend
fly launch                 # segui il wizard, scegli region europe
fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat service-account.json)"
fly deploy
```

Aggiorna la variabile `BASE_URL` in `frontend/src/api.js` con l'URL assegnato da Fly.io.

### Frontend su Firebase Hosting

```bash
cd frontend
firebase login
firebase init hosting      # public directory: "." , single-page app: no
firebase deploy
```

Aggiungi il dominio Firebase Hosting alla lista degli **Authorized domains** in **Firebase Auth → Settings → Authorized domains**.

---

## Sviluppo con Claude Code

Il progetto è strutturato per essere generato con agenti Claude Code paralleli. I prompt sono in `prompts/`:

```bash
# 1. Scaffolding (prima)
claude < prompts/agent-0-scaffolding.md

# 2. Sviluppo parallelo (3 terminali separati)
claude < prompts/agent-1-backend.md
claude < prompts/agent-2-auth-dashboard.md
claude < prompts/agent-3-graph-editor.md

# 3. Integrazione (dopo)
claude < prompts/agent-4-integration.md
```

Vedi `prompts/HOW-TO-RUN.md` per dettagli.

---

## Esportazione e importazione

Il pulsante **Esporta JSON** nella dashboard scarica un file `nome-albero.json` con nodi e archi — importabile su qualsiasi altra istanza dell'app o usabile come backup.

Il formato di esportazione è stabile e versionato (`version` nel documento) per garantire compatibilità futura.

---

## Licenza

MIT
