import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isPositiveAmount', async: false })
export class IsPositiveAmountConstraint implements ValidatorConstraintInterface {
  validate(amount: any, args: ValidationArguments) {
    // Amount should be a positive number with up to 8 decimal places
    if (typeof amount === 'number') {
      return amount >= 0 && /^\d+(\.\d{1,8})?$/.test(amount.toString());
    }
    if (typeof amount === 'string') {
      const numValue = parseFloat(amount);
      return !isNaN(numValue) && numValue >= 0 && /^\d+(\.\d{1,8})?$/.test(amount);
    }
    return false;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Amount must be a positive number with up to 8 decimal places';
  }
}

export function IsPositiveAmount(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    const { registerDecorator } = require('class-validator');
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveAmountConstraint,
    });
  };
}