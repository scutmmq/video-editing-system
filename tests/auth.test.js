const test = require('node:test');
const assert = require('node:assert/strict');

let AuthModule = {};
let JwtTokenModule = {};
try {
  AuthModule = require('../src/auth/auth.js');
} catch (_err) {
  AuthModule = {};
}
try {
  JwtTokenModule = require('../src/auth/jwtToken.js');
} catch (_err) {
  JwtTokenModule = {};
}

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url');
}

function createJwtToken(payload, header = { alg: 'none', typ: 'JWT' }) {
  return `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.signature`;
}

test('validateEmail accepts normal email addresses', () => {
  assert.equal(typeof AuthModule.validateEmail, 'function');
  assert.equal(AuthModule.validateEmail('student@example.com'), true);
  assert.equal(AuthModule.validateEmail(' user.name+tag@example.co.uk '), true);
});

test('validateEmail rejects invalid email formats', () => {
  assert.equal(typeof AuthModule.validateEmail, 'function');
  assert.equal(AuthModule.validateEmail(''), false);
  assert.equal(AuthModule.validateEmail('plain-text'), false);
  assert.equal(AuthModule.validateEmail('missing-domain@'), false);
  assert.equal(AuthModule.validateEmail('@missing-name.com'), false);
  assert.equal(AuthModule.validateEmail('space in@example.com'), false);
});

test('validatePassword requires at least six characters', () => {
  assert.equal(typeof AuthModule.validatePassword, 'function');
  assert.equal(AuthModule.validatePassword('12345').valid, false);
  assert.equal(AuthModule.validatePassword('123456').valid, true);
});

test('signIn rejects invalid email before calling Supabase', async () => {
  assert.equal(typeof AuthModule.createAuthController, 'function');
  let called = false;
  const controller = AuthModule.createAuthController({
    supabaseClient: {
      auth: {
        signInWithPassword: async () => {
          called = true;
          return { data: {}, error: null };
        },
      },
    },
  });

  const result = await controller.signIn('bad-email', '123456');

  assert.equal(result.ok, false);
  assert.match(result.message, /邮箱格式/);
  assert.equal(called, false);
});

test('signIn calls Supabase auth for valid credentials', async () => {
  assert.equal(typeof AuthModule.createAuthController, 'function');
  let payload;
  const jwtToken = createJwtToken({ sub: 'user-1', exp: 1900000000 });
  const controller = AuthModule.createAuthController({
    supabaseClient: {
      auth: {
        signInWithPassword: async (credentials) => {
          payload = credentials;
          return {
            data: {
              user: { email: credentials.email },
              session: { access_token: jwtToken },
            },
            error: null,
          };
        },
      },
    },
    now: () => 1800000000,
  });

  const result = await controller.signIn('student@example.com', '123456');

  assert.equal(result.ok, true);
  assert.deepEqual(payload, {
    email: 'student@example.com',
    password: '123456',
  });
  assert.equal(result.jwtToken, jwtToken);
});

test('signUp calls Supabase auth for valid credentials', async () => {
  assert.equal(typeof AuthModule.createAuthController, 'function');
  let payload;
  const jwtToken = createJwtToken({ sub: 'user-1', exp: 1900000000 });
  const controller = AuthModule.createAuthController({
    supabaseClient: {
      auth: {
        signUp: async (credentials) => {
          payload = credentials;
          return {
            data: {
              user: { email: credentials.email },
              session: { access_token: jwtToken },
            },
            error: null,
          };
        },
      },
    },
    now: () => 1800000000,
  });

  const result = await controller.signUp('student@example.com', '123456');

  assert.equal(result.ok, true);
  assert.deepEqual(payload, {
    email: 'student@example.com',
    password: '123456',
  });
  assert.equal(result.jwtToken, jwtToken);
});

test('signIn reports Supabase not configured', async () => {
  assert.equal(typeof AuthModule.createAuthController, 'function');
  const controller = AuthModule.createAuthController({ supabaseClient: null });

  const result = await controller.signIn('student@example.com', '123456');

  assert.equal(result.ok, false);
  assert.match(result.message, /Supabase/);
});

test('validateJwtToken accepts a structurally valid non-expired jwtToken', () => {
  assert.equal(typeof JwtTokenModule.validateJwtToken, 'function');
  const jwtToken = createJwtToken({ sub: 'user-1', exp: 1900000000 });

  const result = JwtTokenModule.validateJwtToken(jwtToken, { now: 1800000000 });

  assert.equal(result.ok, true);
  assert.equal(result.payload.sub, 'user-1');
});

test('validateJwtToken rejects malformed jwtToken values', () => {
  assert.equal(typeof JwtTokenModule.validateJwtToken, 'function');

  const result = JwtTokenModule.validateJwtToken('not-a-jwt-token', { now: 1800000000 });

  assert.equal(result.ok, false);
  assert.match(result.message, /jwtToken/);
});

test('validateJwtToken rejects expired jwtToken values', () => {
  assert.equal(typeof JwtTokenModule.validateJwtToken, 'function');
  const jwtToken = createJwtToken({ sub: 'user-1', exp: 1700000000 });

  const result = JwtTokenModule.validateJwtToken(jwtToken, { now: 1800000000 });

  assert.equal(result.ok, false);
  assert.match(result.message, /过期/);
});

test('signIn rejects Supabase responses without a valid jwtToken', async () => {
  assert.equal(typeof AuthModule.createAuthController, 'function');
  const controller = AuthModule.createAuthController({
    supabaseClient: {
      auth: {
        signInWithPassword: async () => ({
          data: { session: { access_token: 'invalid.jwtToken' } },
          error: null,
        }),
      },
    },
    now: () => 1800000000,
  });

  const result = await controller.signIn('student@example.com', '123456');

  assert.equal(result.ok, false);
  assert.match(result.message, /jwtToken/);
});
