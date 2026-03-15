# Testing Checklist — Integration Phase

This document guides testing the integrated genealogy tree app. Run these tests manually after starting the backend and frontend.

## Prerequisites
- Backend running on `http://localhost:3000`
- Frontend running on `http://localhost:5000`
- Firebase configured with service account and credentials

## 1. Authentication Flow

### Test 1.1: Login
- [ ] Open frontend at `http://localhost:5000`
- [ ] Click "Accedi con Google"
- [ ] Complete Google OAuth flow
- [ ] Redirected to `#/dashboard`
- [ ] Dashboard shows "Nessun albero ancora" (no trees yet)

### Test 1.2: Logout
- [ ] Click "Esci" button
- [ ] Redirected to login page
- [ ] Token removed from localStorage (check DevTools → Application → Local Storage)

### Test 1.3: Token Refresh
- [ ] Login again
- [ ] Keep browser open for >1 hour
- [ ] Make any action (add tree, add person)
- [ ] Should work without re-logging (Firebase SDK auto-refreshes)

## 2. Dashboard Flow

### Test 2.1: Create Tree
- [ ] Click "Nuovo albero" button
- [ ] Enter tree name (e.g., "My Family")
- [ ] Press OK
- [ ] New tree appears in dashboard
- [ ] Shows "0 persone · [today's date]"

### Test 2.2: Open Tree
- [ ] Click "Apri" button on tree card
- [ ] Navigates to `#/tree/[treeId]`
- [ ] Editor loads with empty tree
- [ ] Shows "Albero vuoto" message

### Test 2.3: Back to Dashboard
- [ ] Click "← Dashboard" button
- [ ] Returns to `#/dashboard`
- [ ] Dashboard still shows the same tree

## 3. Tree Editor — Adding Persons

### Test 3.1: Add Root Person
- [ ] In empty tree, click "Aggiungi prima persona"
- [ ] Modal opens: "Nuova persona"
- [ ] Fill form: Name, Surname, Birth date, Gender, Notes (optional)
- [ ] Click "Salva"
- [ ] Node appears in graph (blue for M, pink for F, gray for other)
- [ ] Status shows "Salvato"

### Test 3.2: Click Node → Sidebar
- [ ] Click on the node
- [ ] Right sidebar appears with person details
- [ ] Shows name, birth-death dates, gender, notes

### Test 3.3: Edit Person
- [ ] In sidebar, click "Modifica"
- [ ] Modal opens: "Modifica persona" with pre-filled data
- [ ] Change name
- [ ] Click "Salva"
- [ ] Node updates immediately
- [ ] Status shows "Salvato"

### Test 3.4: Add Partner
- [ ] Click on a node
- [ ] In sidebar, click "Aggiungi partner"
- [ ] Modal: "Nuova persona"
- [ ] Fill partner data
- [ ] Click "Salva"
- [ ] New node appears next to original
- [ ] Horizontal line connects them (PARTNER_OF edge)

### Test 3.5: Add Child to Couple
- [ ] Hover over line between couple
- [ ] Click "+" button at midpoint
- [ ] Modal: "Nuova persona"
- [ ] Fill child data
- [ ] Click "Salva"
- [ ] Child node appears below couple
- [ ] Two vertical lines connect child to parents

### Test 3.6: Add Parents to Person
- [ ] Click on a person node
- [ ] In sidebar, click "Aggiungi genitori"
- [ ] First modal: "Nuova persona" (father)
- [ ] Fill and save
- [ ] Second modal: "Nuova persona" (mother)
- [ ] Fill and save
- [ ] Two new nodes appear above
- [ ] Horizontal line between parents
- [ ] Two vertical lines from child to parents

### Test 3.7: Delete Person
- [ ] Click on a node
- [ ] In sidebar, click "Elimina"
- [ ] Confirm in dialog
- [ ] Node disappears
- [ ] All connected edges disappear
- [ ] Status shows "Salvato"

## 4. Graph Interactions

### Test 4.1: Zoom
- [ ] Scroll wheel up → graph zooms in
- [ ] Scroll wheel down → graph zooms out

### Test 4.2: Pan
- [ ] Click and drag on empty SVG area
- [ ] Graph moves with cursor

## 5. Permissions & Roles

### Test 5.1: Owner Permissions
- [ ] Logged in as tree owner
- [ ] All buttons visible: "Modifica", "Aggiungi partner", "Aggiungi genitori", "Elimina"
- [ ] Can create, edit, delete persons

### Test 5.2: Editor Permissions
- [ ] Share tree with another user as "editor"
- [ ] Login as that user
- [ ] Can open tree, see nodes
- [ ] All action buttons visible
- [ ] Can edit and add/delete persons
- [ ] Cannot delete the tree itself
- [ ] Cannot manage sharing (no "Condividi" button visible)

### Test 5.3: Viewer Permissions
- [ ] Share tree with another user as "viewer"
- [ ] Login as that user
- [ ] Can open tree, see nodes
- [ ] No action buttons visible (read-only sidebar)
- [ ] Cannot edit, add, or delete persons
- [ ] Export button still works (if implemented for viewers)

### Test 5.4: Unauthorized Access
- [ ] Try to access tree URL directly as someone not in members
- [ ] Should get error and redirect to dashboard (if error handling is implemented)

## 6. Optimistic Locking

### Test 6.1: Conflict Detection
- [ ] Open same tree in two browser tabs (or windows)
- [ ] In Tab A: add a person, save
- [ ] In Tab B: add a person, save
- [ ] Tab B should show: "Conflitto ⚠"
- [ ] Click "Ricarica"
- [ ] Tab B reloads with Tab A's changes

## 7. Export

### Test 7.1: Export JSON
- [ ] In editor, click "Esporta JSON"
- [ ] Browser downloads file: `[TreeName].json`
- [ ] File contains valid JSON with `nodes` and `edges` properties

## 8. Error Handling

### Test 8.1: Backend Offline
- [ ] Stop backend server
- [ ] Try to add a person in editor
- [ ] Should show error: "Connessione non disponibile" (if error handling implemented)

### Test 8.2: Tree Not Found
- [ ] Manually navigate to `#/tree/invalid-uuid`
- [ ] Should redirect to dashboard with error message (if error handling implemented)

### Test 8.3: Form Validation
- [ ] Open "Nuova persona" modal
- [ ] Try to save without name or surname
- [ ] Form should block submission (HTML `required` attribute)

## 9. Model Invariants

### Test 9.1: PARTNER_OF Symmetry
- [ ] Add person A
- [ ] Add partner B (automatic symmetric edges)
- [ ] Delete person A
- [ ] Person B should lose partnership (both edges removed)

### Test 9.2: No Mixed Parentage
- [ ] Add person C with biological parents
- [ ] Try to set as adopted (should fail or prevent via UI)
- [ ] Backend validation should reject invalid trees

### Test 9.3: Max 2 Parents
- [ ] Add person D with two parents
- [ ] Try to add a third parent
- [ ] UI should disable "Aggiungi genitori" button
- [ ] Backend should reject if sent anyway

### Test 9.4: No Child Without PARTNER_OF
- [ ] Create person E with no partner
- [ ] Click node, sidebar shows no "+" on non-existent couple
- [ ] Cannot add child (button should be hidden)

## Known Issues & Limitations

1. **Rename Tree**: Currently disabled (no PATCH endpoint). Use dashboard "⋮" menu if implemented.
2. **Sharing**: Requires invitee to have a Google account in Firebase (must have logged in once)
3. **Multi-tab Sync**: Optimistic locking works but requires manual reload on conflict
4. **Layout Algorithm**: Simple horizontal distribution; may overlap in very dense graphs

## Regression Testing

After each code change:
- [ ] Backend compiles: `cd backend && npm run build`
- [ ] Frontend loads without console errors
- [ ] Login flow works
- [ ] Can create and load trees
- [ ] Can add/edit/delete persons
- [ ] Export works
