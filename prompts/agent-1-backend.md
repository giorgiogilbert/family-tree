# Agent 1 — Backend TypeScript

Leggi CLAUDE.md prima di fare qualsiasi cosa.

Lo scaffolding è già stato creato dall'Agent 0. Il tuo compito è implementare il backend TypeScript completo, partendo dai layer più bassi verso l'alto.

## Ordine di implementazione

### 1. src/types/index.ts
Verifica che i tipi siano già corretti. Se mancanti o incompleti, completali secondo CLAUDE.md.
Aggiungi anche questi tipi di utilità:
```typescript
type ApiError = { error: string; code?: string }
type AuthenticatedRequest = Request & { user: { uid: string; email: string } }
class ConflictError extends Error { constructor(message: string) { super(message); this.name = 'ConflictError' } }
class NotFoundError extends Error { ... }
class ForbiddenError extends Error { ... }
```

### 2. src/index.ts
- Setup Express con cors, helmet, express.json()
- Monta routes su /trees e /trees/:treeId/share
- Global error handler che distingue ConflictError (409), NotFoundError (404), ForbiddenError (403)
- Inizializzazione Firebase Admin SDK da GOOGLE_APPLICATION_CREDENTIALS
- Porta da process.env.PORT o 3000

### 3. src/middleware/authGuard.ts
- Verifica Firebase ID token dall'header Authorization: Bearer <token>
- Popola req.user con uid e email
- Restituisce 401 se token mancante o non valido

### 4. src/services/treeService.ts
Implementa tutte le funzioni business:
- `createTree(ownerId, name)` → Tree
- `getTree(treeId, userId)` → Tree (verifica membership)
- `listTrees(userId)` → Tree[] (owner o member)
- `saveTree(tree, userId)` → void (ottimistic locking con version check, verifica ruolo editor+)
- `deleteTree(treeId, userId)` → void (solo owner)
- `validateTree(tree)` → void (lancia errore se invarianti violati, vedi CLAUDE.md)

La funzione `validateTree` deve verificare:
- Ogni PARTNER_OF ha il suo simmetrico
- Nessun nodo ha sia CHILD_OF che ADOPTED_BY
- Nessun nodo ha più di 2 genitori totali
- Gli ID negli archi puntano a nodi esistenti

### 5. src/services/shareService.ts
- `inviteMember(treeId, ownerUid, email, role)` → void
  - cerca utente per email su Firebase Auth
  - aggiunge a members con ruolo specificato
- `updateMemberRole(treeId, ownerUid, targetUid, role)` → void
- `removeMember(treeId, ownerUid, targetUid)` → void (non può rimuovere owner)

### 6. src/routes/trees.ts
Implementa tutti gli endpoints da CLAUDE.md:
- POST   /trees
- GET    /trees
- GET    /trees/:treeId
- PUT    /trees/:treeId
- DELETE /trees/:treeId
- GET    /trees/:treeId/export → restituisce { nodes, edges } senza metadata interni

Tutti protetti da authGuard tranne nessuno (auth richiesta ovunque).

### 7. src/routes/sharing.ts
- POST   /trees/:treeId/share
- PATCH  /trees/:treeId/share/:uid
- DELETE /trees/:treeId/share/:uid

## Note
- async/await ovunque, no callbacks
- Tutti gli errori passano al global error handler via next(error)
- Non usare any, tipizzare tutto
- Le date sono sempre ISO 8601 string
- Gli ID sono sempre crypto.randomUUID()
