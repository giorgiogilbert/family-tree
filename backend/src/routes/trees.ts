import { Router, Request, Response, NextFunction } from "express"
import { authGuard } from "../middleware/authGuard"
import {
  createTree,
  listTrees,
  getTree,
  saveTree,
  deleteTree,
} from "../services/treeService"

const router = Router()

router.use(authGuard)

// POST /trees — crea nuovo albero
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body

    if (!name) {
      res.status(400).json({ error: "Missing required field: name" })
      return
    }

    const tree = await createTree(req.user!.uid, name)
    res.status(201).json(tree)
  } catch (err) {
    next(err)
  }
})

// GET /trees — lista alberi dell'utente
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trees = await listTrees(req.user!.uid)
    res.json(trees)
  } catch (err) {
    next(err)
  }
})

// GET /trees/:treeId/export — restituisce JSON puro (nodes + edges)
// Nota: questa rotta deve venire PRIMA di GET /:treeId per evitare che 'export' venga interpretato come treeId
router.get("/:treeId/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await getTree(req.params.treeId, req.user!.uid)
    res.json({
      nodes: tree.nodes,
      edges: tree.edges,
    })
  } catch (err) {
    next(err)
  }
})

// GET /trees/:treeId — leggi albero completo
router.get("/:treeId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await getTree(req.params.treeId, req.user!.uid)
    res.json(tree)
  } catch (err) {
    next(err)
  }
})

// PUT /trees/:treeId — salva albero completo (con version check)
router.put("/:treeId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = req.body

    if (!tree || !tree.id || tree.version === undefined) {
      res.status(400).json({
        error: "Invalid tree object: missing id or version",
      })
      return
    }

    await saveTree(tree, req.user!.uid)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /trees/:treeId — elimina albero (solo owner)
router.delete("/:treeId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteTree(req.params.treeId, req.user!.uid)
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
