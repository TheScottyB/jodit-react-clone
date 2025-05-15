import React from 'react';
import { render, screen } from '@testing-library/react';
import { JoditEditor } from '../JoditEditor';
import { Jodit } from 'jodit';

// Mock Jodit module with improved value handling
jest.mock('jodit', () => {
  const createEditor = (_element: HTMLTextAreaElement, _config: any) => {
    const editor = {
      _value: '',
      get value() {
        return this._value;
      },
      set value(newValue: string) {
        const oldValue = this._value;
        this._value = newValue;
        if (oldValue !== newValue) {
          this.events.fire('change');
        }
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

describe('JoditEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders textarea element', () => {
    render(<JoditEditor value="" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('passes name prop to textarea', () => {
    const name = 'editor';
    render(<JoditEditor value="" name={name} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('name', name);
  });

  it('initializes with provided value', () => {
    const value = 'initial content';
    render(<JoditEditor value={value} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    expect(editor.value).toBe(value);
  });

  it('updates editor value when prop changes', () => {
    const { rerender } = render(<JoditEditor value="initial" />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    expect(editor.value).toBe('initial');
    
    rerender(<JoditEditor value="updated" />);
    expect(editor.value).toBe('updated');
  });

  it('calls onChange when content changes', () => {
    const onChange = jest.fn();
    render(<JoditEditor value="initial" onChange={onChange} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    editor.value = 'new content';
    expect(onChange).toHaveBeenCalledWith('new content');
  });

  it('calls onBlur when editor loses focus', () => {
    const onBlur = jest.fn();
    render(<JoditEditor value="initial" onBlur={onBlur} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    
    editor.events.fire('blur');
    expect(onBlur).toHaveBeenCalledWith('initial');
  });

  it('sets tabIndex on the editor workplace', () => {
    const tabIndex = 5;
    render(<JoditEditor value="" tabIndex={tabIndex} />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    expect(editor.workplace.tabIndex).toBe(tabIndex);
  });

  it('cleans up editor instance on unmount', () => {
    const { unmount } = render(<JoditEditor value="" />);
    const editor = (Jodit.make as jest.Mock).mock.results[0].value;
    unmount();
    expect(editor.destruct).toHaveBeenCalled();
  });

  it('forwards ref to textarea element', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<JoditEditor value="" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});

