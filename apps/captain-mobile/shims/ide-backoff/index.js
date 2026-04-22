"use strict";

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function computeNextBackoffInterval(
  initialBackoff,
  previousRetryCount,
  {
    multiplier = 1.5,
    randomizationFactor = 0.25,
    minBackoff = initialBackoff,
    maxBackoff = Number.POSITIVE_INFINITY,
  } = {},
) {
  assertCondition(initialBackoff > 0, "The initial backoff interval must be positive");
  assertCondition(previousRetryCount >= 0, "The previous retry count must not be negative");
  assertCondition(multiplier >= 1, "The backoff multiplier must be greater than or equal to 1");
  assertCondition(
    randomizationFactor >= 0 && randomizationFactor <= 1,
    "The randomization factor must be between 0 and 1, inclusive",
  );
  assertCondition(minBackoff >= 0, "The minimum backoff interval must be positive");

  const nextBackoff = initialBackoff * multiplier ** previousRetryCount;
  const jitterFactor = 1 - randomizationFactor + 2 * randomizationFactor * Math.random();
  return Math.min(Math.max(nextBackoff * jitterFactor, minBackoff), maxBackoff);
}

module.exports = {
  computeNextBackoffInterval,
};
