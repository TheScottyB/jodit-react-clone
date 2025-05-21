import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import { JoditEditor } from '../../JoditEditor';

// Mock Jodit to prevent actual initialization
jest.mock('jodit', () => {
  const createEditor = (_element: HTMLTextAreaElement, _config: any) => {
    return {
      value: '',
      events: {
        on: jest.fn(),
        off: jest.fn()
      },
      workplace: {
        tabIndex: -1
      },
      destruct: jest.fn()
    };
  };

  return {
    Jodit: {
      make: jest.fn(createEditor)
    }
  };
});

describe('JoditEditor Performance', () => {
  let container: HTMLDivElement | null = null;
  
  beforeEach(() => {
    // Set up a DOM element as a render target
    container = document.createElement('div');
    document.body.appendChil

