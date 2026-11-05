import * as opaque from '@serenity-kit/opaque';
import { beforeAll, describe, expect, it } from 'vitest';
import { encodeFields, fromBase64Url, toBase64Url } from '../src/crypto/encoding.ts';
import {
  createAccountKeys,
  ENCRYPTED_PRIVATE_KEYS_BYTES,
  KeyPackageError,
  rewrapMasterKey,
  unlockAccount,
  WRAPPED_MASTER_KEY_BYTES,
  type KeyPackage,
} from '../src/crypto/keypackage.ts';
import * as client from '../src/crypto/opaque-client.ts';

let setup: string;
const userId = 'AAAAAAAAAAAAAAAAAAAAAA';

beforeAll(async () => {
  await client.ready();
  setup = opaque.server.createSetup();
});

function register(password: string, id = userId): { record: string; exportKey: Uint8Array } {
  const start = client.startRegistration(password);
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup: setup,
    userIdentifier: id,
    registrationRequest: start.request,
  });
  return client.finishRegistration(password, start.state, registrationResponse);
}

function login(password: string, record: string | null, id = userId) {
  const start = client.startLogin(password);
  const server = opaque.server.startLogin({
    serverSetup: setup,
    userIdentifier: id,
    registrationRecord: record,
    startLoginRequest: start.request,
  });
  return { result: client.finishLogin(password, start.state, server.loginResponse), server };
}

describe('canonical encoding (D-14)', () => {
  it('separates field boundaries', () => {
    expect(encodeFields('c', 'ab', 'c')).not.toEqual(encodeFields('c', 'a', 'bc'));
    expect(encodeFields('c', 1)).not.toEqual(encodeFields('c', '1'));
    expect(encodeFields('c', 'é')).toEqual(encodeFields('c', 'é'));
    expect(() => encodeFields('c', -1)).toThrow(RangeError);
    expect(() => encodeFields('c', 1.5)).toThrow(RangeError);
    expect(() => encodeFields('c', undefined as unknown as string)).toThrow(TypeError);
  });

  it('round-trips base64url', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    expect(() => fromBase64Url('a+b')).toThrow(TypeError);
    expect(() => fromBase64Url('a')).toThrow(TypeError);
  });
});

describe('key package (SPEC 5.1–5.6, 17.1)', () => {
  it('packs and unlocks with the export_key of a later login', async () => {
    const reg = register('richtig langes Passwort');
    const { keyPackage, account } = await createAccountKeys(userId, reg.exportKey);
    expect(fromBase64Url(keyPackage.wrappedMasterKey)).toHaveLength(WRAPPED_MASTER_KEY_BYTES);
    expect(fromBase64Url(keyPackage.privateKeys)).toHaveLength(ENCRYPTED_PRIVATE_KEYS_BYTES);

    const { result } = login('richtig langes Passwort', reg.record);
    expect(result).not.toBeNull();
    const unlocked = await unlockAccount(userId, keyPackage, result!.exportKey, {
      ed25519: account.identity.ed25519Public,
      x25519: account.identity.x25519Public,
    });
    expect(unlocked.masterKey).toEqual(account.masterKey);
    expect(unlocked.identity.x25519Secret).toEqual(account.identity.x25519Secret);
    expect(unlocked.vaultKey).toEqual(account.vaultKey);
  });

  it('fails for a wrong password and for unknown names alike', () => {
    const reg = register('richtig langes Passwort');
    expect(login('falsches langes Passwort', reg.record).result).toBeNull();
    expect(login('richtig langes Passwort', null, 'BBBBBBBBBBBBBBBBBBBBBB').result).toBeNull();
  });

  it('rejects a replayed login message', () => {
    const reg = register('richtig langes Passwort');
    const first = login('richtig langes Passwort', reg.record);
    const second = login('richtig langes Passwort', reg.record);
    expect(() =>
      opaque.server.finishLogin({
        serverLoginState: second.server.serverLoginState,
        finishLoginRequest: first.result!.finishRequest,
      }),
    ).toThrow();
  });

  it('keeps master and identity keys across a password change', async () => {
    const old = register('altes langes Passwort!');
    const { keyPackage, account } = await createAccountKeys(userId, old.exportKey);
    const next = register('neues langes Passwort?');
    const changed = await rewrapMasterKey(userId, keyPackage, old.exportKey, next.exportKey);
    expect(changed.privateKeys).toBe(keyPackage.privateKeys);
    const keys = { ed25519: account.identity.ed25519Public, x25519: account.identity.x25519Public };
    const unlocked = await unlockAccount(userId, changed, next.exportKey, keys);
    expect(unlocked.masterKey).toEqual(account.masterKey);
    await expect(unlockAccount(userId, changed, old.exportKey, keys)).rejects.toThrow(
      KeyPackageError,
    );
  });

  it('detects tampering, swapped packages and wrong public keys', async () => {
    const reg = register('richtig langes Passwort');
    const { keyPackage, account } = await createAccountKeys(userId, reg.exportKey);
    const keys = { ed25519: account.identity.ed25519Public, x25519: account.identity.x25519Public };

    const flipped = fromBase64Url(keyPackage.privateKeys);
    flipped[40]! ^= 1;
    const tampered: KeyPackage = { ...keyPackage, privateKeys: toBase64Url(flipped) };
    await expect(unlockAccount(userId, tampered, reg.exportKey, keys)).rejects.toThrow(
      KeyPackageError,
    );

    await expect(
      unlockAccount('CCCCCCCCCCCCCCCCCCCCCC', keyPackage, reg.exportKey, keys),
    ).rejects.toThrow(KeyPackageError);

    const other = await createAccountKeys(userId, reg.exportKey);
    await expect(
      unlockAccount(userId, keyPackage, reg.exportKey, {
        ed25519: other.account.identity.ed25519Public,
        x25519: keys.x25519,
      }),
    ).rejects.toThrow(/do not match/);

    await expect(
      unlockAccount(userId, { ...keyPackage, format: 2 }, reg.exportKey, keys),
    ).rejects.toThrow(/unknown key format/);
  });
});
