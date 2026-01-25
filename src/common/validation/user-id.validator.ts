import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isUserId', async: false })
export class IsUserIdConstraint implements ValidatorConstraintInterface {
  validate(userId: any, args: ValidationArguments) {
    // User ID should be a positive integer or a valid string ID
    if (typeof userId === 'number') {
      return Number.isInteger(userId) && userId > 0;
    }
    if (typeof userId === 'string') {
      // If it's a string, it should be numeric and positive
      const numValue = parseInt(userId, 10);
      return !isNaN(numValue) && Number.isInteger(numValue) && numValue > 0;
    }
    return false;
  }

  defaultMessage(args: ValidationArguments) {
    return 'User ID must be a positive integer or a valid string representation of a positive integer';
  }
}

export function IsUserId(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    const { registerDecorator } = require('class-validator');
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUserIdConstraint,
    });
  };
}