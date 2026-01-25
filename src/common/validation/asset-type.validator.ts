import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isAssetType', async: false })
export class IsAssetTypeConstraint implements ValidatorConstraintInterface {
  validate(assetType: string, args: ValidationArguments) {
    // Asset type should be alphanumeric with optional hyphens or underscores, 2-10 characters
    const assetTypeRegex = /^[A-Za-z0-9_-]{2,10}$/;
    return typeof assetType === 'string' && assetTypeRegex.test(assetType);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Asset type must be alphanumeric with optional hyphens or underscores, 2-10 characters';
  }
}

export function IsAssetType(validationOptions?: any) {
  return function (object: Object, propertyName: string) {
    const { registerDecorator } = require('class-validator');
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAssetTypeConstraint,
    });
  };
}