# Come lanciare Claude Code

## Setup iniziale

Assicurati di avere Claude Code installato:
```bash
npm install -g @anthropic-ai/claude-code
```

Posizionati nella root del progetto dove si trovano CLAUDE.md e la cartella prompts/.

---

## Step 1 — Scaffolding (esegui per primo, aspetta che finisca)

```bash
claude < prompts/agent-0-scaffolding.md
```

---

## Step 2 — Agenti paralleli (apri 3 terminali separati, lancia insieme)

**Terminale 1 — Backend:**
```bash
claude < prompts/agent-1-backend.md
```

**Terminale 2 — Auth + Dashboard:**
```bash
claude < prompts/agent-2-auth-dashboard.md
```

**Terminale 3 — Graph Editor:**
```bash
claude < prompts/agent-3-graph-editor.md
```

---

## Step 3 — Integrazione (esegui dopo che i 3 agenti paralleli hanno finito)

```bash
claude < prompts/agent-4-integration.md
```

---

## Alternativa: un agente alla volta (più lento ma più controllabile)

```bash
claude < prompts/agent-0-scaffolding.md && \
claude < prompts/agent-1-backend.md && \
claude < prompts/agent-2-auth-dashboard.md && \
claude < prompts/agent-3-graph-editor.md && \
claude < prompts/agent-4-integration.md
```

---

## Note
- Ogni agente legge CLAUDE.md autonomamente — assicurati che sia nella root
- Se un agente fa domande, rispondi facendo riferimento a CLAUDE.md
- In caso di conflitti tra agenti paralleli, l'Agent 4 li risolve
