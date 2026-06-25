import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isStatutoryOrPositiveInt', async: false })
export class IsStatutoryOrPositiveIntConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === 'statutory') return true;
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  defaultMessage(): string {
    return 'Value must be a positive integer or the literal string "statutory"';
  }
}
