# Agent 3 — Graph Editor SVG

Leggi CLAUDE.md prima di fare qualsiasi cosa.

Il tuo compito è implementare l'editor SVG interattivo dell'albero genealogico. È il componente più complesso del frontend.

## src/graph/layout.js

Algoritmo di posizionamento automatico dei nodi per generazioni.

```javascript
// Input: { nodes, edges }
// Output: Map<nodeId, { x, y }>

export function computeLayout(nodes, edges) {
  // 1. Assegna ogni nodo a una generazione (asse Y)
  //    - trova i nodi radice (nessun CHILD_OF in entrata)
  //    - BFS verso il basso lungo CHILD_OF/ADOPTED_BY
  //    - generazione 0 = radici, generazione 1 = figli, ecc.
  //
  // 2. Distribuisci orizzontalmente (asse X)
  //    - all'interno di ogni generazione, centra rispetto ai genitori
  //    - i partner sono affiancati orizzontalmente
  //
  // 3. Costanti di layout:
  const NODE_WIDTH  = 160
  const NODE_HEIGHT = 80
  const H_GAP       = 40   // spazio orizzontale tra nodi
  const V_GAP       = 120  // spazio verticale tra generazioni
}
```

## src/graph/renderer.js

Rendering SVG del grafo con zoom e pan.

### Struttura SVG
```svg
<svg id="graph-svg">
  <g id="graph-root" transform="translate(0,0) scale(1)">
    <g id="edges-layer">  <!-- archi sotto i nodi -->
    <g id="nodes-layer">  <!-- nodi sopra gli archi -->
  </g>
</svg>
```

### Zoom e Pan
```javascript
// Zoom: wheel event → aggiorna scale (min 0.2, max 3)
// Pan: mousedown + mousemove su SVG background → aggiorna translate
// Applica: graphRoot.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`)
export function initZoomPan(svg, graphRoot)
```

### Rendering nodi
Ogni PersonNode diventa un gruppo SVG:
```svg
<g class="node" data-id="n1" transform="translate(x, y)">
  <rect width="160" height="80" rx="8"/>
  <text class="node-name" x="80" y="30">Mario Rossi</text>
  <text class="node-dates" x="80" y="50">1950 – 2020</text>
  <text class="node-gender-icon" x="16" y="30">♂</text>
</g>
```

Stili per genere: classe CSS `node--male`, `node--female`, `node--other`.

### Rendering archi

**PARTNER_OF**: linea orizzontale tra i centri dei due partner
```svg
<line class="edge edge--partner" x1="..." y1="..." x2="..." y2="..."/>
```
Sul punto centrale della linea, posiziona il pulsante "aggiungi figlio":
```svg
<g class="add-child-btn" data-from="n1" data-to="n2" transform="translate(mx, my)">
  <circle r="12"/>
  <text>+</text>
</g>
```

**CHILD_OF / ADOPTED_BY**: linea verticale dal figlio verso la linea dei genitori
- Tratteggiata per ADOPTED_BY (`stroke-dasharray="6,3"`)
- Continua per CHILD_OF

### API del renderer
```javascript
export function initRenderer(svgElement)
export function renderGraph(nodes, edges, positions)  // ridisegna tutto
export function highlightNode(nodeId)
export function clearHighlight()
```

## src/graph/interaction.js

Gestione delle interazioni utente.

### Click su nodo
Apre un pannello laterale (sidebar) con:
- Dettagli persona (nome, cognome, date, genere, note)
- Se ruolo è editor: bottoni Modifica, Elimina
- Bottoni contestuali:
  - "Aggiungi partner" (sempre disponibile se editor)
  - "Aggiungi genitori" (solo se nodo ha < 2 genitori e ruolo editor)

### Click su "aggiungi figlio" (sull'arco PARTNER_OF)
Apre modale form persona → crea figlio della coppia.

### Modale persona
Form riusabile per add e edit:
```
Nome *        [input]
Cognome *     [input]
Genere        [select: M / F / Altro]
Data nascita  [input date]
Data morte    [input date]
Note          [textarea]
              [Annulla] [Salva]
```

### Flusso add nodo

Tutte le azioni costruiscono le operazioni localmente sul grafo in memoria, poi chiamano `api.trees.save(tree)`. In caso di ConflictError mostrano: "L'albero è stato modificato da un'altra sessione. Ricaricare?"

```javascript
export function initInteraction(renderer, getTree, saveTree, userRole)
// userRole: "owner" | "editor" | "viewer"
// Se viewer: nessun bottone di modifica visibile
```

### Azioni che modificano il grafo

Implementa queste funzioni pure (no side effects, ritornano il nuovo stato):

```javascript
// Tutte in src/graph/interaction.js o src/graph/operations.js

function addRoot(tree, personData)
function addPartner(tree, nodeId, personData)
function addChild(tree, parentAId, parentBId, personData)
function addParents(tree, nodeId, fatherData, motherData)
function updateNode(tree, nodeId, personData)
function removeNode(tree, nodeId)
// removeNode deve rimuovere anche tutti gli archi collegati
// e i PARTNER_OF simmetrici
```

## src/editor.js

Coordinatore: carica l'albero, inizializza renderer e interaction, gestisce salvataggio.

```javascript
export async function initEditor(treeId, userRole) {
  const tree = await api.trees.get(treeId)
  // ... inizializza renderer, layout, interaction
  // ... gestisce auto-save o save manuale
}
```

Mostra in alto: nome albero + indicatore "Salvato" / "Salvataggio..." / "Conflitto ⚠"

## Note
- Niente framework, ES modules nativi
- Niente librerie esterne per il grafo — solo SVG vanilla
- Il layout ricalcola sempre tutto da zero ad ogni modifica (semplice e corretto)
- Non ottimizzare prematuramente: re-render completo va benissimo per centinaia di nodi
- Tutti i testi UI in italiano
