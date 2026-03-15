# Agent 0 — Scaffolding

Leggi CLAUDE.md prima di fare qualsiasi cosa.

Il tuo compito è creare la struttura completa del progetto con tutti i file di configurazione. Non scrivere logica applicativa — solo scaffolding, config e file vuoti con commenti segnaposto.

## Cosa creare

### Root
- `.gitignore` (node_modules, .env, service-account.json, dist)
- `README.md` con istruzioni setup Firebase e avvio in sviluppo

### backend/
- `package.json` con dipendenze:
  - dependencies: express, firebase-admin, cors, helmet, dotenv
  - devDependencies: typescript, ts-node-dev, @types/express, @types/node, @types/cors
- `tsconfig.json` (target ES2020, module commonjs, strict true, outDir dist)
- `src/index.ts` — segnaposto con TODO
- `src/types/index.ts` — tutti i tipi da CLAUDE.md già scritti e completi
- `src/middleware/authGuard.ts` — segnaposto con TODO
- `src/routes/trees.ts` — segnaposto con TODO
- `src/routes/sharing.ts` — segnaposto con TODO
- `src/services/treeService.ts` — segnaposto con TODO
- `src/services/shareService.ts` — segnaposto con TODO
- `.env.example` con GOOGLE_APPLICATION_CREDENTIALS e PORT

### frontend/
- `index.html` — struttura base con tre sezioni: #page-login, #page-dashboard, #page-editor (inizialmente tutte hidden), import degli script JS come module
- `style.css` — variabili CSS per palette (massimo 3 colori + neutri), reset base, classi utility minime
- `src/firebase-config.js` — config placeholder come da CLAUDE.md
- `src/main.js` — segnaposto con TODO
- `src/auth.js` — segnaposto con TODO
- `src/dashboard.js` — segnaposto con TODO
- `src/api.js` — segnaposto con TODO
- `src/editor.js` — segnaposto con TODO
- `src/graph/renderer.js` — segnaposto con TODO
- `src/graph/layout.js` — segnaposto con TODO
- `src/graph/interaction.js` — segnaposto con TODO

## Note
- I tipi in `src/types/index.ts` devono essere completi e corretti secondo CLAUDE.md, non segnaposto
- Il `package.json` del backend deve avere script: `dev`, `build`, `start`
- Non installare dipendenze, solo creare i file
