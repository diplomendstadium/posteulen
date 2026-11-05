/** Domain-separation strings (ARCHITECTURE 2.2). Never change existing values. */
export const CONTEXTS = {
  MASTER_KEY_WRAP: 'PostEulen/master-key-wrap/v1',
  IDENTITY_KEYS: 'PostEulen/identity-keys/v1',
  CONTACT_VAULT: 'PostEulen/contact-vault/v1',
  LETTER: 'PostEulen/letter/v1',
  LETTER_SIG: 'PostEulen/letter-sig/v1',
  LETTER_AD: 'PostEulen/letter-ad/v1',
  LETTER_KEY: 'PostEulen/letter-key/v1',
  SAFETY_NUMBER: 'PostEulen/safety-number/v1',
  AD_MASTER_KEY: 'PostEulen/ad/master-key/v1',
  AD_IDENTITY_KEYS: 'PostEulen/ad/identity-keys/v1',
  AD_VAULT: 'PostEulen/ad/vault/v1',
} as const;

/** Server-side derivations from the root secret (ARCHITECTURE 2.5). */
export const SERVER_CONTEXTS = {
  OPENAI_KEY: 'PostEulen/server/openai-key/v1',
  NAME_LOCK: 'PostEulen/server/name-lock/v1',
  CONTACT_REQUEST: 'PostEulen/server/contact-request/v1',
  LOAN_NAME: 'PostEulen/server/loan-name/v1',
  FAKE_CREDENTIAL: 'PostEulen/server/fake-credential/v1',
  INVITE: 'PostEulen/server/invite/v1',
  ALTCHA: 'PostEulen/server/altcha/v1',
  BACKUP_CHECK: 'PostEulen/server/backup-check/v1',
} as const;
