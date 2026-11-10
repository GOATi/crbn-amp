import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { credentialsFile, encodeKey, r2Client, readCredentials, signV4 } from '../lib/r2.mjs';

// AWS's published SigV4 examples for S3 ("Signature Calculations for the Authorization Header:
// Transferring Payload in a Single Chunk"). The signer is pinned byte for byte against them, so a
// slip in canonicalisation fails HERE — against R2 it would only ever be an opaque 403.
const EXAMPLE = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 's3',
  amzDate: '20130524T000000Z',
};
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

test('signV4 reproduces AWS\'s GET Object example', () => {
  const authorization = signV4({
    ...EXAMPLE,
    method: 'GET',
    path: '/test.txt',
    headers: {
      host: 'examplebucket.s3.amazonaws.com',
      range: 'bytes=0-9',
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': EXAMPLE.amzDate,
    },
    payloadHash: EMPTY_SHA256,
  });
  assert.equal(
    authorization,
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
      'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
  );
});

test('signV4 reproduces AWS\'s GET Bucket (list) example — the query is sorted and signed', () => {
  const authorization = signV4({
    ...EXAMPLE,
    method: 'GET',
    path: '/',
    query: { 'max-keys': 2, prefix: 'J' },
    headers: {
      host: 'examplebucket.s3.amazonaws.com',
      'x-amz-content-sha256': EMPTY_SHA256,
      'x-amz-date': EXAMPLE.amzDate,
    },
    payloadHash: EMPTY_SHA256,
  });
  assert.match(authorization, /Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/);
});

test('a key is encoded per segment — slashes kept, spaces and RFC 3986 reserved marks escaped', () => {
  assert.equal(encodeKey('builds/a b/(x)!.png'), 'builds/a%20b/%28x%29%21.png');
});

test('credentials: one file per bucket, under ~/.r2', () => {
  assert.equal(credentialsFile('pmg-dev', 'C:/Users/me'), join('C:/Users/me', '.r2', 'pmg-dev.json'));
});

test('credentials: with an envPrefix the environment wins field by field; a missing one names the variable, never a value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2-cred-'));
  const file = join(dir, 'b.json');
  writeFileSync(file, JSON.stringify({ accountId: 'file-acct', accessKeyId: 'file-key', secretAccessKey: 'file-secret' }));
  const { credentials } = readCredentials({ bucket: 'b', envPrefix: 'PMG_R2', env: { PMG_R2_ACCESS_KEY_ID: 'env-key' }, file });
  assert.deepEqual(credentials, { accountId: 'file-acct', accessKeyId: 'env-key', secretAccessKey: 'file-secret' });

  const { problem } = readCredentials({ bucket: 'b', envPrefix: 'PMG_R2', env: { PMG_R2_SECRET_ACCESS_KEY: 'sshh-value' }, file: join(dir, 'absent.json') });
  assert.match(problem, /PMG_R2_ACCOUNT_ID/);
  assert.match(problem, /PMG_R2_ACCESS_KEY_ID/);
  assert.doesNotMatch(problem, /PMG_R2_SECRET_ACCESS_KEY/); // that one was set
  assert.doesNotMatch(problem, /sshh-value/);
});

test('credentials: with NO envPrefix the environment is never read — another project\'s variables cannot leak in', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2-cred-'));
  const file = join(dir, 'b.json');
  writeFileSync(file, JSON.stringify({ accountId: 'a', accessKeyId: 'k', secretAccessKey: 's' }));
  const env = { R2_ACCESS_KEY_ID: 'other', WONDERMAN_R2_ACCESS_KEY_ID: 'other', undefined_ACCESS_KEY_ID: 'other' };
  assert.equal(readCredentials({ bucket: 'b', env, file }).credentials.accessKeyId, 'k');
});

test('credentials: a template value still holding a <placeholder> counts as missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2-cred-'));
  const file = join(dir, 'b.json');
  writeFileSync(file, JSON.stringify({ accountId: 'a', accessKeyId: '<access key id>', secretAccessKey: 's' }));
  assert.match(readCredentials({ bucket: 'b', file }).problem, /missing accessKeyId/);
});

test('credentials: the Access service token rides along only when both halves are there', () => {
  const dir = mkdtempSync(join(tmpdir(), 'r2-cred-'));
  const file = join(dir, 'b.json');
  const base = { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's' };
  writeFileSync(file, JSON.stringify({ ...base, accessClientId: 'id.access' }));
  assert.deepEqual(readCredentials({ bucket: 'b', file }).credentials, base);
  writeFileSync(file, JSON.stringify({ ...base, accessClientId: 'id.access', accessClientSecret: 'sec' }));
  assert.deepEqual(readCredentials({ bucket: 'b', file }).credentials, { ...base, accessClientId: 'id.access', accessClientSecret: 'sec' });
});

test('the client addresses the account endpoint path-style and pages a truncated listing', async () => {
  const seen = [];
  const pages = [
    '<ListBucketResult><Contents><Key>builds/a/x&amp;y.js</Key><Size>3</Size><ETag>"abc"</ETag></Contents>' +
      '<IsTruncated>true</IsTruncated><NextContinuationToken>t2</NextContinuationToken></ListBucketResult>',
    '<ListBucketResult><Contents><Key>builds/a/z.js</Key><Size>5</Size><ETag>"def"</ETag></Contents>' +
      '<IsTruncated>false</IsTruncated></ListBucketResult>',
  ];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return new Response(pages[seen.length - 1], { status: 200 });
  };
  const client = r2Client({
    credentials: { accountId: 'acct', accessKeyId: 'k', secretAccessKey: 's' },
    bucket: 'wm-bucket',
    fetchImpl,
  });
  const objects = await client.list('builds/a/');
  assert.deepEqual(objects, [
    { key: 'builds/a/x&y.js', size: 3, etag: 'abc' },
    { key: 'builds/a/z.js', size: 5, etag: 'def' },
  ]);
  assert.match(seen[0].url, /^https:\/\/acct\.r2\.cloudflarestorage\.com\/wm-bucket\?/);
  assert.doesNotMatch(seen[0].url, /continuation-token/);
  assert.match(seen[1].url, /continuation-token=t2/);
  assert.match(seen[0].init.headers.authorization, /\/auto\/s3\/aws4_request/);
});

test('an endpoint override (an EU-jurisdiction bucket) replaces the account endpoint', async () => {
  let url;
  const client = r2Client({
    credentials: { accountId: 'acct', accessKeyId: 'k', secretAccessKey: 's' },
    bucket: 'b',
    endpoint: 'https://acct.eu.r2.cloudflarestorage.com/',
    fetchImpl: async (u) => ((url = u), new Response('x')),
  });
  await client.getText('current.json');
  assert.equal(url, 'https://acct.eu.r2.cloudflarestorage.com/b/current.json');
});
