# React Jodit WYSIWYG Editor

[![npm](https://img.shields.io/npm/v/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)
[![npm](https://img.shields.io/npm/dm/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)
[![npm](https://img.shields.io/npm/l/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)

A modern React component wrapper for [Jodit](https://xdsoft.net/jodit/) WYSIWYG editor, updated for 2025 standards.

## Why This Matters to SMBs

For small and medium-sized businesses, particularly online retailers, content creation is a critical aspect of customer engagement and conversion. This React Jodit WYSIWYG editor component provides:

- **Cost-effective content management:** Eliminates the need for expensive enterprise CMS solutions
- **Reduced technical barriers:** Non-technical staff can create rich, professional content without HTML knowledge
- **Enhanced product descriptions:** Easily format text, insert images, and create compelling product listings that drive sales
- **Seamless integration:** Works with Square, Shopify, and other e-commerce platforms favored by small retailers
- **Mobile-friendly editing:** Supports content creation across all devices, vital for busy small business owners
- **Customizable experience:** Adapts to specific business needs without requiring developer intervention

Perfect for small retailers looking to enhance their online presence without significant technical overhead or expense.

## Features

- TypeScript support with full type definitions
- React 19.1 compatibility
- Modern build system with Webpack 5
- Comprehensive test coverage
- Improved value handling and prop updates
- Accessibility compliant for diverse user needs
- Optimized performance for fast loading and editing experience

## Installation

```bash
npm install jodit-react@^1.1.0
```

## Usage

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

- `value`: string - Editor content
- `config`: object - Jodit configuration object (see [Jodit documentation](https://xdsoft.net/jodit/doc/))
- `onChange`: (newContent: string) => void - Content change handler
- `onBlur`: (newContent: string) => void - Blur event handler
- `tabIndex`: number - Tab index for the editor
- `name`: string - Name attribute for the textarea


## Development Tools

This project leverages modern development tools to ensure high quality and productivity:

- **Warp Terminal:** Enhanced terminal experience for DevOps and command-line operations
- **AI Assistance:** 
  - Claude/Claude Max for natural language processing and code generation
  - GitHub Copilot for intelligent code completion
- **IDEs and Editors:**
  - Cursor for AI-enhanced code editing
  - Visual Studio Code with extensions for React development
- **Development Environments:**
  - Bolt/StackBlitz for collaborative coding and testing
- **Visual Assets:**
  - Sora/Midjourney for generating UI mockups and documentation visuals
- **Version Control:**
  - GitHub for source control and collaboration

## Local Development Setup

For contributors or those wanting to run the project locally:

1. **Prerequisites:**
   - Node.js (v18.0.0 or higher)
   - npm (v8.0.0 or higher)
   - Git

2. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/jodit-react-clone.git
   cd jodit-react-clone
   ```

3. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```
   Note: The `--legacy-peer-deps` flag may be necessary due to React 19 compatibility.

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Run the demo application:**
   ```bash
   npm run demo
   ```
   The demo will be available at `http://localhost:4000`

6. **Verify your setup:**
   - The demo page should load with a functioning editor
   - Try formatting text and inserting images to confirm functionality

7. **Common troubleshooting:**
   - If you encounter module resolution issues, try clearing npm cache: `npm cache clean --force`
   - For React version conflicts, check `package.json` and ensure compatible versions

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run linting
- `npm run type-check` - Run type checking
- `npm run demo` - Run demo application

## Updates

To update to the latest version:
```bash
npm update jodit-react
```


## How to Contribute

We welcome contributions from the community! Here's how to get started:

1. **Fork the repository** to your GitHub account
2. **Clone your fork** to your local machine
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** following our code style guidelines
5. **Write or update tests** for any changes
6. **Run the test suite** to ensure everything passes:
   ```bash
   npm test
   ```
7. **Run linting and type checking**:
   ```bash
   npm run lint
   npm run type-check
   ```
8. **Document your changes** in the code and update README if necessary
9. **Commit your changes** with clear, descriptive commit messages
10. **Push to your fork**:
    ```bash
    git push origin feature/your-feature-name
    ```
11. **Submit a pull request** to the main repository

### Contribution Guidelines

- Focus on a single feature or bug fix per pull request
- Maintain the existing coding style
- Add unit tests for any new functionality
- Update documentation as needed
- Be respectful and constructive in discussions

We aim to review all pull requests within 7 business days.

## License

This package is available under the MIT License.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes and updates.

## Support

For questions or issues regarding implementation, please:

1. Check the [existing issues](https://github.com/your-username/jodit-react-clone/issues) on GitHub
2. Create a new issue if your problem hasn't been addressed
3. For usage questions, consider using [Stack Overflow](https://stackoverflow.com/questions/tagged/jodit-react) with the tag `jodit-react`

## Business Integration Examples

- E-commerce product description editors
- Blog post authoring systems for small business websites
- Customer review management interfaces
- Email template creation tools for marketing campaigns
- Knowledge base and documentation systems

By implementing this editor in your small business applications, you provide users with professional content creation capabilities without additional technical complexity.
