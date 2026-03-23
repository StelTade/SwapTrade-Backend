# Referral Tracking Backend - 推荐追踪系统

## 版权声明
MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)

---

## 概述

本模块实现等待列表推荐追踪和积分发放功能，包括：
- ✅ 推荐关系创建和验证
- ✅ 积分自动发放
- ✅ 防止自我推荐和重复推荐
- ✅ 审计日志记录
- ✅ API 接口

---

## 数据库设计

### waitlist_referrals 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| referrer_id | int | 推荐人 ID |
| referee_id | int | 被推荐人 ID |
| status | enum | pending/verified/rewarded/invalid |
| referral_code | varchar | 推荐码 |
| referee_ip | varchar | 被推荐人 IP |
| notes | text | 备注 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |
| verified_at | datetime | 验证时间 |
| rewarded_at | datetime | 奖励时间 |

**唯一约束：** (referrer_id, referee_id)

---

### waitlist_referral_points 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| user_id | int | 用户 ID |
| points | decimal(10,2) | 积分 |
| reason | enum | 积分原因 |
| referral_id | int | 关联推荐 ID |
| description | text | 描述 |
| created_by | int | 创建者（管理员） |
| created_at | datetime | 创建时间 |
| transaction_ref | varchar | 交易参考号 |

---

## 推荐状态流转

```
PENDING → VERIFIED → REWARDED
    ↓
 INVALID
```

- **PENDING**: 刚创建，等待被推荐人验证
- **VERIFIED**: 被推荐人已验证邮箱
- **REWARDED**: 积分已发放
- **INVALID**: 无效推荐（欺诈等）

---

## API 接口

### 1. 创建推荐关系

```
POST /api/waitlist/referral
```

**请求体：**
```json
{
  "referrerId": 100,
  "refereeId": 101,
  "referralCode": "INVITE123",
  "refereeIP": "192.168.1.1"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "referrerId": 100,
    "refereeId": 101,
    "status": "pending",
    "createdAt": "2026-03-23T08:00:00Z"
  },
  "message": "推荐关系创建成功"
}
```

---

### 2. 推荐回调（验证邮箱）

```
POST /api/waitlist/referral/callback
```

**请求体：**
```json
{
  "refereeId": 101,
  "verifiedEmail": "user@example.com"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "rewarded",
    "verifiedAt": "2026-03-23T08:10:00Z",
    "rewardedAt": "2026-03-23T08:10:00Z"
  },
  "message": "推荐验证成功，积分已发放"
}
```

---

### 3. 获取用户推荐统计

```
GET /api/waitlist/referral/user/:id
```

**响应：**
```json
{
  "success": true,
  "data": {
    "totalReferrals": 10,
    "verifiedReferrals": 8,
    "rewardedReferrals": 8,
    "totalPoints": 8
  }
}
```

---

### 4. 获取用户推荐列表

```
GET /api/waitlist/referral/user/:id/list?page=1&limit=20
```

---

### 5. 验证推荐码

```
GET /api/waitlist/referral/code/:code
```

**响应：**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "INVITE123"
  }
}
```

---

## 业务规则

### 1. 防止自我推荐
```typescript
if (referrerId === refereeId) {
  throw new BadRequestException('禁止自我推荐');
}
```

### 2. 防止重复推荐
```typescript
const existing = await this.referralRepo.findOne({ where: { refereeId } });
if (existing) {
  throw new ConflictException('该用户已被其他用户推荐');
}
```

### 3. 积分发放规则
- 每个有效推荐：1 积分
- 仅当被推荐人验证邮箱后发放
- 事务保证数据一致性

---

## 积分原因枚举

```typescript
enum PointsReason {
  REFERRAL_SIGNUP = 'referral_signup',     // 注册奖励
  REFERRAL_VERIFIED = 'referral_verified', // 验证奖励
  REFERRAL_ACTIVE = 'referral_active',     // 活跃奖励
  MANUAL_ADJUSTMENT = 'manual_adjustment', // 手动调整
  BONUS = 'bonus',                         // 额外奖励
}
```

---

## Acceptance Criteria 检查

- [x] 创建数据表和关系
- [x] 推荐回调和处理流程实现
- [x] 积分准确递增
- [x] 防止重复推荐和自我推荐的保护措施
- [x] 推荐逻辑单元测试

---

## 使用示例

### 在注册流程中集成

```typescript
// 用户注册时
async register(dto: RegisterDto, referralCode?: string) {
  // 1. 创建用户
  const user = await this.createUser(dto);

  // 2. 如果有推荐码，创建推荐关系
  if (referralCode) {
    const referrerId = await this.referralService.getReferrerByCode(referralCode);
    if (referrerId) {
      await this.referralService.createReferral({
        referrerId,
        refereeId: user.id,
        referralCode,
      });
    }
  }

  return user;
}

// 用户验证邮箱时
async verifyEmail(userId: number, email: string) {
  // 1. 验证邮箱
  await this.updateUserStatus(userId, 'verified');

  // 2. 触发推荐验证
  await this.referralService.verifyReferral({
    refereeId: userId,
    verifiedEmail: email,
  });
}
```

---

## 测试

运行单元测试：
```bash
npm test -- referral-tracking.service.spec.ts
```

---

## 待办事项

- [ ] 添加批量导入推荐关系功能
- [ ] 集成邮件通知（推荐成功通知）
- [ ] 添加推荐排行榜 API
- [ ] 支持多级推荐（二级、三级奖励）
- [ ] 添加反欺诈检测
