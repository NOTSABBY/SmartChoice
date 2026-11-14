/**
 * Shared Numerical Validation Utilities
 */

function isValidFiniteNumber(val) {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

function isPositiveFiniteNumber(val) {
  return isValidFiniteNumber(val) && val > 0;
}

function isNonNegativeFiniteNumber(val) {
  return isValidFiniteNumber(val) && val >= 0;
}

module.exports = {
  isValidFiniteNumber,
  isPositiveFiniteNumber,
  isNonNegativeFiniteNumber
};