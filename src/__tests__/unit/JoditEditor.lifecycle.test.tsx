import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { JoditEditor } from '../../JoditEditor';
import { Jodit } from 'jodit';

// Mock Jodit module
jest.mock('jodit', () => {
  const createEditor = (_element: HTMLTextAreaElement, _config: any) => {
    const editor = {
      _value: '',
      get value() {
        return this._value;
      },
      set value(newValue: string) {
        this._value = newValue;
        this.events.fire('change');
      },
      events: {
        _handlers: {} as Record<string, Function[]>,
        on(event: string, handler: Function) {
          if (!this._handlers[event]) {
            this._handlers[event] = [];
          }
          this._handlers[event].push(handler);
        },
        off(event: string, handler: Function) {
          if (this._handlers[event]) {
            this._handlers[event] = this._handlers[event].filter(h => h !== handler);
          }
        },
        fire(event: string) {
          if (this._handlers[event]) {
            this._handlers[event].forEach(handler => handler());
          }
        }
      },
      workplace: {
        _tabIndex: -1,
        get tabIndex() {
          return this._tabIndex;
        },
        set tabIndex(value: number) {
          this._tabIndex = value;
        }
      },
      destruct: jest.fn()
    };
    return editor;
  };

  return {
    Jodit: {
      make: jest.fn(createEditor)
    }
  };
});

describe('JoditEditor Lifecycle', () => {
  // Cleanup after each test
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('should properly initialize on mount', () => {
    const value = 'initial content';
    const { container } = render(<JoditEditor value={value} />);
    
    // Check if textarea is created
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    
    // Check if Jodit.make was called
    expect(Jodit.make).toHaveBeenCalledTimes(1);
    expect(Jodit.make).toHaveBeenCalledWith(
      textarea,
      expect.any(Object)
    );
    
    // Check if initial value is set
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    expect(editor.value).toBe(value);
  });

  it('should update editor when props change', () => {
    const initialValue = 'initial';
    const updatedValue = 'updated';
    
    const { rerender } = render(<JoditEditor value={initialValue} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    expect(editor.value).toBe(initialValue);
    
    // Rerender with new value
    rerender(<JoditEditor value={updatedValue} />);
    expect(editor.value).toBe(updatedValue);
  });

  it('should cleanup editor on unmount', () => {
    const { unmount } = render(<JoditEditor value="" />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    unmount();
    expect(editor.destruct).toHaveBeenCalled();
  });

  it('should handle config changes properly', () => {
    const initialConfig = { readonly: false };
    const updatedConfig = { readonly: true };
    
    const { rerender } = render(
      <JoditEditor value="" config={initialConfig} />
    );
    
    // Get the initial editor instance
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    const initialCall = (Jodit.make as jest.Mock).mock.calls[0][1];
    expect(initialCall.readonly).toBe(false);
    
    // Rerender with new config
    rerender(<JoditEditor value="" config={updatedConfig} />);
    const updateCall = (Jodit.make as jest.Mock).mock.calls[1][1];
    expect(updateCall.readonly).toBe(true);
  });

  it('should properly handle event listeners', () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    
    render(<JoditEditor value="" onChange={onChange} onBlur={onBlur} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    // Simulate change event
    act(() => {
      editor.value = 'new value';
    });
    expect(onChange).toHaveBeenCalledWith('new value');
    
    // Simulate blur event
    act(() => {
      editor.events.fire('blur');
    });
    expect(onBlur).toHaveBeenCalledWith('new value');
  });

  it('should handle error states gracefully', () => {
    // Mock console.error to prevent error output during test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock Jodit.make to throw an error
    (Jodit.make as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Editor initialization failed');
    });
    
    // Render should not throw
    expect(() => render(<JoditEditor value="" />)).not.toThrow();
    
    // Check if error was logged
    expect(consoleSpy).toHaveBeenCalled();
    
    // Cleanup
    consoleSpy.mockRestore();
  });

  it('should maintain editor state during updates', () => {
    const { rerender } = render(<JoditEditor value="initial" />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    // Simulate user input
    act(() => {
      editor.value = 'user input';
    });
    
    // Rerender with unrelated prop change
    rerender(<JoditEditor value="initial" className="new-class" />);
    
    // Editor value should remain unchanged
    expect(editor.value).toBe('user input');
  });
});

