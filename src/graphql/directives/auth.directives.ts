import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

export const AUTH_DIRECTIVE_KEY = 'graphql_auth';
export const AUTH_ROLE_KEY = 'graphql_auth_role';

export function AuthDirective() {
  return applyDecorators(SetMetadata(AUTH_DIRECTIVE_KEY, true));
}

export function HasRoleDirective(role: string) {
  return applyDecorators(SetMetadata(AUTH_DIRECTIVE_KEY, true), SetMetadata(AUTH_ROLE_KEY, role));
}

