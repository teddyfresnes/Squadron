'use strict';

// A password is secure when: non-empty, ≥8 chars, has a digit, has an uppercase letter.
function isSecurePassword(password) {
  if (!password || typeof password !== 'string' || password.length === 0) return false;
  if (password.length < 8)        return false;
  if (!/[0-9]/.test(password))    return false;
  if (!/[A-Z]/.test(password))    return false;
  return true;
}

module.exports = { isSecurePassword };
