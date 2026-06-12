FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# URL бэкенда внутри Docker-сети (используется routeRules proxy на сервере Nuxt)
ARG NUXT_INTERNAL_API_URL=http://backend:8000
ENV NUXT_INTERNAL_API_URL=$NUXT_INTERNAL_API_URL

RUN npm run build

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]
