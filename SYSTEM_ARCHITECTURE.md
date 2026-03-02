# 价格提醒系统架构图

## 系统整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      价格提醒系统架构                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐          ┌──────────────────┐
│   用户浏览器      │          │  Vercel 云平台    │
│                  │          │                  │
│  1. 创建提醒     │───①────▶│  Next.js 应用    │
│  2. 查看提醒     │          │                  │
│  3. 接收通知     │◀───⑤────│  • API Routes    │
└──────────────────┘          │  • Server Side   │
                              └──────────────────┘
                                      │ ②
                                      ▼
                              ┌──────────────────┐
                              │  PostgreSQL      │
                              │  数据库          │
                              │                  │
                              │  • Users         │
                              │  • PriceAlerts   │
                              │  • StockHoldings │
                              └──────────────────┘
                                      ▲
                                      │ ③
┌──────────────────┐                  │
│  Vercel Cron     │                  │
│  定时任务        │──────────────────┘
│                  │
│  每 5 分钟运行   │───④────▶ 检查价格 & 发送通知
└──────────────────┘
        │
        ▼
┌──────────────────┐          ┌──────────────────┐
│  Finnhub API     │          │  SMTP 服务器     │
│  股票价格数据    │          │  邮件发送        │
└──────────────────┘          └──────────────────┘
```

## 详细流程说明

### ① 用户创建提醒
```
用户 → 股票详情页 → 点击 "Set Alert" → 填写表单 → POST /api/alerts
  ↓
保存到数据库（PriceAlert 表）
  • symbol: AAPL
  • alert_type: TARGET_PRICE
  • target_price: 150
  • is_active: true
```

### ② 数据持久化
```
PostgreSQL 数据库表结构：

PriceAlert
├─ alert_id (主键)
├─ u_id (用户ID)
├─ symbol (股票代码)
├─ alert_type (提醒类型)
├─ condition (条件：ABOVE/BELOW)
├─ target_price (目标价格)
├─ is_active (是否激活)
├─ is_triggered (是否已触发)
└─ triggered_at (触发时间)
```

### ③ Cron Job 自动执行
```
Vercel Cron Jobs (vercel.json)
  ↓
每 5 分钟触发一次
  ↓
POST /api/alerts/check
  • 需要 Authorization 验证
  • 在 Vercel 云端运行
  • 不依赖本地电脑
```

### ④ 价格检查与通知
```
/api/alerts/check 执行流程：

1. 查询数据库
   SELECT * FROM PriceAlert 
   WHERE is_active = true AND is_triggered = false

2. 获取股票价格（每个唯一股票代码）
   Finnhub API: GET /quote?symbol=AAPL

3. 比较价格与条件
   IF (current_price >= target_price AND condition = 'ABOVE')
   OR (current_price <= target_price AND condition = 'BELOW')
   THEN trigger = true

4. 触发提醒
   ├─ 更新数据库（is_triggered = true）
   ├─ 获取用户邮箱
   └─ 发送邮件通知

5. 发送邮件
   SMTP → Gmail → 用户邮箱
```

### ⑤ 用户接收通知
```
通知方式 1: 邮件 📧
  ├─ 24/7 可接收
  ├─ 不需要在线
  └─ 延迟：几秒到几分钟

通知方式 2: 浏览器通知 🔔
  ├─ 用户打开网站时
  ├─ 调用 /api/alerts/triggered
  ├─ 显示浏览器推送
  └─ 显示页面弹窗
```

## 关键对比：Localhost vs 云部署

### Localhost (本地开发)
```
┌─────────────┐
│  你的笔记本  │
│             │
│  ┌────────┐ │        ❌ 关机后停止
│  │Next.js │ │        ❌ 需要一直开着
│  └────────┘ │        ❌ 依赖本地网络
│      ↓      │        ❌ 不适合生产
│  ┌────────┐ │
│  │ Cron?  │ │ ← 需要手动运行或使用任务计划
│  └────────┘ │
└─────────────┘
```

### Vercel 部署 (生产环境)
```
┌──────────────────────────────┐
│      Vercel 云平台            │
│                              │
│  ┌────────────────────────┐  │  ✅ 24/7 在线
│  │  Next.js Serverless    │  │  ✅ 自动扩展
│  │  Functions             │  │  ✅ 全球 CDN
│  └────────────────────────┘  │  ✅ 免费额度
│            ↓                 │
│  ┌────────────────────────┐  │
│  │  Vercel Cron Jobs      │  │  ✅ 自动执行
│  │  (每 5 分钟)           │  │  ✅ 无需配置
│  └────────────────────────┘  │  ✅ 内置功能
│            ↓                 │
│  ┌────────────────────────┐  │
│  │  PostgreSQL Database   │  │  ✅ 托管数据库
│  └────────────────────────┘  │  ✅ 自动备份
└──────────────────────────────┘
         ↓
    用户邮箱 📧
```

## 数据流动示意

```
创建提醒流程：
─────────────

浏览器 → Next.js → PostgreSQL
  "Set Alert"
   AAPL @ $150


价格检查流程（每 5 分钟）：
──────────────────────────

Vercel Cron
    ↓
/api/alerts/check
    ↓
查询活跃提醒 → PostgreSQL
    ↓
获取价格 → Finnhub API
    ↓
比较 & 判断
    ↓
  满足条件？
    ├─ Yes → 发送邮件 → SMTP → 用户
    │         ↓
    │       更新数据库
    │
    └─ No → 继续监控


浏览器通知流程（用户在线时）：
────────────────────────────

用户打开网站
    ↓
/api/alerts/triggered
    ↓
查询已触发提醒
    ↓
显示通知
    ├─ 浏览器推送 🔔
    └─ 页面弹窗 💬
```

## 技术栈

```
前端：
├─ Next.js 16 (App Router)
├─ React 19
├─ TypeScript
└─ Tailwind CSS

后端：
├─ Next.js API Routes
├─ Prisma ORM
├─ PostgreSQL
└─ Nodemailer (邮件)

部署：
├─ Vercel (应用托管)
├─ Vercel Cron Jobs (定时任务)
└─ Vercel Postgres (数据库)

外部 API：
├─ Finnhub (股票数据)
└─ Gmail SMTP (邮件发送)
```

## 关键配置文件

```
项目结构：
stocks/
├─ vercel.json              ← Cron Jobs 配置
├─ prisma/
│  └─ schema.prisma         ← 数据库模型
├─ app/
│  ├─ api/
│  │  └─ alerts/
│  │     ├─ route.ts        ← CRUD API
│  │     ├─ check/
│  │     │  └─ route.ts     ← 价格检查 (Cron 调用)
│  │     └─ triggered/
│  │        └─ route.ts     ← 获取已触发提醒
│  ├─ h_stocks/
│  │  └─ alerts/
│  │     ├─ page.tsx        ← 提醒管理页面
│  │     └─ alertsUI.tsx    ← UI 组件
│  └─ components/
│     └─ AlertNotificationProvider.tsx  ← 浏览器通知
└─ scripts/
   └─ check-alerts.ps1      ← 测试脚本
```

## 环境变量依赖

```
必需的环境变量：

DATABASE_URL=postgresql://...     ← 数据库连接
EMAIL_HOST=smtp.gmail.com         ← SMTP 服务器
EMAIL_PORT=587                    ← SMTP 端口
EMAIL_USER=your@email.com         ← 邮箱地址
EMAIL_PASS=app-password           ← Gmail 应用密码
CRON_SECRET=random-string         ← Cron 安全密钥
FINNHUB_API_KEY=your-key          ← 股票 API

在 Vercel Dashboard 配置所有这些变量！
```

## 成本估算

```
Vercel 免费套餐：

每月限额：
├─ 带宽：100 GB
├─ Function 执行：100 GB-Hours
├─ Cron Jobs：无限制 ✅
└─ 部署次数：无限制 ✅

实际使用（每 5 分钟检查）：
├─ 每天：288 次执行
├─ 每月：8,640 次执行
├─ 估计耗时：2.4 小时/月
└─ 结论：完全在免费额度内！ ✅

额外成本：
├─ Gmail SMTP：免费 ✅
├─ Finnhub API：免费版 60 calls/min ✅
└─ PostgreSQL：Vercel 免费套餐 ✅

总成本：$0/月 🎉
```

## 安全机制

```
1. Cron 端点保护
   Authorization: Bearer {CRON_SECRET}
   ├─ 防止未授权访问
   └─ 只有 Vercel Cron 可以调用

2. 用户认证
   Cookie-based authentication
   ├─ 登录后才能创建提醒
   └─ 只能查看自己的提醒

3. 数据验证
   ├─ 价格 > 0
   ├─ 百分比 > 0
   └─ 股票代码有效性

4. HTTPS
   ├─ Vercel 自动提供
   └─ 所有通信加密
```

这个架构图直观地展示了整个价格提醒系统的工作原理！🎨
