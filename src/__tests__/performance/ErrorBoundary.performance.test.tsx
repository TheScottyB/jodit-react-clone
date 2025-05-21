import React from 'react';
import { render, unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
import ErrorBoundary from '../../components/ErrorBoundary';

// Component that throws an error with configurable frequency
const ErrorProne: React.FC<{
  throwFrequency: number;
  complexity: number;
}> = ({ throwFrequency, complexity }) => {
  // Simulate complex component with nested structure
  const renderComplex = (depth: number): JSX.Element => {
    if (depth === 0) {
      if (Math.random() < throwFrequency) {
        throw new Error('Simulated error');
      }
      return <div>Leaf node</div>;
    }
    
    return (
      <div>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            {renderComplex(depth - 1)}
          </div>
        ))}
      </div>
    );
  };

  return renderComplex(complexity);
};

describe('ErrorBoundary Performance', () => {
  let container: HTMLDivElement | null = null;
  
  beforeEach(() => {
    // Setup a container element for rendering
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Cleanup
    if (container) {
      unmountComponentAtNode(container);
      container.remove();
      container = null;
    }
    jest.restoreAllMocks();
  });

  const measureTime = async (callback: () => void | Promise<void>): Promise<number> => {
    const start = performance.now();
    await callback();
    return performance.now() - start;
  };

  it('should handle errors efficiently (under 5ms)', async () => {
    const errorTime = await measureTime(() => {
      act(() => {
        render(
          <ErrorBoundary>
            <ErrorProne throwFrequency={1} complexity={1} />
          </ErrorBoundary>,
          container
        );
      });
    });

    expect(errorTime).toBeLessThan(5);
  });

  it('should maintain performance with deeply nested components', async () => {
    const times: number[] = [];
    
    // Test with increasing complexity
    for (let complexity = 1; complexity <= 5; complexity++) {
      const time = await measureTime(() => {
        act(() => {
          render(
            <ErrorBoundary>
              <ErrorProne throwFrequency={0.5} complexity={complexity} />
            </ErrorBoundary>,
            container
          );
        });
      });
      times.push(time);
    }

    // Performance should scale roughly linearly with complexity
    times.forEach((time, i) => {
      const baseTime = times[0];
      const expectedMaxTime = baseTime * (i + 1) * 2; // Allow for some overhead
      expect(time).toBeLessThan(expectedMaxTime);
    });
  });

  it('should handle rapid error/recovery cycles efficiently', async () => {
    const cycles = 50;
    let totalTime = 0;

    for (let i = 0; i < cycles; i++) {
      const time = await measureTime(() => {
        act(() => {
          render(
            <ErrorBoundary resetKey={i}>
              <ErrorProne 
                throwFrequency={i % 2 === 0 ? 1 : 0} 
                complexity={1}
              />
            </ErrorBoundary>,
            container
          );
        });
      });
      totalTime += time;
    }

    const averageTime = totalTime / cycles;
    expect(averageTime).toBeLessThan(2); // Average under 2ms per cycle
  });

  it('should not impact performance of non-erroring components', async () => {
    const baselineTime = await measureTime(() => {
      act(() => {
        render(
          <div>
            <ErrorProne throwFrequency={0} complexity={3} />
          </div>,
          container
        );
      });
    });

    const withBoundaryTime = await measureTime(() => {
      act(() => {
        render(
          <ErrorBoundary>
            <ErrorProne throwFrequency={0} complexity={3} />
          </ErrorBoundary>,
          container
        );
      });
    });

    // ErrorBoundary overhead should be minimal
    expect(withBoundaryTime - baselineTime).toBeLessThan(1);
  });

  it('should maintain consistent performance with multiple error boundaries', async () => {
    const boundaryCount = 10;
    const time = await measureTime(() => {
      act(() => {
        render(
          <div>
            {Array.from({ length: boundaryCount }, (_, i) => (
              <ErrorBoundary key={i}>
                <ErrorProne 
                  throwFrequency={0.2} 
                  complexity={2}
                />
              </ErrorBoundary>
            ))}
          </div>,
          container
        );
      });
    });

    // Average time per boundary should be reasonable
    const averageTimePerBoundary = time / boundaryCount;
    expect(averageTimePerBoundary).toBeLessThan(3);
  });

  it('should efficiently handle error callback execution', async () => {
    const callbacks = 100;
    const onError = jest.fn();
    
    const time = await measureTime(() => {
      for (let i = 0; i < callbacks; i++) {
        act(() => {
          render(
            <ErrorBoundary onError={onError}>
              <ErrorProne throwFrequency={1} complexity={1} />
            </ErrorBoundary>,
            container
          );
        });
      }
    });

    expect(onError).toHaveBeenCalledTimes(callbacks);
    expect(time / callbacks).toBeLessThan(2); // Average under 2ms per callback
  });
});

