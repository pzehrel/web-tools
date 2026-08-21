# 语法预留（当前不构建镜像）：
# 多阶段构建，distless 收尾；数据库迁移在启动命令里执行。
# future: jobs 工具链（ffmpeg/gifsicle 等）走 full 变体，见 docs/BACKEND.md。

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @web-tools/server
COPY apps/server apps/server
RUN pnpm --filter @web-tools/server exec tsc --noEmit

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app ./
WORKDIR /app/apps/server
# 启动前跑迁移；tsx 直接执行 TS（如需编译产物可后续加 tsc 构建步骤）
CMD ["pnpm", "run", "db:migrate", "&&", "pnpm", "run", "start"]
