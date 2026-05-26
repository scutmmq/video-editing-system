(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.JwtTokenModule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getNowSeconds(now) {
    const value = typeof now === 'function' ? now() : now;
    if (Number.isFinite(value)) return Math.floor(value);
    return Math.floor(Date.now() / 1000);
  }

  function decodeBase64Url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error('jwtToken base64url 编码不正确');
    }

    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const remainder = base64.length % 4;
    if (remainder === 2) base64 += '==';
    if (remainder === 3) base64 += '=';
    if (remainder === 1) {
      throw new Error('jwtToken base64url 长度不正确');
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf8');
    }

    const binary = atob(base64);
    try {
      return decodeURIComponent(
        binary.split('').map((char) => {
          return '%' + char.charCodeAt(0).toString(16).padStart(2, '0');
        }).join('')
      );
    } catch (_err) {
      return binary;
    }
  }

  function decodeJwtPayload(jwtToken) {
    const token = String(jwtToken || '').trim();
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => !part)) {
      throw new Error('jwtToken 格式不正确');
    }

    return JSON.parse(decodeBase64Url(parts[1]));
  }

  function validateJwtToken(jwtToken, options = {}) {
    const token = String(jwtToken || '').trim();
    if (!token) {
      return { ok: false, message: 'jwtToken 不能为空', payload: null };
    }

    let payload;
    try {
      payload = decodeJwtPayload(token);
    } catch (err) {
      return {
        ok: false,
        message: err && err.message ? err.message : 'jwtToken 解析失败',
        payload: null,
      };
    }

    if (!Number.isFinite(payload.exp)) {
      return { ok: false, message: 'jwtToken 缺少有效过期时间', payload };
    }

    const clockSkewSeconds = Number.isFinite(options.clockSkewSeconds)
      ? options.clockSkewSeconds
      : 0;
    const now = getNowSeconds(options.now);

    if (payload.exp + clockSkewSeconds <= now) {
      return { ok: false, message: 'jwtToken 已过期', payload };
    }

    return { ok: true, message: '', payload };
  }

  return {
    decodeJwtPayload,
    validateJwtToken,
  };
});
