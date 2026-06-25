import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsStatutoryOrPositiveInt(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStatutoryOrPositiveInt',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a positive integer or the literal string "statutory"`,
        ...options,
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (value === 'statutory') return true;
          return (
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value > 0
          );
        },
      },
    });
  };
}
