# 使用官方轻量 Node.js 镜像
FROM node:22-alpine AS builder

WORKDIR /app

# 复制依赖描述文件并安装
COPY package*.json ./
RUN npm install

# 复制源码并构建前端
COPY . .
RUN npm run build

# 生产运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

# 复制构建产物和后端代码
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# 创建数据持久化目录
RUN mkdir -p /app/data

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server/server.js"]
