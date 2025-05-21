#!/usr/bin/env node

/**
 * Test runner script for organizing and running tests efficiently
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration with fixed test patterns
const config = {
  testTypes: {
    unit: {
      patterns: '<rootDir>/src/**/__tests__/unit/**/*.(test|spec).(ts|tsx)',
      coverage: true,
      timeout: 10000
    },
    integration: {
      patterns: '<rootDir>/src/**/__tests__/integration/**/*.(test|spec).(ts|tsx)',
      coverage: true,
      timeout: 30000
    },
    performance: {
      patterns: '<rootDir>/src/**/__tests__/performance/**/*.(test|spec).(ts|tsx)',
      coverage: false,
      timeout: 60000
    },
    snapshot: {
      patterns: '<rootDir>/src/**/__tests__/**/*.snapshot.test.(ts|tsx)',
      coverage: false,
      timeout: 10000
    }
  },
  coverageThreshold: 80,
  maxWorkers: '50%'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  updateSnapshots: args.includes('--update'),
  coverage: !args.includes('--no-coverage'),
  watch: args.includes('--watch'),
  verbose: args.includes('--verbose'),
  ci: args.includes('--ci'),
  bail: args.includes('--bail'),
  debug: args.includes('--debug'),
  testTypes: args.filter(arg => !arg.startsWith('--')).length > 0 
    ? args.filter(arg => !arg.startsWith('--'))
    : Object.keys(config.testTypes)
};

/**
 * Format and enhance error output
 */
function formatError(error, testType) {
  let output = [`\nTest Failure in ${testType} tests`, '-'.repeat(40), ''];
  
  if (error.status) {
    output.push(`Exit Code: ${error.status}`);
  }
  
  if (error.stderr) {
    output.push('Error Output:', error.stderr.trim());
  }
  
  if (error.stdout) {
    const stdout = error.stdout.trim();
    if (stdout) {
      output.push('Test Output:', stdout);
    }
  }
  
  // Extract Jest failure messages
  const failureMatches = error.stdout?.match(/FAIL.*\n.*\n(\s+●.*(\n\s+.*)*)+/g) || [];
  if (failureMatches.length > 0) {
    output.push('\nTest Failures:', ...failureMatches);
  }
  
  return output.join('\n');
}

/**
 * Run Jest with specified configuration
 */
function runJest(testType) {
  const testConfig = config.testTypes[testType];
  console.log(`\nRunning ${testType} tests...`);

  // Create config file for this run
  const configPath = path.join(process.cwd(), `jest.${testType}.config.js`);
  
  try {
    // Get base config
    const baseConfigPath = path.join(process.cwd(), 'jest.config.js');
    const baseConfig = require(baseConfigPath);
    
    // Create custom config
    const jestConfig = {
      ...baseConfig,
      testMatch: [testConfig.patterns],
      testTimeout: testConfig.timeout,
      maxWorkers: config.maxWorkers,
      silent: !options.verbose,
      verbose: options.verbose
    };

    if (testConfig.coverage && options.coverage) {
      jestConfig.collectCoverage = true;
      jestConfig.coverageDirectory = `coverage/${testType}`;
    }

    // Write temporary config
    fs.writeFileSync(
      configPath,
      `module.exports = ${JSON.stringify(jestConfig, null, 2)}`
    );

    const args = [
      'jest',
      `--config=${configPath}`,
      '--colors'
    ];

    if (options.updateSnapshots) args.push('--updateSnapshot');
    if (options.watch) args.push('--watch');
    if (options.ci) args.push('--ci', '--runInBand');
    if (options.bail) args.push('--bail');

    if (options.debug) {
      console.log('Running command:', 'npx', args.join(' '));
      console.log('Test pattern:', testConfig.patterns);
    }

    const result = spawnSync('npx', args, { 
      stdio: options.debug ? 'inherit' : 'pipe',
      encoding: 'utf-8'
    });

    // Cleanup config file
    try {
      fs.unlinkSync(configPath);
    } catch (err) {
      if (options.debug) {
        console.error('Warning: Could not clean up temporary config file:', err.message);
      }
    }

    if (result.status !== 0 && !options.debug) {
      console.error(formatError(result, testType));
    }

    return result.status === 0;
  } catch (err) {
    console.error(`\nError setting up tests for ${testType}:`, err.message);
    if (options.debug) {
      console.error(err);
    }
    
    // Cleanup config file if it exists
    try {
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    } catch (cleanupErr) {
      if (options.debug) {
        console.error('Warning: Could not clean up temporary config file:', cleanupErr.message);
      }
    }
    
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  let success = true;
  const failedTests = [];
  const startTime = Date.now();

  try {
    // Run each test type
    for (const testType of options.testTypes) {
      if (!config.testTypes[testType]) {
        throw new Error(`Unknown test type: ${testType}`);
      }

      const testSuccess = runJest(testType);
      if (!testSuccess) {
        success = false;
        failedTests.push(testType);
        if (options.bail || options.ci) {
          break; // Stop on first failure in CI or bail mode
        }
      }
    }

    // Print summary if not in watch mode
    if (!options.watch) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\nTest Summary');
      console.log('-'.repeat(40));
      console.log(`Duration: ${duration}s`);
      console.log(`Status: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
      
      if (failedTests.length > 0) {
        console.log(`Failed Tests: ${failedTests.join(', ')}`);
      }

      if (options.coverage) {
        try {
          const coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');
          const coverage = require(coveragePath);
          const totalCoverage = coverage.total.lines.pct;
          
          console.log(`\nCoverage Summary`);
          console.log('-'.repeat(40));
          console.log(`Total Coverage: ${totalCoverage}%`);
          
          // Show detailed coverage breakdown
          console.log('\nCoverage by Category:');
          Object.entries(coverage.total).forEach(([category, data]) => {
            console.log(`  ${category}: ${data.pct}%`);
          });
          
          if (totalCoverage < config.coverageThreshold) {
            console.log(`\n⚠️  Warning: Coverage ${totalCoverage}% is below threshold ${config.coverageThreshold}%`);
            if (options.ci) {
              success = false;
            }
          }
        } catch (error) {
          console.log('\n⚠️  Warning: Could not read coverage report');
          if (options.debug) {
            console.error('Coverage Error:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Error running tests:', error.message);
    if (options.debug) {
      console.error('\nDebug Information:');
      console.error(error);
    }
    process.exit(1);
  }

  // Write summary to file if in CI mode
  if (options.ci) {
    try {
      const summary = {
        success,
        duration: ((Date.now() - startTime) / 1000).toFixed(2),
        failedTests,
        timestamp: new Date().toISOString(),
        coverage: undefined
      };

      // Try to add coverage data if available
      try {
        const coveragePath = path.join(process.cwd(), 'coverage/coverage-summary.json');
        const coverage = require(coveragePath);
        summary.coverage = coverage.total.lines.pct;
      } catch (error) {
        // Coverage data not available
      }

      fs.writeFileSync(
        'test-summary.json',
        JSON.stringify(summary, null, 2)
      );
    } catch (error) {
      console.error('\nWarning: Could not write test summary file:', error.message);
    }
  }

  process.exit(success ? 0 : 1);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  if (options.debug) {
    console.error('\nStack trace:', error.stack);
  }
  process.exit(1);
});
