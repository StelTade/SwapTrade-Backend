import { SetMetadata } from '@nestjs/common';
import { RequiredPermission } from '../types';

export const PERMISSIONS_KEY = 'permissions';
export const CheckPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);