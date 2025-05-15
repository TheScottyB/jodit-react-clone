# Jodit React - Project Summary

## Project Overview

Jodit React is a modern React component wrapper for the [Jodit](https://xdsoft.net/jodit/) WYSIWYG (What You See Is What You Get) editor. This project aims to provide a seamless integration of the powerful Jodit editor within React applications while maintaining compatibility with the latest React standards (React 19).

The project serves as a bridge between React's component-based architecture and Jodit's rich text editing capabilities, making it easy for developers to incorporate advanced editing features into their React applications.

## Key Features

- **React 19.1 Compatibility**: Fully compatible with the latest React version
- **TypeScript Support**: Complete TypeScript integration with full type definitions
- **Modern Build System**: Uses Webpack 5 for efficient bundling
- **Comprehensive Testing**: Includes unit and integration testing infrastructure
- **Component Props API**: Well-defined prop interface for easy integration
- **Performance Optimized**: Smart re-rendering and value handling
- **Extensible Configuration**: Supports all Jodit configuration options

## Technical Stack

### Core Technologies
- **React**: v19.1.0 - Frontend library for building user interfaces
- **TypeScript**: v5.7.3 - Typed JavaScript for better developer experience
- **Jodit**: v4.6.2 - The core WYSIWYG editor engine

### Development Tools
- **Webpack**: v5.99.8 - Module bundler
- **Babel**: v7.24.0+ - JavaScript compiler
- **ESLint**: v8.57.1 - Code linting
- **Prettier**: v3.5.3 - Code formatting
- **Jest**: v29.7.0 - Testing framework
- **React Testing Library**: v14.3.1 - React component testing

### Additional Dependencies
- **@square/web-sdk**: v2.1.0 - Integration with Square's Web SDK
- **axios**: v1.9.0 - HTTP client for API requests
- **bottleneck**: v2.19.5 - Rate limiting and traffic shaping
- **dotenv**: v16.5.0 - Environment variable management
- **winston**: v3.17.0 - Logging library

## Project Structure

The project follows a standard React library structure:

```
jodit-react-clone/
├── build/              # Compiled output
├── examples/           # Demo applications
├── src/                # Source code
│   ├── JoditEditor.tsx # Main component
│   ├── index.ts        # Main export
│   └── __tests__/      # Test files
├── index.d.ts          # Type definitions
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── webpack.config.js   # Webpack configuration
```

## Setup and Installation

### Requirements
- Node.js >= 18.0.0
- npm or yarn

### Installation in a React Project

```bash
# Install the package
npm install jodit-react@^1.1.0

# Or with yarn
yarn add jodit-react@^1.1.0
```

## Usage Example

```typescript
import React, { useState, useRef } from 'react';
import { JoditEditor } from 'jodit-react';

const Editor: React.FC = () => {
  const editor = useRef(null);
  const [content, setContent] = useState('');
  
  const config = {
    readonly: false,
    height: 400,
    buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'link', 'image'],
    uploader: {
      insertImageAsBase64URI: true
    }
  };
  
  return (
    <JoditEditor
      ref={editor}
      value={content}
      config={config}
      tabIndex={1}
      onBlur={newContent => setContent(newContent)} // preferred for performance
      onChange={newContent => {}}
    />
  );
};
```

## Component Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | string | Editor content |
| `config` | object | Jodit configuration object |
| `onChange` | function | Content change handler |
| `onBlur` | function | Blur event handler |
| `tabIndex` | number | Tab index for the editor |
| `name` | string | Name attribute for the textarea |

## Development Workflow

### Setting Up Development Environment

1. Clone the repository
   ```bash
   git clone [repository-url]
   cd jodit-react-clone
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start development server
   ```bash
   npm run dev
   ```

4. Run the demo application
   ```bash
   npm run demo
   ```
   Open `http://localhost:4000` in your browser

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:integration` - Run integration tests
- `npm run lint` - Check for code issues
- `npm run lint:fix` - Fix code issues automatically
- `npm run type-check` - Run TypeScript type checking
- `npm run demo` - Run demo application

## Testing Strategy

The project uses Jest and React Testing Library for testing:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test the component's interaction with Jodit
- **Synchronization Tests**: Verify content synchronization

To run tests:
```bash
npm test
```

## Build and Deployment

### Building for Production

```bash
npm run build
```

This creates optimized files in the `build/` directory.

### Publishing to npm

```bash
npm run prepublishOnly  # Runs build automatically
npm publish
```

## Integration Notes

The project includes integration capabilities with Square's Web SDK, potentially for handling:

- E-commerce content
- Product descriptions
- Payment form customization
- Order management

## Contributing Guidelines

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests to ensure they pass (`npm test`)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Repository Information

- **Repository**: [GitHub](https://github.com/jodit/jodit-react.git)
- **Issues**: [GitHub Issues](https://github.com/jodit/jodit-react/issues)
- **Homepage**: [Jodit Homepage](https://xdsoft.net/jodit/)

## Acknowledgements

- Jodit Editor - The core WYSIWYG editor
- React Team - For the amazing React library
- Contributors - All who have contributed to this project

