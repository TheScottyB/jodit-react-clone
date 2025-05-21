/**
 * Jest configuration for Spocket-Square integration and React components
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.ts',
    '<rootDir>/src/__tests__/setup/index.ts'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }],
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-react'
      ]
    }]
  },
  // Important for ESM modules - allow specific modules to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|bottleneck|jodit)/)'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{ts,tsx}'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/setupTests.ts',
    '!src/**/__tests__/**/*',
    '!src/**/__mocks__/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 30, // Lowered for initial development
      branches: 25,
      functions: 30,
      lines: 30
    },
    './src/components/**/*.{ts,tsx}': {
      statements: 40,
      branches: 35,
      functions: 40,
      lines: 40
    },
    './src/services/**/*.{ts,tsx}': {
      statements: 35,
      branches: 30,
      functions: 35,
      lines: 35
    }
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__fixtures__/'
  ],
  verbose: true,
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: {
        jsx: 'react'
      }
    }
  },
  maxWorkers: '50%',
  testTimeout: 10000,
  // Remove retry option as it's causing issues
  // retry: 2,
  // Group tests by type
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/unit/**/*.{ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.ts',
        '<rootDir>/src/__tests__/setup/index.ts'
      ]
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/__tests__/integration/**/*.{ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.ts',
        '<rootDir>/src/__tests__/setup/index.ts'
      ],
      testTimeout: 30000
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/**/__tests__/performance/**/*.{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/src/setupTests.ts',
        '<rootDir>/src/__tests__/setup/index.ts'
      ],
      testTimeout: 60000
    }
  ]
};
