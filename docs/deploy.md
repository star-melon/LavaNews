# LavaNews 部署文档

## 项目概览

Next.js 15 新闻聚合平台 — 多信源事件追踪，TF-IDF 聚类，Apple 风格暗色 UI。

**代码位置：** `D:\code_projects\web_projects\LavaNews`

## 服务器信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 8.217.217.224 |
| SSH 用户 | root |
| SSH 端口 | 22 |
| SSH 密钥 | C:/Users/andre/.ssh/xpolar.pem |
| SSH Config Host | xpolar_hk |
| 部署目录 | /opt/lavanews |

## 访问信息

| 项目 | 值 |
|------|-----|
| 访问端口 | 41873 |
| 访问密钥 | `2f2cd118b4d6a8485e66b7f27f7458cad052cf26e4f5e015ef3d8b5043cfa91f` |
| 完整 URL | http://8.217.217.224:41873/?ak=2f2cd118b4d6a8485e66b7f27f7458cad052cf26e4f5e015ef3d8b5043cfa91f |

> **注意：** 首次访问时密钥通过 URL 参数传递，之后浏览器会自动保存 cookie，后续刷新页面不需要再带 `?ak=` 参数。

## 部署步骤

### 1. 确保已安装并连接 SSH

```bash
ssh -o ConnectTimeout=30 -o ServerAliveInterval=10 -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "echo SSH OK"
```

### 2. 运行 deploy.sh 脚本

```bash
cd D:/code_projects/web_projects/LavaNews
./deploy.sh
```

### 3. 手动部署（如需更新单个文件）

```bash
# 上传修改后的文件
scp -o ConnectTimeout=30 -i "C:/Users/andre/.ssh/xpolar.pem" <本地文件路径> root@8.217.217.224:/opt/lavanews/<目标路径>

# 重新构建并启动
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "cd /opt/lavanews && docker compose up -d --build"
```

### 4. 常用运维命令

```bash
# 查看容器状态
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "cd /opt/lavanews && docker compose ps"

# 查看日志
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "docker logs lavanews-app --tail 50"
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "docker logs lavanews-nginx --tail 50"

# 重启服务
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "cd /opt/lavanews && docker compose restart"

# 停止服务
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "cd /opt/lavanews && docker compose down"

# 进入容器调试
ssh -i "C:/Users/andre/.ssh/xpolar.pem" root@8.217.217.224 "docker exec -it lavanews-app sh"
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | Next.js 15 (App Router) + React 19 |
| 语言 | TypeScript |
| 数据库 | Prisma + SQLite |
| 样式 | Tailwind CSS |
| 部署 | Docker + docker-compose |
| 反向代理 | Nginx (容器内，端口 80 → 映射到 41873) |

## 部署文件清单

| 文件 | 用途 |
|------|------|
| `Dockerfile` | 多阶段构建（Node 20 Alpine → standalone 输出） |
| `docker-compose.yml` | 3 个服务：app + nginx |
| `nginx.conf` | Nginx 配置（密钥验证 + 静态资源放行） |
| `.dockerignore` | 排除 node_modules、.next 等 |
| `.env.production` | 生产环境变量模板 |
| `deploy.sh` | 一键部署脚本 |

## 已知环境约束

- **端口 443 被 safeline WAF 占用**，不部署 SSL 在容器层
- **端口 8050、8443、9443、6787 等**已被其他服务占用
- 使用非常规端口 41873 + URL 密钥验证方式访问
- 服务器延迟约 900ms，SSH 需设置较长超时时间（30s+）

## 注意事项

1. **密钥轮换**：修改 `nginx.conf` 中的密钥值，两处（`map` 和 `Set-Cookie`），然后 `docker compose restart nginx`
2. **SQLite 数据持久化**：数据库文件在 Docker volume `app-data` 中，容器删除不会丢失
3. **SSH 连接不稳定**：sing-box 代理影响，连不上时稍等重试
4. **构建内存需求**：Next.js 构建设置 `--max-old-space-size=4096`
