FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
RUN npm i

FROM base AS builder
# NEXT_PUBLIC_* 는 빌드 시 클라이언트 번들에 박히므로 compose build.args 로 넘긴다 (.env* 는 .dockerignore)
ARG NEXT_PUBLIC_API_DOMAIN
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_AI_API_DOMAIN
ARG NEXT_PUBLIC_KAKAO_CLIENT_ID
ARG NEXT_PUBLIC_KAKAO_REDIRECT_URI
ENV NEXT_PUBLIC_API_DOMAIN=${NEXT_PUBLIC_API_DOMAIN} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_AI_API_DOMAIN=${NEXT_PUBLIC_AI_API_DOMAIN} \
    NEXT_PUBLIC_KAKAO_CLIENT_ID=${NEXT_PUBLIC_KAKAO_CLIENT_ID} \
    NEXT_PUBLIC_KAKAO_REDIRECT_URI=${NEXT_PUBLIC_KAKAO_REDIRECT_URI}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# 실행은 root 가 아닌 node 사용자로 한다. .next 는 실행 중 캐시를 쓰므로 node 소유로 복사한다
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
