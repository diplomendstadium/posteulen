/**
 * v1.3.1: a password that is too easy to guess (SPEC 7.2) – checked in the app at registration
 * and on a password change, as the server never sees the password (OPAQUE). The list of
 * frequent passwords is loaded only then.
 */
import { commonPasswords, passwordWeakness } from '@posteulen/shared/security/password.ts';
import { t } from './i18n.svelte.ts';

/** The message for a weak password, or null. */
export async function weakError(password: string, userName: string): Promise<string | null> {
  const weakness = passwordWeakness(password, userName, await commonPasswords());
  if (weakness === 'contains_name') return t.register.containsName;
  if (weakness === 'common') return t.register.common;
  if (weakness === 'pattern') return t.register.pattern;
  return null;
}
