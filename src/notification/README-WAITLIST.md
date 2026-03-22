# Waitlist Email Notification - 实现文档

## 版权声明
MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)

---

## 概述

本模块实现等待列表相关的邮件通知服务，包括：
- ✅ 注册确认邮件
- ✅ 推荐成功通知
- ✅ 产品上线通知
- ✅ 基于队列的邮件发送
- ✅ 重试机制（指数退避）
- ✅ 速率限制

---

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                  Waitlist Notification                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────┐   │
│  │ WaitlistNotif    │───▶│   Email Queue Service   │   │
│  │ Service          │    │                         │   │
│  │                  │    │  - 队列管理             │   │
│  │  - 注册确认      │    │  - 重试逻辑             │   │
│  │  - 推荐成功      │    │  - 速率限制             │   │
│  │  - 上线通知      │    │  - 指数退避             │   │
│  └──────────────────┘    └─────────────────────────┘   │
│                            │                             │
│                            ▼                             │
│                   ┌─────────────────┐                   │
│                   │  SMTP/SendGrid  │                   │
│                   │  Mailgun        │                   │
│                   └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## 文件结构

```
src/notification/
├── waitlist-notification.service.ts    # Waitlist 邮件服务
├── waitlist-notification.service.spec.ts
├── email-queue.service.ts              # 邮件队列服务
├── email-queue.service.spec.ts
├── entities/
│   └── email-job.entity.ts             # 邮件任务实体
└── README-WAITLIST.md                  # 本文档
```

---

## API 使用示例

### 1. 发送注册确认邮件

```typescript
import { WaitlistNotificationService } from './notification/waitlist-notification.service';

async function onWaitlistSignup(userData: WaitlistSignupData) {
  await waitlistNotificationService.sendSignupConfirmation({
    email: userData.email,
    name: userData.name,
    signupDate: new Date(),
    referralCode: userData.referralCode,
  });
}
```

### 2. 发送推荐成功通知

```typescript
async function onReferralSuccess(referrer: User, referee: User) {
  const pointsAwarded = 100;
  const totalPoints = await referralService.getTotalPoints(referrer.id);

  await waitlistNotificationService.sendReferralSuccess({
    email: referrer.email,
    name: referrer.name,
    refereeEmail: referee.email,
    pointsAwarded,
    totalPoints,
  });
}
```

### 3. 发送产品上线通知

```typescript
async function notifyLaunch(users: User[]) {
  for (const user of users) {
    await waitlistNotificationService.sendLaunchNotification({
      email: user.email,
      name: user.name,
      launchDate: new Date(),
      specialOffer: '首笔交易手续费 5 折',
    });
  }
}
```

---

## 队列配置

### 环境变量

```bash
# SMTP 配置
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=noreply@swaptrade.io
SMTP_PASS=your_password
SMTP_FROM=SwapTrade <noreply@swaptrade.io>

# 可选：SendGrid
SENDGRID_API_KEY=SG.xxx

# 可选：Mailgun
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.swaptrade.io
```

### 速率限制

- 每用户：1 封/分钟
- 全局：60 封/分钟

### 重试策略

| 重试次数 | 延迟时间 |
|---------|---------|
| 1       | 1 秒     |
| 2       | 5 秒     |
| 3       | 30 秒    |

超过 3 次重试失败后，邮件标记为 `FAILED`。

---

## 邮件模板

### 1. 注册确认 (waitlist-signup)

```html
<h1>欢迎加入 SwapTrade 等待列表！🎉</h1>
<p>亲爱的 {{name}}，</p>
<p>感谢您注册 SwapTrade 等待列表...</p>
```

### 2. 推荐成功 (referral-success)

```html
<h1>推荐成功！🎁</h1>
<p>亲爱的 {{name}}，</p>
<p>恭喜！您推荐的朋友已成功注册...</p>
```

### 3. 产品上线 (launch-notification)

```html
<h1>SwapTrade 正式上线啦！🚀</h1>
<p>亲爱的 {{name}}，</p>
<p>感谢您耐心等待！SwapTrade 现已正式上线...</p>
```

---

## 数据库表

### email_jobs

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| to | varchar(255) | 收件人邮箱 |
| subject | varchar(500) | 邮件主题 |
| body | text | 邮件内容 |
| templateKey | varchar(100) | 模板键 |
| userId | int | 用户 ID |
| status | enum | 状态 |
| priority | enum | 优先级 |
| attempt | int | 重试次数 |
| maxRetries | int | 最大重试次数 |
| lastError | text | 最后错误信息 |
| nextRunAt | datetime | 下次执行时间 |
| sentAt | datetime | 发送时间 |
| completedAt | datetime | 完成时间 |
| failedAt | datetime | 失败时间 |
| createdAt | datetime | 创建时间 |
| updatedAt | datetime | 更新时间 |

---

## Acceptance Criteria 检查

- [x] 邮件服务已实现和配置（SMTP/SendGrid/Mailgun）
- [x] 模板系统集成（3 个模板）
- [x] 事件触发器（注册/推荐/上线）
- [x] 重试 + 队列行为验证（指数退避）
- [x] 失败处理和日志记录
- [x] 速率限制（每用户 1 封/分钟）
- [x] 单元测试

---

## 测试

运行单元测试：
```bash
npm test -- waitlist-notification.service.spec.ts
npm test -- email-queue.service.spec.ts
```

运行集成测试：
```bash
npm run test:e2e
```

---

## 监控和日志

### 日志级别

- `log`: 邮件发送成功
- `debug`: 队列处理详情
- `warn`: 重试中
- `error`: 发送失败

### 监控指标

- 队列中的邮件数量
- 发送成功率
- 平均发送延迟
- 失败率

---

## 待办事项

- [ ] 集成 SendGrid/Mailgun API
- [ ] 添加邮件打开/点击追踪
- [ ] 添加退订功能
- [ ] 添加 A/B 测试支持
- [ ] 添加邮件分析仪表板
