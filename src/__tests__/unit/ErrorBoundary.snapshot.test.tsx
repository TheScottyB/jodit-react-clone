import React from 'react';
import { render } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * Snapshot tests for ErrorBoundary component
 * 
 * Strategy:
 * 1. Test default error rendering
 * 2. Test custom fallback UI
 * 3. Test with different prop combinations
 * 4. Test error states with various error types
 */

const ErrorComponent = ({ message }: { message: string }) => {
  throw new Error(message);
  return null;
};

describe('ErrorBoundary Snapshots', () => {
  // Suppress console.error for cleaner test output
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should match snapshot when no error occurs', () => {
    const { container } = render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with default error UI', () => {
    const { container } = render(
      <ErrorBoundary>
        <ErrorComponent message="Test error" />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with custom fallback UI', () => {
    const customFallback = (
      <div className="custom-error">
        <h3>Custom Error View</h3>
        <p>Something went wrong in the application</p>
      </div>
    );

    const { container } = render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorComponent message="Test error" />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with custom className', () => {
    const { container } = render(
      <ErrorBoundary className="custom-boundary-class">
        <ErrorComponent message="Test error" />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with complex error message', () => {
    const complexError = new Error('Complex error');
    complexError.stack = 'Error: Complex error\n    at Component\n    at ErrorBoundary';
    
    const ThrowComplexError = () => {
      throw complexError;
      return null;
    };

    const { container } = render(
      <ErrorBoundary>
        <ThrowComplexError />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with nested error boundaries', () => {
    const { container } = render(
      <ErrorBoundary className="outer">
        <div>
          <ErrorBoundary className="inner">
            <ErrorComponent message="Nested error" />
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot when error boundary itself errors', () => {
    const BrokenFallback = () => {
      throw new Error('Fallback error');
      return null;
    };

    const { container } = render(
      <ErrorBoundary fallback={<BrokenFallback />}>
        <ErrorComponent message="Component error" />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot with all props provided', () => {
    const onError = jest.fn();
    const customFallback = <div>Custom error view</div>;

    const { container } = render(
      <ErrorBoundary
        fallback={customFallback}
        onError={onError}
        className="test-class"
        resetKey="123"
      >
        <ErrorComponent message="Test error" />
      </ErrorBoundary>
    );
    expect(container).toMatchSnapshot();
  });
});

