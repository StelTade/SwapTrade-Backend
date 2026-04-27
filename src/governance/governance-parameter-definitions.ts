import { BadRequestException } from '@nestjs/common';

type PrimitiveType = 'boolean' | 'integer' | 'number' | 'string';

interface ParameterFieldDefinition {
  type: PrimitiveType;
  min?: number;
  max?: number;
  values?: readonly string[];
}

interface ParameterDefinition {
  defaultValue: Record<string, unknown>;
  fields: Record<string, ParameterFieldDefinition>;
}

export const GOVERNANCE_PARAMETER_DEFINITIONS = {
  'trading.controls': {
    defaultValue: {
      makerFeeBps: 25,
      takerFeeBps: 35,
      minConfirmations: 3,
      withdrawalsEnabled: true,
    },
    fields: {
      makerFeeBps: { type: 'integer', min: 0, max: 500 },
      takerFeeBps: { type: 'integer', min: 0, max: 500 },
      minConfirmations: { type: 'integer', min: 1, max: 64 },
      withdrawalsEnabled: { type: 'boolean' },
    },
  },
  'kyc.policy': {
    defaultValue: {
      required: true,
      reviewSlaHours: 24,
      enhancedDueDiligenceThresholdUsd: 10000,
    },
    fields: {
      required: { type: 'boolean' },
      reviewSlaHours: { type: 'integer', min: 1, max: 720 },
      enhancedDueDiligenceThresholdUsd: { type: 'number', min: 1, max: 10000000 },
    },
  },
} as const satisfies Record<string, ParameterDefinition>;

export type GovernanceParameterKey = keyof typeof GOVERNANCE_PARAMETER_DEFINITIONS;

export function assertKnownParameterKey(key: string): asserts key is GovernanceParameterKey {
  if (!Object.prototype.hasOwnProperty.call(GOVERNANCE_PARAMETER_DEFINITIONS, key)) {
    throw new BadRequestException(`Unsupported governance parameter '${key}'.`);
  }
}

export function getDefaultParameterValue(
  key: GovernanceParameterKey,
): Record<string, unknown> {
  return clonePlainObject(GOVERNANCE_PARAMETER_DEFINITIONS[key].defaultValue);
}

export function validateParameterPatch(
  key: GovernanceParameterKey,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!isPlainObject(patch)) {
    throw new BadRequestException('Parameter patch must be a plain object.');
  }

  const fields = GOVERNANCE_PARAMETER_DEFINITIONS[key].fields;
  const patchKeys = Object.keys(patch);

  if (patchKeys.length === 0) {
    throw new BadRequestException('Parameter patch must include at least one field.');
  }

  const sanitizedPatch: Record<string, unknown> = {};

  for (const fieldName of patchKeys) {
    const field = fields[fieldName];

    if (!field) {
      throw new BadRequestException(
        `Field '${fieldName}' is not configurable for parameter '${key}'.`,
      );
    }

    const value = patch[fieldName];
    sanitizedPatch[fieldName] = validateFieldValue(fieldName, value, field);
  }

  return sanitizedPatch;
}

export function applyParameterPatch(
  currentValue: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...clonePlainObject(currentValue),
    ...clonePlainObject(patch),
  };
}

export function assertOnlyPatchedFieldsChanged(
  beforeValue: Record<string, unknown>,
  afterValue: Record<string, unknown>,
  patch: Record<string, unknown>,
): string[] {
  const allowedFields = new Set(Object.keys(patch));
  const allFields = new Set([
    ...Object.keys(beforeValue),
    ...Object.keys(afterValue),
  ]);
  const changedFields: string[] = [];

  for (const fieldName of allFields) {
    const before = beforeValue[fieldName];
    const after = afterValue[fieldName];

    if (!valuesEqual(before, after)) {
      changedFields.push(fieldName);
      if (!allowedFields.has(fieldName)) {
        throw new BadRequestException(
          `Unexpected parameter mutation detected for field '${fieldName}'.`,
        );
      }
    }
  }

  return changedFields;
}

export function clonePlainObject<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateFieldValue(
  fieldName: string,
  value: unknown,
  definition: ParameterFieldDefinition,
): unknown {
  if (value === undefined) {
    throw new BadRequestException(`Field '${fieldName}' cannot be undefined.`);
  }

  if (definition.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`Field '${fieldName}' must be a boolean.`);
    }
    return value;
  }

  if (definition.type === 'string') {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new BadRequestException(`Field '${fieldName}' must be a non-empty string.`);
    }
    if (definition.values && !definition.values.includes(value)) {
      throw new BadRequestException(
        `Field '${fieldName}' must be one of: ${definition.values.join(', ')}.`,
      );
    }
    return value;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`Field '${fieldName}' must be a finite number.`);
  }

  if (definition.type === 'integer' && !Number.isInteger(value)) {
    throw new BadRequestException(`Field '${fieldName}' must be an integer.`);
  }

  if (definition.min !== undefined && value < definition.min) {
    throw new BadRequestException(
      `Field '${fieldName}' must be greater than or equal to ${definition.min}.`,
    );
  }

  if (definition.max !== undefined && value > definition.max) {
    throw new BadRequestException(
      `Field '${fieldName}' must be less than or equal to ${definition.max}.`,
    );
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
