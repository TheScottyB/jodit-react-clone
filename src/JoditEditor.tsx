import { useEffect, useRef, forwardRef, useLayoutEffect } from 'react';
import { Jodit } from 'jodit';
import 'jodit/es2021/jodit.min.css';

export interface JoditEditorProps {
  value: string;
  config?: Record<string, any>;
  onChange?: (newContent: string) => void;
  onBlur?: (newContent: string) => void;
  tabIndex?: number;
  name?: string;
}

export const JoditEditor = forwardRef<HTMLTextAreaElement, JoditEditorProps>(({
  value,
  config = {},
  onChange,
  onBlur,
  tabIndex,
  name
}, ref) => {
  const textArea = useRef<HTMLTextAreaElement | null>(null);
  const joditInstance = useRef<Jodit | null>(null);

  useLayoutEffect(() => {
    if (ref) {
      if (typeof ref === 'function') {
        ref(textArea.current);
      } else {
        ref.current = textArea.current;
      }
    }
  }, [ref]);

  // Initialize editor
  useEffect(() => {
    if (!textArea.current) return;

    const element = textArea.current;
    // Create a base config to avoid deep type recursion
    const editorConfig: Record<string, any> = {
      enableDragAndDropFileToEditor: true,
      uploader: {
        withCredentials: true
      }
    };
    
    // Merge with user config
    if (config) {
      Object.assign(editorConfig, config);
      
      // Handle uploader separately to avoid deep recursion
      if (config.uploader) {
        editorConfig.uploader = {
          ...editorConfig.uploader,
          ...config.uploader
        };
      }
    }
    
    const editor = Jodit.make(element, editorConfig);

    joditInstance.current = editor;
    editor.value = value; // Set initial value

    const handleBlur = () => {
      onBlur?.(editor.value);
    };

    const handleChange = () => {
      onChange?.(editor.value);
    };

    editor.events.on('blur', handleBlur);
    editor.events.on('change', handleChange);
    editor.workplace.tabIndex = tabIndex ?? -1;

    return () => {
      editor.destruct();
      joditInstance.current = null;
    };
  }, []); // Empty dependency array as we handle updates separately

  // Handle value updates
  useEffect(() => {
    const editor = joditInstance.current;
    if (editor && editor.value !== value) {
      editor.value = value;
    }
  }, [value]);

  // Handle config updates
  useEffect(() => {
    const editor = joditInstance.current;
    if (editor) {
      editor.workplace.tabIndex = tabIndex ?? -1;
    }
  }, [tabIndex]);

  return <textarea ref={textArea} name={name} />;
});

JoditEditor.displayName = 'JoditEditor';

