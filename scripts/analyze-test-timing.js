/**
 * Test timing analyzer script for Jest
 * 
 * This script reads the JSON output from Jest and analyzes test execution times
 * to help identify slow tests that might need optimization.
 * 
 * Run with: node scripts/analyze-test-timing.js
 * Requires Jest to be run with: jest --json --outputFile=jest-results.json
 */

const fs = require('fs');
const path = require('path');

// Read the Jest results file
const resultsPath = path.join(__dirname, '..', 'jest-results.json');

try {
  const jsonResults = fs.readFileSync(resultsPath, 'utf8');
  const results = JSON.parse(jsonResults);
  
  // Extract test timing data
  const testData = [];
  
  results.testResults.forEach(testFile => {
    const fileName = path.relative(process.cwd(), testFile.name);
    
    testFile.assertionResults.forEach(test => {
      testData.push({
        fullName: test.fullName,
        fileName,
        duration: test.duration || 0,
      });
    });
  });
  
  // Sort by duration (slowest first)
  testData.sort((a, b) => b.duration - a.duration);
  
  // Output analysis
  console.log('=== TEST TIMING ANALYSIS ===');
  console.log('Total tests:', testData.length);
  console.log('Total test duration:', results.startTime ? (results.endTime - results.startTime) + 'ms' : 'unknown');
  console.log('\n');
  
  // Show top 10 slowest tests
  console.log('TOP 10 SLOWEST TESTS:');
  testData.slice(0, 10).forEach((test, index) => {
    console.log(`${index + 1}. [${test.duration.toFixed(2)}ms] ${test.fullName}`);
    console.log(`   File: ${test.fileName}`);
  });
  console.log('\n');
  
  // Calculate performance metrics
  const totalDuration = testData.reduce((sum, test) => sum + test.duration, 0);
  const avgDuration = totalDuration / testData.length;
  const medianDuration = testData[Math.floor(testData.length / 2)].duration;
  
  console.log('PERFORMANCE METRICS:');
  console.log(`Average test duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`Median test duration: ${medianDuration.toFixed(2)}ms`);
  console.log(`Slowest test: ${testData[0].duration.toFixed(2)}ms (${testData[0].fullName})`);
  console.log(`Fastest test: ${testData[testData.length - 1].duration.toFixed(2)}ms (${testData[testData.length - 1].fullName})`);
  
  // Generate performance distribution
  console.log('\nPERFORMANCE DISTRIBUTION:');
  const ranges = [
    [0, 10],
    [10, 50],
    [50, 100],
    [100, 500],
    [500, 1000],
    [1000, Infinity]
  ];
  
  ranges.forEach(([min, max]) => {
    const count = testData.filter(test => test.duration >= min && test.duration < max).length;
    const percentage = (count / testData.length * 100).toFixed(1);
    console.log(`${min}-${max === Infinity ? '∞' : max}ms: ${count} tests (${percentage}%)`);
  });
  
  // Highlight potentially problematic tests
  const slowThreshold = Math.max(100, avgDuration * 5);
  const slowTests = testData.filter(test => test.duration > slowThreshold);
  
  if (slowTests.length > 0) {
    console.log('\nPOTENTIALLY PROBLEMATIC TESTS:');
    console.log(`The following tests are significantly slower than average (>${slowThreshold.toFixed(0)}ms):`);
    slowTests.forEach(test => {
      console.log(`- [${test.duration.toFixed(2)}ms] ${test.fullName}`);
      console.log(`  File

