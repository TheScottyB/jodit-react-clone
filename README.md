# React Jodit WYSIWYG Editor

[![npm](https://img.shields.io/npm/v/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)
[![npm](https://img.shields.io/npm/dm/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)
[![npm](https://img.shields.io/npm/l/jodit-react.svg)](https://www.npmjs.com/package/jodit-react)
[![Build Status](https://img.shields.io/github/actions/workflow/status/TheScottyB/jodit-react-clone/ci.yml?branch=master)](https://github.com/TheScottyB/jodit-react-clone/actions)

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
- Comprehensive test coverage with Jest and React Testing Library
- Improved value handling and prop updates
- Accessibility compliant for diverse user needs
- Optimized performance for fast loading and editing experience
- **Order Synchronization** for seamless e-commerce integration
- **Square SDK Integration** for payment processing and inventory management
- Rate limiting and circuit breaking for robust API interactions
- Efficient error handling and logging system

## Installation

### Basic Installation

```bash
npm install jodit-react@^1.1.0
```

### Installation with Square Integration

For projects requiring Square integration for e-commerce capabilities:

```bash
npm install jodit-react@^1.1.0 @square/web-sdk square
```

**Note:** When using with React 19, you may need to use the `--legacy-peer-deps` flag:

```bash
npm install jodit-react@^1.1.0 @square/web-sdk square --legacy-peer-deps
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

## Square Integration

This package provides seamless integration with Square's payment and order management systems, enabling rich content editing for product descriptions, digital catalogs, and marketing materials.

### Setting Up Square Integration

```typescript
import React, { useState, useRef } from 'react';
import { JoditEditor } from 'jodit-react';
import { SquareClient } from '@square/web-sdk';

const ProductEditor: React.FC = () => {
  const editor = useRef(null);
  const [description, setDescription] = useState('');
  const [squareClient, setSquareClient] = useState(null);
  
  useEffect(() => {
    // Initialize Square client
    const initSquare = async () => {
      const client = await SquareClient.initialize({
        applicationId: 'YOUR_SQUARE_APP_ID',
        locationId: 'YOUR_LOCATION_ID',
        environment: 'sandbox' // Use 'production' for live environment
      });
      setSquareClient(client);
    };
    
    initSquare();
  }, []);
  
  const saveProductDescription = async () => {
    try {
      // Example: Update catalog item with rich text description
      const response = await fetch('/api/square/catalog/item/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemId: 'YOUR_ITEM_ID',
          description: description
        })
      });
      
      if (response.ok) {
        console.log('Product description updated successfully');
      }
    } catch (error) {
      console.error('Error updating product description:', error);
    }
  };
  
  return (
    <div>
      <h2>Product Description Editor</h2>
      <JoditEditor
        ref={editor}
        value={description}
        onChange={setDescription}
        config={{
          buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'link', 'image'],
          uploader: {
            insertImageAsBase64URI: true
          }
        }}
      />
      <button onClick={saveProductDescription}>Save Description</button>
    </div>
  );
};
```

### Order Synchronization

The order synchronization feature allows for real-time updates between your content management system and Square's order processing:

```typescript
import { OrderSyncService } from 'jodit-react/services';

// Initialize the order sync service
const orderSyncService = new OrderSyncService({
  accessToken: 'YOUR_SQUARE_ACCESS_TOKEN',
  environment: 'sandbox', // or 'production'
  webhookUrl: 'https://your-webhook-endpoint.com/square',
  syncInterval: 5 * 60 * 1000 // 5 minutes in milliseconds
});

// Start listening for order updates
orderSyncService.startSync();

// Get notified on order changes
orderSyncService.on('orderUpdated', (order) => {
  console.log('Order updated:', order);
  // Update your UI or trigger other business logic
});
```


## Bundle Size Optimization

This package implements several strategies to optimize bundle size for production deployments:

### Code Splitting

```javascript
// Example: Dynamic import for the editor component
import React, { lazy, Suspense } from 'react';

const JoditEditor = lazy(() => import('jodit-react').then(module => ({ 
  default: module.JoditEditor 
})));

const MyComponent = () => (
  <Suspense fallback={<div>Loading editor...</div>}>
    <JoditEditor />
  </Suspense>
);
```

### Production Build Configuration

The `npm run build` command uses webpack optimizations including:

- Tree shaking to eliminate unused code
- Minification and compression
- Module concatenation

If you're experiencing bundle size issues, consider importing only needed components:

```javascript
// Instead of importing the entire package
import { JoditEditor } from 'jodit-react';

// Import specific components to reduce bundle size
import JoditEditor from 'jodit-react/build/JoditEditor';
```

## Testing Infrastructure

The project uses a comprehensive testing suite:

### Available Test Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage reporting
npm run test:coverage

# Run performance tests
npm run test:performance

# Run snapshot tests
npm run test:snapshot
```

### Test Structure

```
src/
  __tests__/
    unit/            # Unit tests for individual components
    integration/     # Integration tests for component interactions
    performance/     # Performance benchmarks
    fixtures/        # Test fixtures and mock data
    helpers/         # Test utilities and helpers
```

### Testing Square Integration

For Square integration testing, mock services are provided:

```typescript
import { MockSquareClient } from 'jodit-react/testing';

// In your test
test('should update product with rich text', async () => {
  const mockClient = new MockSquareClient();
  mockClient.mockCatalogResponse({
    success: true,
    itemId: 'test-item-123'
  });
  
  // Test component with mock client
  // ...
});
```

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
   - Square Developer Account (for Square integration features)

2. **Clone the repository:**
   ```bash
   git clone https://github.com/TheScottyB/jodit-react-clone.git
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

1. Check the [existing issues](https://github.com/TheScottyB/jodit-react-clone/issues) on GitHub
2. Create a new issue if your problem hasn't been addressed
3. For usage questions, consider using [Stack Overflow](https://stackoverflow.com/questions/tagged/jodit-react) with the tag `jodit-react`
4. For Square-specific integration questions, refer to [Square Developer Documentation](https://developer.squareup.com/docs)

## Business Integration Examples

- E-commerce product description editors with Square Catalog integration
- Blog post authoring systems for small business websites
- Customer review management interfaces
- Email template creation tools for marketing campaigns
- Knowledge base and documentation systems
- Product catalog management for Square merchants
- Order detail customization interfaces
- Digital receipt and invoice template editors

By implementing this editor in your small business applications, you provide users with professional content creation capabilities without additional technical complexity.
