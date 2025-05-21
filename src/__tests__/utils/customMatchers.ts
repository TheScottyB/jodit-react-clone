import { Jodit } from 'jodit';
import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';

declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveEditorValue(expected: string): R;
      toHaveEditorState(options: { readonly?: boolean; disabled?: boolean }): R;
    }
  }
}

/**
 * Custom Jest matchers for asserting on Jodit editor instances.
 */
const customMatchers = {
  toHaveEditorValue(received: any, expected: string) {
    const joditInstance = received as Jodit;
    
    // Check if the received object is a Jodit instance
    if (!joditInstance || typeof joditInstance.value !== 'string') {
      return {
        pass: false,
        message: () => 
          `${matcherHint('.toHaveEditorValue')}\n\n` +
          'Expected a Jodit editor instance but received ' +
          `${typeof received === 'object' ? 'an invalid object' : printReceived(received)}`
      };
    }
    
    const pass = joditInstance.value === expected;
    
    return {
      pass,
      message: () => 
        `${matcherHint('.toHaveEditorValue')}\n\n` +
        `Expected editor to ${pass ? 'not ' : ''}have value:\n` +
        `  ${printExpected(expected)}\n` +
        'Received:\n' +
        `  ${printReceived(joditInstance.value)}`
    };
  },
  
  toHaveEditorState(received: any, options: { readonly?: boolean; disabled?: boolean }) {
    const joditInstance = received as Jodit;
    
    // Check if the received object is a Jodit instance
    if (!joditInstance || typeof joditInstance.getReadOnly !== 'function') {
      return {
        pass: false,
        message: () => 
          `${matcherHint('.toHaveEditorState')}\n\n` +
          'Expected a Jodit editor instance but received ' +

