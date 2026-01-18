/**
 * Test Utilities
 * Helper functions and assertions for testing.
 */

import assert from 'node:assert';

/**
 * Asserts that an async function throws an error with a specific message
 * @param {Function} fn - Async function to test
 * @param {string|RegExp} message - Expected error message
 * @param {string} customMessage - Custom assertion message
 */
export async function assertThrowsAsync(fn, message, customMessage) {
  try {
    await fn();
    throw new assert.AssertionError({
      message: customMessage || `Expected function to throw with message: ${message}`,
      actual: 'No error thrown',
      expected: message
    });
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }

    const msg = error.message;

    if (typeof message === 'string') {
      assert.ok(
        msg.includes(message),
        customMessage || `Expected error message to include "${message}", but got "${msg}"`
      );
    } else if (message instanceof RegExp) {
      assert.ok(
        message.test(msg),
        customMessage || `Expected error message to match ${message}, but got "${msg}"`
      );
    }
  }
}

/**
 * Asserts that an object has all specified properties
 * @param {Object} obj - Object to test
 * @param {string[]} props - Required properties
 * @param {string} customMessage - Custom assertion message
 */
export function assertHasProperties(obj, props, customMessage) {
  const missing = props.filter(p => !(p in obj));

  assert.strictEqual(
    missing.length,
    0,
    customMessage || `Missing required properties: ${missing.join(', ')}`
  );
}

/**
 * Asserts that an object only has the specified properties (no extras)
 * @param {Object} obj - Object to test
 * @param {string[]} allowedProps - Allowed properties
 * @param {string} customMessage - Custom assertion message
 */
export function assertOnlyHasProperties(obj, allowedProps, customMessage) {
  const extra = Object.keys(obj).filter(k => !allowedProps.includes(k));

  assert.strictEqual(
    extra.length,
    0,
    customMessage || `Object has unexpected properties: ${extra.join(', ')}`
  );
}

/**
 * Asserts that a value is a valid ISO 8601 date string
 * @param {string} dateStr - Date string to validate
 * @param {string} customMessage - Custom assertion message
 */
export function assertIsValidDate(dateStr, customMessage) {
  const date = new Date(dateStr);

  assert.ok(
    !isNaN(date.getTime()),
    customMessage || `"${dateStr}" is not a valid ISO 8601 date string`
  );

  assert.ok(
    dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
    customMessage || `"${dateStr}" is not in ISO 8601 format`
  );
}

/**
 * Asserts that a value is a valid URL
 * @param {string} url - URL to validate
 * @param {string} customMessage - Custom assertion message
 */
export function assertIsValidUrl(url, customMessage) {
  try {
    new URL(url);
  } catch (error) {
    throw new assert.AssertionError({
      message: customMessage || `"${url}" is not a valid URL`,
      actual: url
    });
  }
}

/**
 * Waits for a specified amount of time (useful for testing timeouts)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a promise that rejects after a timeout
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout message
 * @returns {Promise<never>}
 */
export function timeout(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Races a promise against a timeout
 * @param {Promise} promise - Promise to race
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Timeout message
 * @returns {Promise} Resolved promise or timeout error
 */
export function withTimeout(promise, ms, message) {
  return Promise.race([promise, timeout(ms, message)]);
}

/**
 * Mocks the current time for testing time-dependent code
 * @param {string|Date} mockTime - Time to set
 * @returns {Function} Restore function
 */
export function mockTime(mockTime) {
  const mockDate = new Date(mockTime);
  const originalDate = global.Date;

  // Mock Date constructor and now()
  global.Date = class extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(mockDate);
      } else {
        super(...args);
      }
    }

    static now() {
      return mockDate.getTime();
    }

    static parse(...args) {
      return originalDate.parse(...args);
    }

    static UTC(...args) {
      return originalDate.UTC(...args);
    }
  };

  // Return restore function
  return () => {
    global.Date = originalDate;
  };
}

/**
 * Spies on a method and tracks calls
 * @param {Object} obj - Object containing the method
 * @param {string} methodName - Name of the method to spy on
 * @returns {Object} Spy object with call tracking
 */
export function spy(obj, methodName) {
  const originalMethod = obj[methodName];
  const calls = [];

  obj[methodName] = function (...args) {
    calls.push({
      args,
      timestamp: Date.now(),
      returnValue: undefined
    });

    const result = originalMethod.apply(this, args);
    calls[calls.length - 1].returnValue = result;

    // Handle async return values
    if (result?.then) {
      return result.then(r => {
        calls[calls.length - 1].returnValue = r;
        return r;
      });
    }

    return result;
  };

  return {
    restore: () => {
      obj[methodName] = originalMethod;
    },
    getCalls: () => calls,
    getCallCount: () => calls.length,
    wasCalled: () => calls.length > 0,
    wasCalledWith: (...args) => {
      return calls.some(call =>
        args.length === call.args.length &&
        args.every((arg, i) => arg === call.args[i])
      );
    },
    reset: () => {
      calls.length = 0;
    }
  };
}

/**
 * Stubs a property on an object
 * @param {Object} obj - Object to stub
 * @param {string} propName - Property name
 * @param {*} value - Stub value
 * @returns {Function} Restore function
 */
export function stub(obj, propName, value) {
  const original = obj[propName];
  obj[propName] = value;

  return () => {
    obj[propName] = original;
  };
}

/**
 * Creates a test environment variable override
 * @param {Object} envVars - Environment variables to set
 * @returns {Function} Restore function
 */
export function mockEnv(envVars) {
  const originals = {};

  Object.entries(envVars).forEach(([key, value]) => {
    originals[key] = process.env[key];
    process.env[key] = value;
  });

  return () => {
    Object.entries(originals).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
}

/**
 * Captures console output for testing
 * @param {string} method - Console method to capture ('log', 'error', 'warn', etc.)
 * @returns {Object} Capture object with restore function
 */
export function captureConsole(method = 'log') {
  const original = console[method];
  const output = [];

  console[method] = (...args) => {
    output.push(args);
  };

  return {
    getOutput: () => output,
    getOutputString: () => output.map(args => args.join(' ')).join('\n'),
    restore: () => {
      console[method] = original;
    },
    clear: () => {
      output.length = 0;
    }
  };
}

/**
 * Retries an async function until it succeeds or max attempts reached
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<*>} Result of successful attempt
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 100,
    backoff = 2,
    retryIf = () => true
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !retryIf(error, attempt)) {
        throw error;
      }

      await wait(delay * Math.pow(backoff, attempt - 1));
    }
  }

  throw lastError;
}

/**
 * Deep clones an object (useful for testing immutability)
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
}

/**
 * Generates a random test string
 * @param {string} prefix - Prefix for the string
 * @returns {string} Random test string
 */
export function randomString(prefix = 'test') {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a random integer within a range
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Export all utilities
export default {
  assertThrowsAsync,
  assertHasProperties,
  assertOnlyHasProperties,
  assertIsValidDate,
  assertIsValidUrl,
  wait,
  timeout,
  withTimeout,
  mockTime,
  spy,
  stub,
  mockEnv,
  captureConsole,
  retry,
  deepClone,
  randomString,
  randomInt
};
