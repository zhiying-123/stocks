# 部署到 Vercel - 实现 24/7 价格提醒

## 🚀 为什么要部署？

**在 localhost 的问题：**
- ❌ 电脑关机后，价格提醒停止工作
- ❌ 需要一直开着电脑和应用
- ❌ 不适合生产使用

**部署到 Vercel 后：**
- ✅ 24/7 在线，永不停机
- ✅ 自动运行价格检查（Cron Jobs）
- ✅ 免费额度充足
- ✅ 自动 HTTPS 和 CDN

---

## 📋 部署前准备

### 1. 创建 GitHub 仓库

```bash
# 初始化 Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit with price alerts"

# 连接到 GitHub（创建仓库后）
git remote add origin https://github.com/your-username/h-stocks.git
git push -u origin main
```

### 2. 准备环境变量

创建 `.env.example` 文件供参考：

```env
# Database (PostgreSQL)
# Note: Add ?sslmode=verify-full for secure SSL connections
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=verify-full"

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# API Keys
FINNHUB_API_KEY=your-finnhub-api-key

# Cron Security
CRON_SECRET=your-secure-random-string

# Stripe (if using payment features)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret
```

⚠️ **不要提交 `.env` 文件到 Git！**

---

## 🔧 步骤 1: 设置 Vercel 项目

### 方法 A: 通过网站（推荐）

1. 访问 [vercel.com](https://vercel.com)
2. 注册/登录账号（可以用 GitHub 登录）
3. 点击 "New Project"
4. 选择你的 GitHub 仓库
5. Vercel 会自动检测 Next.js 项目

### 方法 B: 通过 CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
vercel
```

---

## 🗄️ 步骤 2: 配置数据库

### 选项 A: Vercel Postgres（推荐）

1. 在 Vercel 项目页面，进入 "Storage"
2. 点击 "Create Database" → 选择 "Postgres"
3. 创建数据库后，会自动添加 `DATABASE_URL` 环境变量

### 选项 B: 外部 PostgreSQL

使用其他服务提供商：
- **Neon** (neon.tech) - 免费额度大
- **Supabase** (supabase.com) - 功能丰富
- **Railway** (railway.app) - 简单易用

获取 `DATABASE_URL` 后，添加到 Vercel 环境变量。

---

## 🔑 步骤 3: 配置环境变量

### 在 Vercel 设置环境变量：

1. 进入项目 → Settings → Environment Variables
2. 添加所有必需的环境变量：

| Key | Value | 说明 |
|-----|-------|------|
| `DATABASE_URL` | `postgresql://...` | 数据库连接 |
| `EMAIL_HOST` | `smtp.gmail.com` | 邮件服务器 |
| `EMAIL_PORT` | `587` | SMTP 端口 |
| `EMAIL_USER` | `your@email.com` | 邮箱地址 |
| `EMAIL_PASS` | `app-password` | Gmail 应用密码 |
| `FINNHUB_API_KEY` | `your-key` | Finnhub API Key |
| `CRON_SECRET` | `random-string` | Cron 安全密钥 |

**生成安全的 CRON_SECRET:**
```bash
# 方法 1: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 2: 使用在线工具
# https://www.uuidgenerator.net/
```

---

## 📊 步骤 4: 运行数据库迁移

部署后需要初始化数据库：

### 方法 A: 本地运行迁移

```bash
# 设置生产数据库 URL
export DATABASE_URL="your-vercel-postgres-url"

# 运行迁移
npx prisma migrate deploy

# 生成 Prisma Client
npx prisma generate
```

### 方法 B: 在 Vercel Dashboard

1. 进入 "Settings" → "Environment Variables"
2. 添加 `DATABASE_URL`
3. 触发重新部署（Deployments → Redeploy）
4. Vercel 会自动运行 build 命令（包含迁移）

---

## ⏰ 步骤 5: 配置 Cron Jobs

### vercel.json 已创建 ✅

文件位置：`stocks/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/alerts/check",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**说明：**
- `path`: API 端点路径
- `schedule`: Cron 表达式（`*/5 * * * *` = 每 5 分钟）

### Cron 表达式参考

| 表达式 | 说明 |
|--------|------|
| `*/5 * * * *` | 每 5 分钟 |
| `*/10 * * * *` | 每 10 分钟 |
| `0 * * * *` | 每小时 |
| `0 9-16 * * 1-5` | 周一至周五 9:00-16:00 每小时 |

---

## ✅ 步骤 6: 部署验证

### 1. 检查部署状态

访问部署后的 URL（例如：`https://your-app.vercel.app`）

### 2. 测试 Cron Job

```bash
# 手动触发 Cron Job（用于测试）
curl -X POST https://your-app.vercel.app/api/alerts/check \
  -H "Authorization: Bearer your-cron-secret"
```

### 3. 查看日志

1. Vercel Dashboard → 你的项目
2. 进入 "Logs" 或 "Functions"
3. 查看 Cron Job 执行日志

### 4. 测试价格提醒

1. 登录应用
2. 创建一个接近当前价格的提醒
3. 等待下一次 Cron 执行（最多 5 分钟）
4. 检查邮箱是否收到通知

---

## 🔍 监控和调试

### 查看 Cron 执行历史

1. Vercel Dashboard → Cron Jobs
2. 查看执行时间和状态
3. 点击查看详细日志

### 常见问题排查

#### 问题 1: Cron Job 没有执行
**解决：**
- 检查 `vercel.json` 是否正确
- 确认已重新部署
- 查看 Cron Jobs 页面的状态

#### 问题 2: 数据库连接失败
**解决：**
- 检查 `DATABASE_URL` 环境变量
- 确认数据库迁移已运行
- 查看 Function logs

#### 问题 3: 邮件发送失败
**解决：**
- 检查邮件环境变量
- 确认 Gmail 应用密码正确
- 查看 API logs 中的错误信息

---

## 📊 性能优化

### 1. 调整 Cron 频率

根据需求和 API 配额调整：

```json
{
  "crons": [
    {
      "path": "/api/alerts/check",
      "schedule": "*/10 * * * *"  // 改为每 10 分钟
    }
  ]
}
```

### 2. 市场时间优化

只在交易时间频繁检查：

创建两个 Cron Jobs：

```json
{
  "crons": [
    {
      "path": "/api/alerts/check",
      "schedule": "*/5 9-16 * * 1-5"  // 交易时间：每 5 分钟
    },
    {
      "path": "/api/alerts/check",
      "schedule": "*/30 * * * *"  // 其他时间：每 30 分钟
    }
  ]
}
```

---

## 💰 费用估算

### Vercel 免费套餐限制

| 资源 | 免费额度 | 说明 |
|------|---------|------|
| 带宽 | 100 GB/月 | 通常足够 |
| Function 执行 | 100 GB-Hours/月 | 每次检查约 1 秒 |
| Cron Jobs | 无限制 | ✅ 完全免费 |
| 部署次数 | 无限制 | ✅ 完全免费 |

**估算：**
- 每 5 分钟检查一次 = 每天 288 次
- 每月约 8,640 次执行
- 假设每次 1 秒 = 2.4 小时/月
- **完全在免费额度内！** ✅

### 升级选项

如果需要更多资源：
- **Pro Plan**: $20/月
  - 更多带宽和执行时间
  - 团队协作功能
  - 密码保护

---

## 🔐 安全最佳实践

### 1. 保护 Cron 端点

代码已实现（在 `/api/alerts/check/route.ts`）：

```typescript
const authHeader = req.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 2. 使用环境变量

- ✅ 所有敏感信息存储在环境变量中
- ✅ 不要提交 `.env` 到 Git
- ✅ 在 Vercel Dashboard 配置

### 3. HTTPS

- ✅ Vercel 自动提供 HTTPS
- ✅ 自动更新 SSL 证书

---

## 📱 添加自定义域名（可选）

1. Vercel Dashboard → Settings → Domains
2. 添加你的域名
3. 按照提示配置 DNS
4. Vercel 会自动配置 HTTPS

---

## 🎯 部署后检查清单

- [ ] 应用可以访问
- [ ] 数据库连接正常
- [ ] 用户可以登录
- [ ] 可以创建价格提醒
- [ ] Cron Job 正常执行（查看 Logs）
- [ ] 邮件通知可以发送
- [ ] 浏览器通知正常工作
- [ ] 环境变量都已配置

---

## 🆘 获取帮助

### Vercel 文档
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)

### 社区支持
- [Vercel Discord](https://vercel.com/discord)
- [GitHub Discussions](https://github.com/vercel/next.js/discussions)

---

## 🎉 完成！

你的价格提醒系统现在已经 **24/7 在线运行**！

即使笔记本关机，用户也能收到及时的价格通知。 🚀
