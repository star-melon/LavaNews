# 新闻聚合平台 (News Aggregation Platform)

多信源事件追踪 — 根据主流新闻机构报道数量，实时发现全球热点事件。

## 核心功能

- **多源抓取**: GNews API + RSS feeds，覆盖 AFP、Reuters、BBC、CNN 等全球主流信源
- **事件聚类**: TF-IDF + 余弦相似度自动将相关文章归组为同一事件
- **信源排序**: 按覆盖信源数量降序排列，信源越多的事件越靠前
- **Apple 风格 UI**: 参考 Apple DESIGN.md 的极简暗色设计

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 GNews API key（可选，没有也能用 RSS）

# 3. 初始化数据库
npx prisma generate
npx prisma db push

# 4. 填充测试数据
npx tsx scripts/seed.ts

# 5. 启动开发服务器
npm run dev
```

打开 http://localhost:3000

## 项目结构

```
app/           # Next.js App Router pages + API routes
components/    # React UI components (Apple-style)
lib/           # Business logic (clustering, fetching, DB)
prisma/        # Database schema
scripts/       # Seed script
tests/         # Unit tests for clustering
```

## API

- `GET /api/events` — 获取排序后的事件列表
- `POST /api/fetch` — 触发新闻抓取（仅开发环境）

## 技术栈

- Next.js 15 (App Router)
- React 19
- TypeScript
- Prisma + SQLite
- Tailwind CSS
- TF-IDF 自定义聚类引擎
