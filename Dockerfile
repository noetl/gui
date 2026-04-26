FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

RUN npm run build

FROM nginx:1.27-alpine
ARG APP_VERSION=0.0.0

LABEL org.opencontainers.image.title="NoETL GUI" \
      org.opencontainers.image.description="Terminal-first NoETL web workspace" \
      org.opencontainers.image.source="https://github.com/noetl/gui" \
      org.opencontainers.image.licenses="ISC" \
      org.opencontainers.image.version="${APP_VERSION}"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/env.sh /docker-entrypoint.d/40-write-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-env-config.sh

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
