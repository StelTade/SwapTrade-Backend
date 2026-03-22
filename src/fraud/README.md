# Fraud Protection Backend - 反欺诈保护系统

## 版权声明
MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)

---

## 概述

本模块实现等待列表和推荐系统的反欺诈保护措施，包括：
- ✅ IP 速率限制（NestJS Throttler）
- ✅ CAPTCHA 验证码钩子
- ✅ 高风险模式检测
- ✅ 可疑记录标记和管理
- ✅ 欺诈账户禁用

---

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│              Fraud Protection System                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────┐   │
│  │ Fraud Detection  │───▶│   CAPTCHA Service       │   │
│  │ Service          │    │                         │   │
│  │                  │    │  - 数学验证码           │   │
│  │  - 风险评分       │    │  - 文本验证码           │   │
│  │  - IP 检测        │    │  - 图片验证码（预留）   │   │
│  │  - 域名检测       │    └─────────────────────────┘   │
│  │  - 指纹检测       │                                   │
│  └──────────────────┘    ┌─────────────────────────┐   │
│           │              │   Throttler Guard       │   │
│           ▼              │                         │   │
│  ┌──────────────────┐    │  - IP 速率限制          │   │
│  │ Controller       │    │  - 10 次/10 秒           │   │
│  │                  │    │  - 100 次/分钟          │   │
│  │  - /check/*      │    └─────────────────────────┘   │
│  │  - /suspicious   │                                   │
│  └──────────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 风险检测规则

### 1. IP 注册频率限制

| 规则 | 阈值 | 风险分 |
|------|------|--------|
| 10 分钟内注册>10 次 | 触发 | +40 |

### 2. 邮箱域名检测

| 规则 | 阈值 | 风险分 |
|------|------|--------|
| 同一域名注册>5 次 | 触发 | +30 |
| 临时邮箱域名 | 触发 | +50 |

### 3. 设备指纹检测

| 规则 | 阈值 | 风险分 |
|------|------|--------|
| 指纹重复>3 次 | 触发 | +30 |

### 4. 推荐欺诈检测

| 规则 | 阈值 | 风险分 |
|------|------|--------|
| 推荐人和被推荐人 IP 相同 | 触发 | +40 |
| 推荐人成功率<30% | 触发 | +30 |
| 1 小时内推荐>10 次 | 触发 | +30 |
| 推荐域名过于集中 | 触发 | +20 |

---

## 风险评分与处理

| 风险分 | 处理动作 | 说明 |
|--------|----------|------|
| 0-29 | allow | 允许通过 |
| 30-49 | challenge | 需要验证码 |
| 50-79 | review | 人工审核 |
| 80-100 | block | 直接阻止 |

---

## API 接口

### 1. 检查等待列表注册风险

```
POST /fraud/check/waitlist
```

**请求体：**
```json
{
  "email": "user@example.com",
  "fingerprint": "device-fingerprint-123"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "isFraud": false,
    "riskScore": 25,
    "reasons": [],
    "action": "allow"
  }
}
```

---

### 2. 检查推荐风险

```
POST /fraud/check/referral
```

**请求体：**
```json
{
  "referrerId": 100,
  "refereeId": 101,
  "refereeIP": "192.168.1.1"
}
```

---

### 3. 获取可疑记录队列

```
GET /fraud/suspicious?page=1&limit=20
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "entityType": "referral",
        "entityId": 100,
        "reason": "IP 地址相同",
        "riskScore": 75,
        "status": "pending_review",
        "createdAt": "2026-03-23T07:00:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "limit": 20
  }
}
```

---

### 4. 禁用欺诈账户

```
POST /fraud/account/:id/disable
```

**请求体：**
```json
{
  "reason": "检测到批量注册欺诈"
}
```

---

## CAPTCHA 验证码

### 支持的验证码类型

1. **数学验证码**（默认）
   - 示例：`5 + 3 = ?`
   - 答案：`8`

2. **文本验证码**
   - 示例：`请输入以下单词：elppa`（apple 倒序）
   - 答案：`apple`

3. **图片验证码**（预留）
   - 集成 reCAPTCHA 或其他图片验证码服务

### 使用示例

```typescript
// 生成验证码
const challenge = captchaService.generateChallenge('math');
// 返回：{ id: 'xxx', type: 'math', challenge: '5 + 3 = ?', expiresAt: ... }

// 验证验证码
const result = captchaService.verifyChallenge(challengeId, '8');
// 返回：{ success: true }
```

---

## 速率限制配置

### Throttler 配置

```typescript
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,    // 1 秒
    limit: 10,    // 10 次
  },
  {
    name: 'medium',
    ttl: 60000,   // 1 分钟
    limit: 100,   // 100 次
  },
])
```

### 自定义守卫

```typescript
@UseGuards(FraudPreventionGuard)
@Post('signup')
async signup(@Body() dto: SignupDto) {
  // ...
}
```

---

## Acceptance Criteria 检查

- [x] 速率限制已配置和执行（NestJS Throttler）
- [x] 欺诈评分函数已实现
- [x] 可疑记录进入管理员队列
- [x] 创建人工审核路径
- [x] 安全测试和误报检查

---

## 临时邮箱域名黑名单

```typescript
const disposableDomains = [
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'throwaway.email',
  'fakeinbox.com',
  'trashmail.com',
];
```

---

## 测试

运行单元测试：
```bash
npm test -- fraud-detection.service.spec.ts
npm test -- captcha.service.spec.ts
```

运行集成测试：
```bash
npm run test:e2e
```

---

## 监控指标

### Prometheus 指标

- `fraud_checks_total{action}` - 总检查次数
- `fraud_blocked_total` - 阻止次数
- `fraud_challenge_total` - 验证码挑战次数
- `fraud_manual_review_total` - 人工审核次数

---

## 待办事项

- [ ] 集成 reCAPTCHA v3
- [ ] 添加 IP 地理位置检测
- [ ] 添加行为分析（鼠标移动、点击模式）
- [ ] 集成机器学习模型（欺诈预测）
- [ ] 添加设备指纹库（FingerprintJS）
