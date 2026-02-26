import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsAssetSymbol(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAssetSymbol',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return typeof value === 'string' && /^[A-Z0-9]{2,10}$/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
            return `${args.property} must be a valid asset symbol (uppercase alphanumeric, 2-10 chars)`;
        }
      },
    });
  };
}

export function IsSafeText(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSafeText',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') return true; // Allow non-strings, handled by other validators
          // Check for common injection patterns
          const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /onload=/i,
            /onerror=/i,
            /onclick=/i,
          ];
          return !dangerousPatterns.some(pattern => pattern.test(value));
        },
        defaultMessage(args: ValidationArguments) {
            return `${args.property} contains potentially unsafe characters or patterns`;
        }
      },
    });
  };
}