/* eslint-disable no-console */

/**
 * DEV-only logger. All console.log calls should go through here
 * so they are stripped in production builds.
 */
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const log = (...args: unknown[]): void => {
  if (isDev) console.log('[HMS]', ...args);
};

export const warn = (...args: unknown[]): void => {
  if (isDev) console.warn('[HMS WARN]', ...args);
};

export const error = (...args: unknown[]): void => {
  // Errors always log — even in production for crash diagnostics
  console.error('[HMS ERROR]', ...args);
};
