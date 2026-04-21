import {
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

@ValidatorConstraint({ name: 'isSecureHttpUrl', async: false })
class IsSecureHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return false;
    }

    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || (
        parsed.protocol === 'http:' && LOCAL_HOSTNAMES.has(parsed.hostname)
      );
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'URL must use HTTPS unless it points to localhost';
  }
}

export function IsSecureHttpUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSecureHttpUrlConstraint,
    });
  };
}
