FROM node:18-alpine

RUN apk add zip

WORKDIR /srv/funk-melon-tusk

EXPOSE 3000

COPY ./ ./

RUN npm ci

ENTRYPOINT [ "node", "./app.mjs" ]