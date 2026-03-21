FROM node:24-alpine

WORKDIR /app

# Dipendenze backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Build TypeScript
COPY backend/tsconfig.json ./backend/
COPY backend/src/ ./backend/src/
RUN cd backend && npm run build

# Frontend statico
COPY frontend/ ./frontend/

ENV FRONTEND_PATH=/app/frontend
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "backend/dist/index.js"]