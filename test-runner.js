#!/usr/bin/env node

/**
 * Test Runner Script for Chief of Staff Application
 * 
 * This script runs comprehensive Playwright tests covering:
 * - Authentication flows
 * - Daily standup functionality
 * - AI integration (Gemini)
 * - Voice input capabilities
 * - API endpoints
 * - Database operations
 * - Performance metrics
 * - Error handling
 * - Security validation
 * - Edge cases and stress tests
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Chief of Staff - Comprehensive Test Suite');
console.log('==========================================\n');

const testSuites = [
  {
    name: 'Critical User Flows',
    file: 'critical-flows.spec.ts',
    description: 'Tests core user journeys: auth, standup, checklist generation'
  },
  {
    name: 'API Integration',
    file: 'api-integration.spec.ts', 
    description: 'Tests Gemini AI integration and API endpoints'
  },
  {
    name: 'Performance & Security',
    file: 'database-performance.spec.ts',
    description: 'Tests database operations, performance, and security'
  },
  {
    name: 'Edge Cases',
    file: 'edge-cases.spec.ts',
    description: 'Tests error handling, data validation, and stress scenarios'
  }
];

async function runTests() {
  console.log('📋 Test Suites to Execute:');
  testSuites.forEach((suite, index) => {
    console.log(`  ${index + 1}. ${suite.name}`);
    console.log(`     ${suite.description}\n`);
  });

  const startTime = Date.now();

  try {
    // Run all tests
    console.log('🔄 Running comprehensive test suite...\n');
    
    execSync('npx playwright test --reporter=list --reporter=html', {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    const duration = Date.now() - startTime;
    
    console.log('\n✅ All tests completed successfully!');
    console.log(`⏱️  Total execution time: ${Math.round(duration / 1000)}s`);
    console.log('\n📊 View detailed test report:');
    console.log('   npx playwright show-report');
    
  } catch (error) {
    console.error('\n❌ Some tests failed. Check the report for details.');
    console.log('\n📊 View test report for failure analysis:');
    console.log('   npx playwright show-report');
    process.exit(1);
  }
}

// Check if we're running in CI or with specific arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node test-runner.js [options]\n');
  console.log('Options:');
  console.log('  --critical    Run only critical user flow tests');
  console.log('  --api         Run only API integration tests');
  console.log('  --performance Run only performance and security tests');
  console.log('  --edge        Run only edge case tests');
  console.log('  --headed      Run tests in headed browser mode');
  console.log('  --debug       Run tests in debug mode');
  console.log('  --help, -h    Show this help message');
  process.exit(0);
}

runTests();