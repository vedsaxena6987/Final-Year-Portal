// lib/logger.js
// Production-safe logging utility
// Prevents sensitive data from appearing in browser console in production

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Log general information (disabled in production)
   * @param {...any} args - Arguments to log
   */
  log: (...args) => {
    if (isDevelopment) {
    }
  },

  /**
   * Log errors (always enabled, but sanitized in production)
   * @param {...any} args - Arguments to log
   */
  error: (...args) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // In production, log errors but sanitize sensitive data
      const sanitized = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return '[Object]';
        }
        return String(arg).replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
      });
      console.error('Error:', sanitized[0]);
    }
  },

  /**
   * Log warnings (disabled in production)
   * @param {...any} args - Arguments to log
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log debug information (disabled in production)
   * @param {...any} args - Arguments to log
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Log information that should appear in production (use sparingly)
   * @param {...any} args - Arguments to log
   */
  info: (...args) => {
    console.info(...args);
  },
};

export default logger;
