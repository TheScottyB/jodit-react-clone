import React from 'react';
import { render, screen, fireEvent, createErrorComponent } from '../setup/test-utils';
import ErrorBoundary from '../../components/ErrorBoundary';

const ErrorComponent = createErrorComponent('Test error');

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    const { container } = render(
      <div>Test content</div>,
      { errorBoundaryProps: {} }
    );

    expect(container).toHaveRenderedWithoutError();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render default fallback UI when an error occurs', () => {
    render(
      <ErrorComponent />,
      { errorBoundaryProps: {} }
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Error details')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('should render custom fallback UI when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorComponent />,
      { errorBoundaryProps: { fallback: customFallback } }
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('should call onError callback when an error occurs', () => {
    const onError = jest.fn();
    
    render(
      <ErrorComponent />,
      { errorBoundaryProps: { onError } }
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    );
  });

  it('should reset error state when resetKey changes', () => {
    const NonThrowingError = createErrorComponent('Test error', false);
    
    const { rerender } = render(
      <ErrorComponent />,
      { errorBoundaryProps: { resetKey: "1" } }
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    rerender(
      <NonThrowingError />,
      { errorBoundaryProps: { resetKey: "2" } }
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should reset error state when "Try again" is clicked', () => {
    const NonThrowingError = createErrorComponent('Test error', false);
    
    const { rerender } = render(
      <ErrorComponent />,
      { errorBoundaryProps: {} }
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try again'));

    rerender(
      <NonThrowingError />,
      { errorBoundaryProps: {} }
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should apply custom className to error container', () => {
    render(
      <ErrorComponent />,
      { errorBoundaryProps: { className: 'custom-error' } }
    );

    const container = screen.getByText('Something went wrong').parentElement;
    expect(container).toHaveClass('error-boundary', 'custom-error');
  });

  // Additional test cases for edge cases and accessibility

  it('should handle nested error boundaries correctly', () => {
    const NestedErrorComponent = () => (
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    render(
      <NestedErrorComponent />,
      { errorBoundaryProps: {} }
    );

    // Only the inner error boundary should catch the error
    expect(screen.getAllByText('Something went wrong')).toHaveLength(1);
  });

  it('should maintain error details collapse state', () => {
    render(
      <ErrorComponent />,
      { errorBoundaryProps: {} }
    );

    const details = screen.getByText('Error details').parentElement as HTMLDetailsElement;
    expect(details.open).toBe(false);

    fireEvent.click(screen.getByText('Error details'));
    expect(details.open).toBe(true);
  });

  it('should be keyboard accessible', () => {
    render(
      <ErrorComponent />,
      { errorBoundaryProps: {} }
    );

    const tryAgainButton = screen.getByText('Try again');
    const errorDetails = screen.getByText('Error details');

    // Button should be focusable
    tryAgainButton.focus();
    expect(tryAgainButton).toHaveFocus();

    // Details summary should be focusable
    errorDetails.focus();
    expect(errorDetails).toHaveFocus();

    // Should be able to activate with keyboard
    fireEvent.keyDown(errorDetails, { key: 'Enter' });
    expect(errorDetails.parentElement?.open).toBe(true);
  });

  it('should handle errors thrown in error boundary itself', () => {
    const BrokenFallback = () => {
      throw new Error('Fallback error');
      return <div>Never rendered</div>;
    };

    render(
      <ErrorComponent />,
      { errorBoundaryProps: { fallback: <BrokenFallback /> } }
    );

    // Should fallback to default error UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should preserve error boundary state during updates', () => {
    const { rerender } = render(
      <ErrorComponent />,
      { errorBoundaryProps: { className: 'initial' } }
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Update props without changing resetKey
    rerender(
      <ErrorComponent />,
      { errorBoundaryProps: { className: 'updated' } }
    );

    // Error state should be preserved
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong').parentElement)
      .toHaveClass('error-boundary', 'updated');
  });

  it('should handle async errors', async () => {
    const AsyncErrorComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(false);

      React.useEffect(() => {
        setTimeout(() => setShouldThrow(true), 0);
      }, []);

      if (shouldThrow) {
        throw new Error('Async error');
      }

      return <div>Loading...</div>;
    };

    render(
      <AsyncErrorComponent />,
      { errorBoundaryProps: {} }
    );

    // Initially renders loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for error to be thrown
    await screen.findByText('Something went wrong');
    expect(screen.getByText('Async error')).toBeInTheDocument();
  });
});

