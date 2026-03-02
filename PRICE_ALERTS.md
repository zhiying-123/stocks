# 价格提醒功能说明

## 功能概述

价格提醒系统允许用户设置股票价格通知，当股票价格达到目标条件时，系统会自动发送邮件通知。

## 功能特点

### 1. 两种提醒类型
- **目标价格提醒**: 当股票价格达到指定目标价格时触发
- **百分比变化提醒**: 当股票价格相对于基准价格变化达到指定百分比时触发

### 2. 灵活的条件设置
- **上涨提醒**: 价格上涨到目标值或上涨指定百分比
- **下跌提醒**: 价格下跌到目标值或下跌指定百分比

### 3. 提醒管理
- 查看所有提醒（活跃、已触发、未激活）
- 激活/停用提醒
- 删除提醒
- 实时查看当前价格和变化

## 使用方法

### 创建提醒

**方式1: 从股票详情页**
1. 访问任意股票详情页 (例如: `/h_stocks/stocks/AAPL`)
2. 点击右上角的 "🔔 Set Alert" 按钮
3. 选择提醒类型和条件
4. 输入目标价格或百分比
5. 点击 "Create Alert" 创建

**方式2: 从价格提醒页面**
1. 访问 `/h_stocks/alerts`
2. 浏览现有提醒
3. 通过股票详情页创建新提醒

### 管理提醒

访问 `/h_stocks/alerts` 查看和管理所有提醒：
- **活跃提醒**: 正在监控中的提醒
- **已触发提醒**: 条件已满足的提醒（会收到邮件通知）
- **未激活提醒**: 暂时停用的提醒

## API端点

### 1. 提醒管理 API
- `GET /api/alerts` - 获取用户所有提醒
- `POST /api/alerts` - 创建新提醒
- `PATCH /api/alerts` - 更新提醒状态（激活/停用）
- `DELETE /api/alerts?alertId={id}` - 删除提醒

### 2. 价格检查 API
- `POST /api/alerts/check` - 检查所有活跃提醒并触发通知

## 自动化价格检查

为了实现自动价格监控，需要设置定时任务调用 `/api/alerts/check` 端点。

### 方法1: 使用 Windows 任务计划程序

1. 创建 PowerShell 脚本 `check-alerts.ps1`:
```powershell
$headers = @{
    "Authorization" = "Bearer your-secret-key"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/alerts/check" -Method POST -Headers $headers
```

2. 打开任务计划程序，创建新任务
3. 设置触发器：每 5 分钟执行一次（市场开盘时间）
4. 设置操作：运行 PowerShell 脚本

### 方法2: 使用 Vercel Cron Jobs（推荐用于生产环境）

在 `vercel.json` 中添加：
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

### 方法3: 使用外部 Cron 服务

使用 [cron-job.org](https://cron-job.org) 或类似服务：
- URL: `https://your-domain.com/api/alerts/check`
- 频率: 每 5 分钟
- 方法: POST
- Headers: `Authorization: Bearer your-secret-key`

## 环境变量配置

在 `.env` 文件中配置：

```env
# Email Configuration (用于发送提醒通知)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cron Security (保护价格检查端点)
CRON_SECRET=your-secure-random-string
```

### Gmail 设置步骤
1. 登录 Google 账户
2. 启用两步验证
3. 生成应用专用密码: https://myaccount.google.com/apppasswords
4. 将应用密码填入 `EMAIL_PASS`

## 数据库模型

```prisma
model PriceAlert {
  alert_id          Int       @id @default(autoincrement())
  u_id              Int
  symbol            String
  alert_type        String    // "TARGET_PRICE" or "PERCENTAGE_CHANGE"
  condition         String    // "ABOVE" or "BELOW"
  target_price      Float?
  percentage_change Float?
  reference_price   Float?    // 创建提醒时的价格
  is_active         Boolean   @default(true)
  is_triggered      Boolean   @default(false)
  triggered_at      DateTime?
  triggered_price   Float?
  notified          Boolean   @default(false)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  @@index([u_id])
  @@index([symbol])
  @@index([is_active, is_triggered])
}
```

## 示例场景

### 场景 1: 买入机会提醒
用户想在 AAPL 股票跌至 $150 时买入：
- 提醒类型: 目标价格
- 条件: 下跌（Below）
- 目标价格: 150.00

### 场景 2: 止损提醒
用户持有股票，希望在下跌 10% 时止损：
- 提醒类型: 百分比变化
- 条件: 下跌（Below）
- 百分比: 10%

### 场景 3: 获利了结提醒
用户希望在股票上涨 20% 时卖出：
- 提醒类型: 百分比变化
- 条件: 上涨（Above）
- 百分比: 20%

## 注意事项

1. **市场时间**: 建议只在市场开盘时间（周一至周五 9:30-16:00 EST）频繁检查
2. **API 限制**: Finnhub 免费版有 API 调用限制，建议检查频率不超过每 5 分钟一次
3. **邮件发送**: 确保 SMTP 配置正确，并测试邮件发送功能
4. **触发后**: 提醒触发后会自动停用，避免重复通知
5. **安全性**: 保护好 `CRON_SECRET`，避免未授权访问检查端点

## 测试提醒功能

1. 创建一个测试提醒（目标价格设为当前价格附近）
2. 运行价格检查：
```bash
curl -X POST http://localhost:3000/api/alerts/check \
  -H "Authorization: Bearer your-secret-key"
```
3. 检查邮箱是否收到通知
4. 在提醒页面验证提醒状态已更新为"已触发"

## 故障排除

### 问题1: 没有收到邮件通知
- 检查 `.env` 中的邮件配置
- 查看服务器日志中的错误信息
- 测试 SMTP 连接是否正常
- 确认 Gmail 应用密码是否正确

### 问题2: 提醒没有触发
- 确认提醒状态为"活跃"
- 检查价格检查 API 是否正常运行
- 查看目标价格是否设置合理
- 验证定时任务是否正确执行

### 问题3: API 调用失败
- 确认 Authorization header 正确
- 检查 `CRON_SECRET` 配置
- 查看网络连接和服务器状态

## 未来改进建议

- [ ] 添加 Web Push 通知
- [ ] 支持短信通知（SMS）
- [ ] 添加提醒历史记录页面
- [ ] 支持批量创建提醒
- [ ] 添加提醒模板功能
- [ ] 支持多条件组合提醒
- [ ] 添加价格预测建议
