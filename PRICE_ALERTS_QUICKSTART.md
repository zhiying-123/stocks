# 价格提醒功能 - 快速开始指南

## ✅ 已完成的功能

### 1. 数据库模型 ✓
- 创建了 `PriceAlert` 数据表
- 支持目标价格和百分比变化两种提醒类型
- 包含触发状态和通知记录

### 2. API 端点 ✓
- `GET /api/alerts` - 获取用户的所有提醒
- `POST /api/alerts` - 创建新的价格提醒
- `PATCH /api/alerts` - 更新提醒状态（激活/停用）
- `DELETE /api/alerts?alertId={id}` - 删除提醒
- `POST /api/alerts/check` - 检查并触发价格提醒（需要认证）

### 3. 用户界面 ✓
- 价格提醒管理页面: `/h_stocks/alerts`
- 股票详情页添加"设置提醒"按钮
- 提醒创建对话框（支持目标价格和百分比变化）
- 提醒列表展示（活跃、已触发、未激活）

### 4. 导航集成 ✓
- 已添加到主导航菜单
- 图标: 🔔
- 需要登录才能访问

## 🚀 如何使用

### 步骤 1: 配置环境变量

编辑 `.env` 文件（参考 `.env.example`）：

```env
# 邮件配置（必需）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# Cron 安全密钥（必需）
CRON_SECRET=your-secure-random-string
```

**Gmail 设置：**
1. 启用两步验证
2. 生成应用专用密码: https://myaccount.google.com/apppasswords
3. 将应用密码填入 `EMAIL_PASS`

### 步骤 2: 启动开发服务器

```bash
cd stocks
npm run dev
```

访问: http://localhost:3000

### 步骤 3: 创建第一个提醒

**方法 A - 从股票详情页：**
1. 访问任意股票页面，例如: http://localhost:3000/h_stocks/stocks/AAPL
2. 点击右上角 "🔔 Set Alert" 按钮
3. 选择提醒类型（目标价格或百分比变化）
4. 设置条件（上涨或下跌）
5. 输入目标值
6. 点击 "Create Alert"

**方法 B - 从提醒管理页：**
1. 访问: http://localhost:3000/h_stocks/alerts
2. 通过导航到股票详情页创建提醒

### 步骤 4: 测试价格检查

运行测试脚本：

```powershell
# 编辑 scripts/check-alerts.ps1，设置正确的 CRON_SECRET
# 然后运行：
.\scripts\check-alerts.ps1
```

或手动调用 API：

```powershell
$headers = @{ "Authorization" = "Bearer your-secret-key" }
Invoke-RestMethod -Uri "http://localhost:3000/api/alerts/check" -Method POST -Headers $headers
```

## 📋 提醒类型说明

### 1. 目标价格提醒 (TARGET_PRICE)

**示例：** 当 AAPL 跌至 $150 时提醒我
- 提醒类型: 目标价格
- 条件: 下跌 (Below)
- 目标价格: 150

**触发条件：** 当前价格 ≤ $150

### 2. 百分比变化提醒 (PERCENTAGE_CHANGE)

**示例：** 当 TSLA 上涨 10% 时提醒我
- 提醒类型: 百分比变化
- 条件: 上涨 (Above)
- 百分比: 10%

**触发条件：** (当前价格 - 基准价格) / 基准价格 × 100 ≥ 10%

## ⚙️ 自动化检查设置

### 选项 1: Windows 任务计划程序

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器：每 5 分钟
4. 操作：启动程序
   - 程序：`powershell.exe`
   - 参数：`-File "C:\path\to\stocks\scripts\check-alerts.ps1"`

### 选项 2: Vercel Cron Jobs（生产环境）

创建 `vercel.json`:

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

### 选项 3: 外部 Cron 服务

使用 [cron-job.org](https://cron-job.org):
- URL: `https://your-domain.com/api/alerts/check`
- 间隔: 每 5 分钟
- 方法: POST
- Header: `Authorization: Bearer your-secret-key`

## 📊 数据库迁移

数据库迁移已自动应用：
- Migration: `20260227151939_add_price_alert`
- 表: `PriceAlert`

查看迁移文件:
```
prisma/migrations/20260227151939_add_price_alert/migration.sql
```

## 🔍 功能测试清单

- [ ] 创建目标价格提醒（上涨）
- [ ] 创建目标价格提醒（下跌）
- [ ] 创建百分比变化提醒
- [ ] 查看所有提醒列表
- [ ] 停用/激活提醒
- [ ] 删除提醒
- [ ] 运行价格检查脚本
- [ ] 接收邮件通知
- [ ] 验证提醒状态更新为"已触发"

## 📁 文件结构

```
stocks/
├── app/
│   ├── api/
│   │   └── alerts/
│   │       ├── route.ts          # 提醒 CRUD API
│   │       └── check/
│   │           └── route.ts      # 价格检查和通知 API
│   └── h_stocks/
│       ├── alerts/
│       │   ├── page.tsx          # 提醒管理页面
│       │   └── alertsUI.tsx      # 提醒列表组件
│       └── stocks/
│           └── [symbol]/
│               └── stockDetailUI.tsx  # 包含提醒按钮
├── prisma/
│   ├── schema.prisma             # 包含 PriceAlert 模型
│   └── migrations/
│       └── 20260227151939_add_price_alert/
│           └── migration.sql     # 数据库迁移
├── scripts/
│   └── check-alerts.ps1          # 测试脚本
├── .env.example                  # 环境变量模板
├── PRICE_ALERTS.md              # 详细文档
└── PRICE_ALERTS_QUICKSTART.md   # 本文件
```

## 🎯 使用场景

### 场景 1: 买入机会
设置 AAPL 跌至 $150 的提醒，等待买入机会

### 场景 2: 止损
持有 TSLA，设置下跌 10% 提醒，及时止损

### 场景 3: 止盈
持有 GOOGL，设置上涨 20% 提醒，获利了结

### 场景 4: 市场监控
为观察列表中的所有股票设置涨跌 5% 提醒

## ⚠️ 注意事项

1. **API 限制**: Finnhub 免费版有调用限制，建议检查间隔不少于 5 分钟
2. **市场时间**: 只在交易时段（周一-周五 9:30-16:00 EST）频繁检查
3. **触发一次**: 提醒触发后自动停用，避免重复通知
4. **邮件延迟**: SMTP 发送可能有延迟，请耐心等待
5. **安全密钥**: 保护好 `CRON_SECRET`，不要提交到 Git

## 🐛 常见问题

### Q: 无法创建提醒
**A:** 确保已登录，且股票代码有效

### Q: 没有收到邮件通知
**A:** 检查：
1. `.env` 中邮件配置是否正确
2. Gmail 应用密码是否有效
3. 检查垃圾邮件箱
4. 查看服务器日志

### Q: 提醒没有触发
**A:** 检查：
1. 提醒状态是否为"活跃"
2. 价格检查是否正常运行
3. 目标价格是否合理
4. 定时任务是否执行

### Q: 如何测试邮件发送
**A:** 创建一个接近当前价格的提醒，然后手动运行 `check-alerts.ps1`

## 📞 获取帮助

阅读详细文档: `PRICE_ALERTS.md`

## 🎉 完成！

价格提醒功能已全部实现并可用。开始创建你的第一个提醒吧！

访问: http://localhost:3000/h_stocks/alerts
