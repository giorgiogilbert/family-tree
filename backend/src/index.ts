import "dotenv/config"
import express, { ErrorRequestHandler } from "express"
import cors from "cors"
import helmet from "helmet"
import * as admin from "firebase-admin"
import { ConflictError, NotFoundError, ForbiddenError } from "./types"
import treesRouter from "./routes/trees"
import sharingRouter from "./routes/sharing"

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp()
}

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors())
app.use(express.json())

// Mount routers
app.use("/trees", treesRouter)
app.use("/trees/:treeId/share", sharingRouter)

// Global error handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error("Error:", err.message)

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message, code: "CONFLICT" })
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message })
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message })
  } else {
    res.status(500).json({ error: "Internal server error" })
  }
}

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})

export default app
