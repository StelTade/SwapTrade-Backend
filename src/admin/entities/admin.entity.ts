/**
 * Admin Entity - 管理员实体
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
export interface AdminUser {
  id: number;
  email: string;
  role: 'admin' | 'super-admin';
  createdAt: Date;
  updatedAt: Date;
}
