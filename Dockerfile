# Multi-stage build
FROM node:20-alpine as base
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./ 
RUN npm i --silent
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules /app/node_modules
COPY --from=base /app/dist /app/dist
COPY package.json /app/package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
