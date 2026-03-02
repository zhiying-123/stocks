# 价格提醒通知机制说明

## 📬 当前通知方式

### 1. 邮件通知（已实现）✅

**工作流程：**
```
定时任务触发 → API 检查价格 → 条件满足 → 发送邮件 → 用户收到通知
```

**特点：**
- ✅ 可靠，不需要用户在线
- ✅ 可以保存和转发
- ❌ 可能有延迟（几秒到几分钟）
- ❌ 需要配置 SMTP 服务器

**实现位置：**
- API: `app/api/alerts/check/route.ts`
- 使用 `nodemailer` 发送邮件

---

## ⚠️ 重要限制：Localhost 运行的问题

### 问题描述

**如果应用运行在 localhost（本地电脑）：**

| 状态 | 价格检查 | 提醒通知 |
|------|---------|---------|
| 电脑开机 + 应用运行 | ✅ 工作 | ✅ 会发送 |
| 电脑关机 | ❌ 停止 | ❌ 不会发送 |
| 应用关闭 | ❌ 停止 | ❌ 不会发送 |
| 睡眠模式 | ❌ 停止 | ❌ 不会发送 |

**原因：**
价格提醒依赖于：
1. **应用服务器必须运行**（处理 API 请求）
2. **定时任务必须执行**（触发价格检查）
3. **网络连接必须正常**（获取股票价格和发送邮件）

### 解决方案：部署到云服务器

**必须部署到 24/7 在线的服务器才能实现持续监控！**

---

## 🚀 生产环境部署方案

### 方案 1: Vercel（推荐 ⭐）

**优点：**
- ✅ 免费额度充足
- ✅ 自动 HTTPS
- ✅ 内置 Cron Jobs
- ✅ 部署简单（连接 GitHub 自动部署）

**步骤：**

1. **安装 Vercel CLI**
```bash
npm install -g vercel
```

2. **创建 `vercel.json`**
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

3. **部署**
```bash
vercel --prod
```

**Cron Job 设置：**
- `*/5 * * * *` = 每 5 分钟运行一次
- Vercel 会自动调用你的 API
- 完全不需要本地电脑运行

---

### 方案 2: Railway / Render

**优点：**
- ✅ 支持 PostgreSQL 数据库
- ✅ 后台常驻进程
- ✅ 免费额度可用

**Railway 部署：**
1. 连接 GitHub 仓库
2. 配置环境变量
3. 添加 PostgreSQL 服务
4. 设置 Cron Job（使用外部服务）

**Render 部署：**
1. 创建 Web Service
2. 连接代码仓库
3. 配置环境变量
4. 使用 Render Cron Jobs

---

### 方案 3: 使用外部 Cron 服务

**如果已经部署应用，但平台不支持 Cron Jobs：**

#### 选项 A: cron-job.org（免费）

1. 注册账号: https://cron-job.org
2. 创建新任务：
   - URL: `https://your-app.vercel.app/api/alerts/check`
   - 方法: `POST`
   - 间隔: 每 5 分钟
   - Headers: `Authorization: Bearer your-secret-key`

#### 选项 B: EasyCron

1. 注册: https://www.easycron.com
2. 创建 Cron Job
3. 配置 URL 和频率

#### 选项 C: GitHub Actions

创建 `.github/workflows/check-alerts.yml`:
```yaml
name: Check Price Alerts
on:
  schedule:
    - cron: '*/5 * * * *'  # 每 5 分钟
  workflow_dispatch:  # 也可以手动触发

jobs:
  check-alerts:
    runs-on: ubuntu-latest
    steps:
      - name: Call Alert Check API
        run: |
          curl -X POST https://your-app.vercel.app/api/alerts/check \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

---

## 🔔 通知方式对比

| 方式 | 实时性 | 离线接收 | 需要配置 | 用户体验 |
|------|--------|---------|---------|---------|
| 📧 邮件 | ⭐⭐⭐ | ✅ | SMTP | ⭐⭐⭐⭐ |
| 🌐 浏览器推送 | ⭐⭐⭐⭐⭐ | ✅ | Service Worker | ⭐⭐⭐⭐⭐ |
| 📱 应用内通知 | ⭐⭐⭐⭐⭐ | ❌ | 无 | ⭐⭐⭐ |
| 📲 短信 | ⭐⭐⭐⭐⭐ | ✅ | SMS 服务费 | ⭐⭐⭐⭐⭐ |

---

## 💡 建议的改进方案

### 短期改进（可立即实现）

1. **添加浏览器通知**
   - 当用户打开网站时显示实时通知
   - 使用 Web Notification API
   - 用户在线时弹窗提醒

2. **提醒历史页面**
   - 显示所有已触发的提醒
   - 即使错过了邮件也能查看

3. **提醒状态徽章**
   - 在导航栏显示未读提醒数量
   - 类似消息通知红点

### 长期改进（需要更多开发）

1. **WebSocket 实时推送**
   - 实时价格更新
   - 即时触发通知
   - 不依赖轮询

2. **短信通知（SMS）**
   - 使用 Twilio / 阿里云
   - 重要提醒用短信
   - 需要费用

3. **移动应用推送**
   - iOS/Android 推送通知
   - 需要原生应用或 PWA

---

## 🎯 最佳实践建议

### 对于开发/测试环境（localhost）

**方法 1: 手动触发**
```powershell
# 定期手动运行测试脚本
.\scripts\check-alerts.ps1
```

**方法 2: 开发时自动检查**
创建一个简单的调度脚本 `dev-scheduler.js`:
```javascript
const { exec } = require('child_process');

// 每 5 分钟检查一次
setInterval(() => {
  console.log('Checking alerts...');
  exec('node scripts/check-alerts.js', (err, stdout) => {
    if (err) console.error(err);
    else console.log(stdout);
  });
}, 5 * 60 * 1000);
```

然后在另一个终端运行：
```bash
node dev-scheduler.js
```

### 对于生产环境

**✅ 推荐配置：**
- 部署到 Vercel 或 Railway
- 使用 Vercel Cron Jobs 或外部 cron 服务
- 配置环境变量（邮件服务）
- 设置错误监控（Sentry）

---

## 📊 检查频率建议

| 场景 | 推荐频率 | 原因 |
|------|---------|------|
| 开发测试 | 手动触发 | 节省 API 配额 |
| 生产环境 - 免费 API | 每 5-10 分钟 | Finnhub 免费版限制 |
| 生产环境 - 付费 API | 每 1-2 分钟 | 更及时的通知 |
| 盘前/盘后 | 每 30 分钟 | 交易量低，不需要频繁检查 |

**Finnhub 免费版限制：**
- 60 API 调用/分钟
- 30 API 调用/秒

---

## 🔐 安全建议

1. **保护 Cron 端点**
```typescript
// 在 /api/alerts/check/route.ts 中
const authHeader = req.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

2. **环境变量**
```env
CRON_SECRET=use-a-strong-random-string
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

3. **速率限制**
考虑添加速率限制防止滥用

---

## 📝 总结

### 当前状态
- ✅ 邮件通知已实现
- ⚠️ 仅在 localhost 运行时需要保持电脑开机
- ❌ 没有浏览器内实时通知

### 要让提醒真正有用，必须：
1. **部署到云服务器**（Vercel/Railway/Render）
2. **设置自动化 Cron Job**（每 5 分钟检查价格）
3. **配置邮件服务**（SMTP）

### 推荐方案
对于你的情况，最简单的方案是：
1. 部署到 **Vercel**（免费）
2. 使用 **Vercel Cron Jobs**（内置）
3. 添加 **浏览器通知**（作为补充）

这样即使笔记本关机，**价格提醒也能 24/7 工作**！
