// ParseResourceIdPipe accepts the ID shapes the datastore actually holds:
// random UUIDs, imported IDs like "anilist-21", and seed IDs like "seed-user-demo".
// It still rejects anything that is not a short, URL-safe token.
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

@Injectable()
export class ParseResourceIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (typeof value !== 'string' || !RESOURCE_ID_PATTERN.test(value)) {
      throw new BadRequestException('Invalid resource id');
    }

    return value;
  }
}
