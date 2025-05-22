import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../../components/ErrorBoundary';

// Types for custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  errorBoundaryProps?: React.ComponentProps<typeof ErrorBoundary>;
}

/**
 * Custom render function that wraps components with ErrorBoundary
 */
const render = (
  ui: React.ReactElement,
  options?: CustomRenderOptions
) => {
  const { errorBoundaryProps, ...renderOptions } = options || {};
  
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        {children}
      </ErrorBoundary>
    );
  };
  
  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
};

/**
 * Helper to create error-throwing components for testing
 */
const createErrorComponent = (
  message: string = 'Test error',
  throwOnRender: boolean = true
): React.FC => {
  return function ErrorComponent() {
    if (throwOnRender) {
      throw new Error(message);
    }
    return <div>No error</div>;
  };
};

/**
 * Helper to measure component render time
 */
const measureRenderTime = async (
  Component: React.ComponentType<any>,
  props?: any
): Promise<{ duration: number; error: Error | null }> => {
  const start = performance.now();
  let error: Error | null = null;
  
  try {
    render(<Component {...props} />);
  } catch (e) {
    error = e as Error;
  }
  
  return {
    duration: performance.now() - start,
    error
  };
};

/**
 * Helper to create a delayed error component for testing async errors
 */
const createAsyncErrorComponent = (
  message: string = 'Async error',
  delayMs: number = 0
): React.FC => {
  return function AsyncErrorComponent() {
    const [shouldThrow, setShouldThrow] = React.useState(false);

    React.useEffect(() => {
      const timer = setTimeout(() => setShouldThrow(true), delayMs);
      return () => clearTimeout(timer);
    }, []);

    if (shouldThrow) {
      throw new Error(message);
    }

    return <div>Loading...</div>;
  };
};

/**
 * Helper to simulate errors in child components
 */
const createErrorTrigger = (onTrigger: () => void): React.FC => {
  return function ErrorTrigger() {
    return (
      <button onClick={onTrigger}>
        Trigger Error
      </button>
    );
  };
};

/**
 * Custom matchers for ErrorBoundary testing
 */
expect.extend({
  toHaveRenderedWithoutError(received) {
    const container = received.container || received;
    const hasError = container.querySelector('.error-boundary') !== null;
    
    return {
      pass: !hasError,
      message: () => 
        hasError
          ? 'Expected component to render without error boundary, but it rendered with an error'
          : 'Expected component to render with error boundary, but it rendered without an error'
    };
  }
});

// Extend Jest types for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveRenderedWithoutError(): R;
    }
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export {
  render,
  createErrorComponent,
  createAsyncErrorComponent,
  createErrorTrigger,
  measureRenderTime
};

