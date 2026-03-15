import { Router, Request, Response, NextFunction } from "express"
import { authGuard } from "../middleware/authGuard"
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from "../services/shareService"
import { MemberRole } from "../types"

const router = Router({ mergeParams: true })

router.use(authGuard)

// POST /trees/:treeId/share — invita utente per email con ruolo
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, role } = req.body

    if (!email || !role) {
      res.status(400).json({ error: "Missing required fields: email, role" })
      return
    }

    if (!["owner", "editor", "viewer"].includes(role)) {
      res.status(400).json({ error: "Invalid role" })
      return
    }

    await inviteMember(
      req.params.treeId,
      req.user!.uid,
      email,
      role as MemberRole
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// PATCH /trees/:treeId/share/:uid — aggiorna ruolo membro
router.patch("/:uid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body

    if (!role) {
      res.status(400).json({ error: "Missing required field: role" })
      return
    }

    if (!["owner", "editor", "viewer"].includes(role)) {
      res.status(400).json({ error: "Invalid role" })
      return
    }

    await updateMemberRole(
      req.params.treeId,
      req.user!.uid,
      req.params.uid,
      role as MemberRole
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// DELETE /trees/:treeId/share/:uid — rimuovi membro
router.delete("/:uid", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeMember(
      req.params.treeId,
      req.user!.uid,
      req.params.uid
    )
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
