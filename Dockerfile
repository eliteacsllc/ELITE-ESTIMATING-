FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --ignore-scripts --no-audit --no-fund
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S elite && adduser -S elite -G elite
COPY --from=build /app/dist ./dist
COPY package.json ./package.json
USER elite
EXPOSE 8787
CMD ["node", "dist/api/server.js"]
