FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE=https://hiveapi.100xseller.com/api
ENV VITE_API_BASE=$VITE_API_BASE

RUN npm run build

FROM node:22-alpine

WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
