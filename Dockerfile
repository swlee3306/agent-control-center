# Single-image build: server + web static

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY web/package.json web/package-lock.json* ./web/
COPY server/package.json server/package-lock.json* ./server/
RUN npm install

COPY web ./web
COPY server ./server

RUN npm -w web run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/
RUN npm install

# tmux is required to control panes from inside the container
RUN apk add --no-cache tmux

COPY server ./server
COPY --from=build /app/web/dist ./server/public

ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "./server/src/index.ts"]
