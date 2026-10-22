import { Masthead, SignedOutLinks } from '@/components/collection/Masthead';
import { Vacant } from '@/components/collection/Vacant';

export default function NotFound() {
  return (
    <>
      <Masthead auth={<SignedOutLinks />} />
      <Vacant />
    </>
  );
}
