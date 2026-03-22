# Admin API 文档

管理员接口 - Waitlist 和 Referral 管理

## 版权声明
MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)

---

## 概述

本模块提供管理员专用的 API 接口，用于管理等待列表（Waitlist）和推荐系统（Referral）。

### 安全要求
- 所有接口都需要 Bearer Token 认证
- 只有 `admin` 或 `super-admin` 角色的用户可以访问
- 所有状态变更操作都会记录审计日志

---

## API 端点

### Waitlist 管理

#### 1. 获取等待列表
```
GET /admin/waitlist
```

**查询参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 |
| status | string | - | 状态过滤（pending/invited/active/blacklisted） |
| email | string | - | 邮箱模糊搜索 |
| sortBy | string | createdAt | 排序字段 |
| order | string | desc | 排序方向（asc/desc） |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "status": "pending",
      "createdAt": "2026-03-23T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

#### 2. 更新等待列表状态
```
PATCH /admin/waitlist/:id/status
```

**请求体：**
```json
{
  "status": "invited",
  "reason": "手动审核通过"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "invited",
    "updatedAt": "2026-03-23T00:00:00Z"
  },
  "message": "状态更新成功"
}
```

---

#### 3. 手动发送邀请
```
POST /admin/waitlist/:id/invite
```

**请求体：**
```json
{
  "message": "欢迎加入 SwapTrade！"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "invited",
    "invitedAt": "2026-03-23T00:00:00Z"
  },
  "message": "邀请已发送"
}
```

---

### Referral 管理

#### 4. 获取推荐列表
```
GET /admin/referrals
```

**查询参数：**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | 1 | 页码 |
| limit | number | 20 | 每页数量 |
| status | string | - | 状态过滤 |
| suspect | boolean | - | 是否可疑 |
| sortBy | string | points | 排序字段 |
| order | string | desc | 排序方向 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "referrerId": 100,
      "refereeId": 101,
      "points": 500,
      "status": "active",
      "suspect": false
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### 5. 调整推荐积分
```
POST /admin/referrals/:id/adjust
```

**请求体：**
```json
{
  "pointsAdjustment": 100,
  "reason": "额外奖励"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "points": 600
  },
  "message": "积分调整成功"
}
```

---

## 错误响应

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "缺少认证令牌"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "需要管理员权限"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Waitlist #123 不存在"
}
```

---

## 审计日志

所有状态变更和积分调整操作都会记录到 `audit_log` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 日志 ID |
| action | string | 操作类型 |
| entity | string | 实体类型 |
| entityId | number | 实体 ID |
| adminId | number | 管理员 ID |
| changes | object | 变更内容 |
| reason | string | 操作原因 |
| createdAt | Date | 创建时间 |

---

## 测试

运行单元测试：
```bash
npm test -- admin.controller.spec.ts
```

运行集成测试：
```bash
npm run test:e2e -- admin.integration.spec.ts
```

---

## 待办事项

- [ ] 实现完整的 Token 验证（从 auth service 获取用户信息）
- [ ] 添加邮件通知功能（手动邀请时）
- [ ] 添加速率限制（防止 API 滥用）
- [ ] 添加更多过滤选项（日期范围、用户 ID 等）
- [ ] 添加批量操作接口
