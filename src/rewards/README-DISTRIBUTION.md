# Reward Distribution System - 奖励自动分配系统

## 版权声明
MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)

---

## 概述

本模块实现推荐完成后的自动奖励分配功能，包括：
- ✅ 自动发放奖励给推荐人和被推荐人
- ✅ 集成现有 Balance 模块
- ✅ 事务处理和审计日志
- ✅ 可配置的奖励金额
- ✅ 错误处理和重试机制

---

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│              Reward Distribution System                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐    ┌─────────────────────────┐   │
│  │ Reward           │───▶│   Balance Service       │   │
│  │ Distribution     │    │                         │   │
│  │ Service          │    │  - creditBalance()      │   │
│  │                  │    │  - UserBalance 实体     │   │
│  │  - 自动分配       │    └─────────────────────────┘   │
│  │  - 手动触发       │                                   │
│  │  - 重试机制       │    ┌─────────────────────────┐   │
│  └──────────────────┘    │   BalanceAudit          │   │
│           │              │                         │   │
│           ▼              │  - 交易记录             │   │
│  ┌──────────────────┐    │  - 审计追踪             │   │
│  │ Controller       │    └─────────────────────────┘   │
│  │                  │                                   │
│  │  - GET /config   │                                   │
│  │  - POST /manual  │                                   │
│  │  - POST /retry   │                                   │
│  └──────────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 奖励配置

### 默认配置

| 类型 | 金额 | 说明 |
|------|------|------|
| 推荐人奖励 | $10.00 | 成功推荐新用户 |
| 被推荐人奖励 | $5.00 | 完成 KYC 验证 |
| XP 奖励 | 100 XP | 额外经验值 |
| 徽章 | ID=1 | "推荐达人"徽章 |

### 更新配置

```bash
POST /rewards/distribution/config
Authorization: Bearer <admin-token>

{
  "referrerReward": 15.00,
  "refereeReward": 7.50,
  "xpBonus": 150
}
```

---

## API 接口

### 1. 获取奖励配置

```
GET /rewards/distribution/config
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "referrerReward": 10.00,
    "refereeReward": 5.00,
    "xpBonus": 100,
    "badgeId": 1
  }
}
```

---

### 2. 更新奖励配置

```
POST /rewards/distribution/config
```

**请求体：**
```json
{
  "referrerReward": 15.00,
  "refereeReward": 7.50,
  "xpBonus": 150
}
```

---

### 3. 手动触发奖励分配

```
POST /rewards/distribution/manual
```

**请求体：**
```json
{
  "referrerId": 100,
  "refereeId": 101,
  "referrerReward": 10.00,
  "refereeReward": 5.00,
  "reason": "补发奖励"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "referrerTxId": 1001,
    "refereeTxId": 1002
  },
  "message": "奖励分配成功"
}
```

---

### 4. 重试失败的分配

```
POST /rewards/distribution/retry
```

**请求体：**
```json
{
  "limit": 10
}
```

---

## 自动触发流程

### 场景：被推荐人完成 KYC 验证

```typescript
// 在 KYC 服务中调用
async completeKYC(userId: number) {
  // ... KYC 验证逻辑
  
  // 查找推荐关系
  const referral = await this.referralService.findByRefereeId(userId);
  if (referral) {
    // 自动触发奖励分配
    await this.rewardDistributionService.distributeRewards(
      referral.referrerId,
      userId,
    );
  }
}
```

---

## 事务处理

### 使用事务确保数据一致性

```typescript
const queryRunner = this.dataSource.createQueryRunner();
try {
  await queryRunner.connect();
  await queryRunner.startTransaction();

  // 1. 给推荐人发放奖励
  await this.balanceService.creditBalance(..., queryRunner);

  // 2. 给被推荐人发放奖励
  await this.balanceService.creditBalance(..., queryRunner);

  // 3. 记录审计日志
  await this.logDistribution(..., queryRunner);

  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  throw error;
} finally {
  await queryRunner.release();
}
```

---

## 审计日志

### BalanceAudit 记录

| 字段 | 类型 | 说明 |
|------|------|------|
| userId | number | 用户 ID |
| action | enum | REFERRAL_REWARD |
| amount | decimal | 奖励金额 |
| referenceId | number | 关联用户 ID |
| referenceType | string | 'referral' |
| description | string | 描述 |
| metadata | object | 详细元数据 |

---

## Acceptance Criteria 检查

- [x] 被推荐人验证后自动发放奖励
- [x] 正确金额发放到用户余额（使用 UserBalance 实体）
- [x] 创建交易记录（遵循 BalanceAudit 模式）
- [x] 可配置的奖励设置
- [x] 错误处理（失败分配）
- [x] 集成现有 Rewards 模块（XP/徽章预留接口）

---

## 错误处理

### 可能出现的错误

1. **余额不足** - 系统账户余额不足时回滚
2. **无效推荐关系** - 验证推荐关系是否存在
3. **重复发放** - 检查是否已发放过奖励
4. **数据库错误** - 事务回滚

### 重试机制

```typescript
// 批量重试失败的分配
async retryFailedDistributions(limit: number = 10): Promise<number> {
  const failed = await this.getFailedDistributions(limit);
  let successCount = 0;
  
  for (const item of failed) {
    const result = await this.distributeRewards(
      item.referrerId,
      item.refereeId,
    );
    if (result.success) {
      successCount++;
    }
  }
  
  return successCount;
}
```

---

## 测试

运行单元测试：
```bash
npm test -- reward-distribution.service.spec.ts
```

运行集成测试：
```bash
npm run test:e2e
```

---

## 监控指标

### Prometheus 指标

- `rewards_distributed_total` - 总发放次数
- `rewards_amount_total` - 总发放金额
- `rewards_failed_total` - 失败次数
- `rewards_retry_total` - 重试次数

---

## 待办事项

- [ ] 集成 XP 系统（实际发放经验值）
- [ ] 集成徽章系统（发放"推荐达人"徽章）
- [ ] 添加邮件通知（奖励到账通知）
- [ ] 添加奖励上限（防止滥用）
- [ ] 添加反欺诈检查（检测虚假推荐）
