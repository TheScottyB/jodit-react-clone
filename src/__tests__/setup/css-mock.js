/**
 * CSS Module mock for Jest tests
 * 
 * This file is imported automatically by Jest when CSS files are imported in test files.
 * It creates a Proxy that returns the property name as the class name, which is
 * the expected behavior when using CSS modules in tests.
 */

module.exports = new Proxy(
  {},
  {
    get: function(target, prop) {
      // Handle CSS modules by returning the class name as a string
      if (prop === '__esModule') {
        return { default: {} };
      }
      
      // Return the property name as a string
      return prop;
    },
  }
);

