FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8000

# host/port live in vite.config.ts so the container and bare `npm run dev`
# behave identically.
CMD ["npm", "run", "dev"]


