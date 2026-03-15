# Agent 4 — Integrazione + Polish

Leggi CLAUDE.md prima di fare qualsiasi cosa.

Gli agent 1, 2, 3 hanno implementato i componenti separatamente. Il tuo compito è verificare che tutto si colleghi correttamente e gestire i casi edge trasversali.

## Checklist integrazione

### 1. Verifica flusso auth end-to-end
- [ ] Login Google → redirect dashboard → lista alberi caricata
- [ ] Logout → redirect login → API non accessibile
- [ ] Token scaduto → Firebase SDK lo rinnova automaticamente (verifica che `getIdToken()` usi `forceRefresh` se necessario)

### 2. Verifica flusso dashboard → editor
- [ ] Click "Apri" su card → naviga a `#/tree/:id`
- [ ] Editor carica l'albero corretto
- [ ] Back al dashboard funziona
- [ ] Il ruolo dell'utente è passato correttamente all'editor (owner/editor/viewer)

### 3. Verifica ottimistic locking
- [ ] Due tab aperte sullo stesso albero
- [ ] Modifica su tab A → salva
- [ ] Modifica su tab B → riceve 409 → mostra messaggio conflitto
- [ ] Click "Ricarica" → ricarica albero aggiornato

### 4. Verifica permessi viewer
- [ ] Utente con ruolo viewer non vede bottoni di modifica
- [ ] API restituisce 403 se viewer tenta PUT
- [ ] Export JSON funziona per tutti i ruoli

### 5. Verifica gestione errori
- [ ] Backend non raggiungibile → messaggio "Connessione non disponibile"
- [ ] Albero non trovato (404) → redirect dashboard con messaggio
- [ ] Form validation: nome e cognome obbligatori

### 6. Verifica invarianti modello
- [ ] Non si può aggiungere figlio a coppia senza PARTNER_OF
- [ ] Non si può aggiungere terzo genitore
- [ ] PARTNER_OF sempre creato e rimosso in coppia simmetrica
- [ ] RemoveNode rimuove tutti gli archi collegati inclusi PARTNER_OF simmetrici

## Fix comuni da verificare

### CORS
Verifica che il backend abbia CORS configurato per l'origine del frontend in sviluppo:
```typescript
app.use(cors({ origin: ['http://localhost:5000', 'http://127.0.0.1:5000'] }))
```

### Firebase Admin inizializzazione
Verifica che Firebase Admin SDK sia inizializzato una sola volta:
```typescript
if (!admin.apps.length) { admin.initializeApp(...) }
```

### ES Modules nel frontend
Verifica che index.html abbia `type="module"` su tutti gli script:
```html
<script type="module" src="src/main.js"></script>
```

### Firebase SDK versione 9+ (modular)
Il frontend deve usare la sintassi modular di Firebase:
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js'
import { getAuth, signInWithPopup } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-auth.js'
```

## Export JSON

Verifica che il download funzioni dal frontend:
```javascript
async function exportTree(treeId, treeName) {
  const data = await api.trees.export(treeId)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${treeName}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

## README.md finale

Aggiorna README.md con:
1. Prerequisiti (Node.js 18+, account Firebase)
2. Setup Firebase: crea progetto, abilita Google Auth, crea Firestore, scarica service account
3. Configurazione: copia `.env.example` → `.env`, aggiorna `firebase-config.js`
4. Avvio sviluppo: comandi backend e frontend
5. Deploy: istruzioni Fly.io per backend + Firebase Hosting per frontend

## Note
- Non riscrivere componenti funzionanti, solo collegare e fixare
- Se trovi inconsistenze tra agent 1/2/3, risolvi nel modo meno invasivo
- Documenta nel README qualsiasi deviazione dalle specifiche
