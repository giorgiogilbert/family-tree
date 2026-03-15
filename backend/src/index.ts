import "dotenv/config";
import * as admin from "firebase-admin";

import https from "https";
import fs from "fs";

// Initialize Firebase Admin SDK BEFORE any other imports
if (!admin.apps.length) {
  admin.initializeApp();
}

import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { ConflictError, NotFoundError, ForbiddenError } from "./types";
import treesRouter from "./routes/trees";
import sharingRouter from "./routes/sharing";

const app = express();
const PORT = process.env.PORT ?? 3000;

/*app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://accounts.google.com",
        ],
        connectSrc: [
          "'self'",
          "https://www.gstatic.com", // ← aggiungi questo
          "https://*.googleapis.com",
          "https://*.firebaseio.com",
          "https://securetoken.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://accounts.google.com",
        ],
        frameSrc: [
          "'self'",
          "https://*.firebaseapp.com",
          "https://accounts.google.com",
          "https://apis.google.com", // ← mancava
        ],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"], // ← mancava
      },
    },
  }),
);*/
// Configure CORS for both development and production
/*const allowedOrigins = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:3000", // Frontend dev sometimes runs on 3000 too
  "https://localhost:3000", // Frontend dev sometimes runs on 3000 too
  // Add production origins here when deploying
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);*/
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../../frontend")));

// Mount routers
app.use("/trees", treesRouter);
app.use("/trees/:treeId/share", sharingRouter);

// SPA fallback: serve index.html for non-API routes (client handles hash routing)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

// Global error handler
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Error:", err.message);

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message, code: "CONFLICT" });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
};

app.use(errorHandler);

if (process.env.NODE_ENV === "production") {
  // In produzione Fly.io gestisce HTTPS esternamente (reverse proxy)
  // Express riceve traffico HTTP normale sulla porta interna
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
} else {
  const key = fs.readFileSync("localhost-key.pem");
  const cert = fs.readFileSync("localhost.pem");

  https.createServer({ key, cert }, app).listen(PORT, () => {
    console.log(`Backend running on https://localhost:${PORT}`);
  });
}

export default app;
