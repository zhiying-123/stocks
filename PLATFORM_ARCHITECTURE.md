# 交易平台 - 系统架构文档

## 🎯 平台概述

这是一个统一的交易平台，支持**股票交易**和**预测市场（Polymarket）**两个模块，共享同一个钱包系统。

### 核心特点

- 🐱 **猫猫 Logo** - 可爱且易于识别的品牌标识
- 🎨 **黑白灰高级设计** - 现代简约，专业高级
- 💰 **统一钱包** - 两个模块共享同一个余额
- 👤 **个人资料管理** - 完整的用户管理功能
- 🔔 **实时通知** - 价格提醒和交易通知

---

## 📁 新系统结构

### 模块划分

```
app/
├── config/
│   └── routes.ts              # 路由配置（股票、Polymarket、共享路由）
├── components/
│   └── MainNav.tsx            # 主导航组件（带下拉菜单）
├── h_stocks/                  # 📈 股票模块
│   ├── page.tsx               # 股票概览
│   ├── stocks/                # 股票市场
│   ├── my-stocks/             # 我的股票
│   └── portfolio/             # 投资组合分析
├── polymarket/                # 🎲 预测市场模块
│   ├── page.tsx               # 市场概览
│   ├── my-positions/          # 我的仓位
│   └── analytics/             # 市场分析
├── wallet/                    # 💳 共享钱包
│   └── page.tsx               # 钱包管理
├── profile/                   # 👤 个人资料
│   └── page.tsx               # 用户资料和设置
├── login/                     # 登录
├── logout/                    # 登出
└── page.tsx                   # 首页（Landing Page）
```

---

## 🎨 设计系统

### 颜色方案
- **主色调**: 黑色 (#000000), 深灰 (#1F2937), 白色 (#FFFFFF)
- **强调色**: 灰色 (#6B7280)
- **成功色**: 绿色（涨）
- **警告色**: 红色（跌）

### 设计原则
1. **简约现代** - 去除多余装饰，专注内容
2. **高对比度** - 黑白分明，易于阅读
3. **圆角设计** - 柔和边角，不死板
4. **留白充足** - 空间感强，不拥挤
5. **响应式** - 适配各种屏幕尺寸

---

## 🚀 功能模块

### 1. 股票交易模块 📈

**路径**: `/h_stocks`

**功能**:
- 实时股票行情
- 买卖交易
- 投资组合追踪
- 观察列表

**页面**:
- `/h_stocks` - 股票概览
- `/h_stocks/stocks` - 股票市场（浏览和搜索）
- `/h_stocks/stocks/[symbol]` - 股票详情
- `/h_stocks/my-stocks` - 我的持仓
- `/h_stocks/portfolio` - 投资组合分析

### 2. 预测市场模块 🎲

**路径**: `/polymarket`

**功能**:
- 浏览预测市场
- 买卖预测仓位
- 市场分析
- 仓位管理

**页面**:
- `/polymarket` - 市场概览
- `/polymarket/my-positions` - 我的仓位
- `/polymarket/analytics` - 市场分析

### 3. 共享钱包 💳

**路径**: `/wallet`

**功能**:
- 统一余额管理
- 充值提现
- 交易历史
- 跨模块使用

### 4. 个人资料 👤

**路径**: `/profile`

**功能**:
- 账户信息管理
- 交易统计
- 偏好设置
- 通知设置

---

## 🔧 导航系统

### 主导航栏

导航栏位于页面顶部，包含：

1. **Logo** (🐱) + 平台名称
2. **股票** 下拉菜单
   - Stock Market
   - My Stocks
   - Portfolio
3. **Polymarket** 下拉菜单
   - Markets
   - My Positions
   - Analytics
4. **Wallet** (共享)
5. **Profile**
6. **用户信息**

### 导航特点
- 下拉菜单设计
- 活跃状态高亮（黑色背景）
- 悬停效果
- 响应式设计

---

## 🔐 用户认证

### Cookie 系统
- `auth` - 登录状态（true/false）
- `user` - 用户信息（JSON）

### 保护路由
所有交易相关页面需要登录：
- `/h_stocks/*`
- `/polymarket/*`
- `/wallet`
- `/profile`

### 用户信息获取
```typescript
const cookieStore = await cookies();
const userCookie = cookieStore.get("user")?.value;
const user = userCookie ? JSON.parse(userCookie) : null;
```

---

## 💾 数据库模型

### 主要模型（Prisma）

```prisma
User          # 用户账户
UserWallet    # 用户钱包（共享）
StockHolding  # 股票持仓
StockTransaction  # 股票交易记录
StockWatchlist    # 股票观察列表
```

---

## 🎯 下一步计划

### 待完成功能
- [ ] Polymarket 真实 API 集成
- [ ] 更多支付方式
- [ ] 高级图表分析
- [ ] 社交分享功能
- [ ] 移动应用

### 优化项
- [ ] 性能优化
- [ ] 更多动画效果
- [ ] 深色模式
- [ ] 多语言支持

---

## 📱 响应式设计

### 断点
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### 适配策略
- Grid 布局自动调整列数
- 导航栏在移动端收起
- 卡片在小屏幕堆叠

---

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **UI**: Tailwind CSS
- **数据库**: PostgreSQL + Prisma
- **API**: Finnhub (股票数据)
- **部署**: Vercel

---

## 📝 代码规范

### 组件命名
- 页面组件: `XxxPage`
- UI 组件: `XxxComponent`
- 布局组件: `XxxLayout`

### 文件组织
- Server Components (异步获取数据)
- Client Components (交互功能，标记 "use client")
- 共享配置在 `config/` 目录

---

## 🎉 使用指南

1. **首页** - 未登录用户看到 Landing Page
2. **登录** - 登录后自动跳转到股票概览
3. **导航** - 使用顶部导航栏切换模块
4. **钱包** - 所有模块共享同一个钱包余额
5. **个人资料** - 管理账户和偏好设置

---

## 💡 设计亮点

1. **统一体验** - 两个模块风格统一，操作一致
2. **清晰层级** - 信息层次分明，易于理解
3. **快速访问** - 下拉菜单快速切换功能
4. **视觉舒适** - 黑白灰搭配，不刺眼
5. **专业感** - 简约设计传递专业可靠形象

---

## 📞 联系方式

如有问题或建议，欢迎提出！

---

*最后更新: 2026-03-03*
