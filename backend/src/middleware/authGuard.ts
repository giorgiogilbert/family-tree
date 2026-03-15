import { Request, Response, NextFunction } from "express"
import * as admin from "firebase-admin"

// Extend Express Request to carry verified user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string
        email?: string
      }
    }
  }
}

export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" })
    return
  }

  const idToken = authHeader.slice(7)

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    }
    next()
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" })
  }
}
