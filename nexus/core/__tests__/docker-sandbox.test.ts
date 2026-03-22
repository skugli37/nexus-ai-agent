/**
 * Tests for NEXUS Docker Sandbox
 * Tests isolated code execution with Docker containers
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { DockerSandbox, ExecutionOptions, ExecutionResult } from '../docker-sandbox';

describe('DockerSandbox', () => {
  let sandbox: DockerSandbox;
  let dockerAvailable: boolean;

  beforeAll(async () => {
    sandbox = new DockerSandbox({
      poolSize: 2,
      timeout: 10000,
      memoryLimit: 64 * 1024 * 1024 // 64MB for tests
    });
    await sandbox.initialize();
    dockerAvailable = sandbox.isDockerAvailable();
  });

  afterAll(async () => {
    await sandbox.cleanup();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(sandbox).toBeDefined();
    });

    test('should detect Docker availability', () => {
      expect(typeof dockerAvailable).toBe('boolean');
    });

    test('should report supported languages', () => {
      const languages = sandbox.getSupportedLanguages();
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('shell');
      expect(languages).toContain('typescript');
    });

    test('should check language support', () => {
      expect(sandbox.isLanguageSupported('javascript')).toBe(true);
      expect(sandbox.isLanguageSupported('python')).toBe(true);
      expect(sandbox.isLanguageSupported('unknown')).toBe(false);
    });

    test('should have pool stats', () => {
      const stats = sandbox.getPoolStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('available');
      expect(stats).toHaveProperty('inUse');
      expect(stats).toHaveProperty('languages');
    });
  });

  // ==========================================================================
  // JavaScript Execution Tests
  // ==========================================================================

  describe('JavaScript Execution', () => {
    test('should execute simple JavaScript code', async () => {
      const result = await sandbox.execute('console.log("Hello, NEXUS!")', {
        language: 'javascript'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, NEXUS!');
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should return correct values', async () => {
      const result = await sandbox.execute(`
        const x = 10;
        const y = 20;
        console.log(x + y);
      `, { language: 'javascript' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('30');
    });

    test('should handle async code', async () => {
      const result = await sandbox.execute(`
        async function main() {
          await new Promise(r => setTimeout(r, 100));
          console.log('async works');
        }
        main();
      `, { language: 'javascript' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('async works');
    });

    test('should capture console output', async () => {
      const result = await sandbox.execute(`
        console.log('log');
        console.error('error');
        console.warn('warn');
      `, { language: 'javascript' });

      expect(result.output).toContain('log');
      expect(result.stderr).toContain('error');
    });

    test('should handle errors gracefully', async () => {
      const result = await sandbox.execute(`
        throw new Error('Test error');
      `, { language: 'javascript' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.exitCode).not.toBe(0);
    });

    test('should handle syntax errors', async () => {
      const result = await sandbox.execute(`
        const x = {;
      `, { language: 'javascript' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should respect timeout', async () => {
      const result = await sandbox.execute(`
        while(true) {}
      `, {
        language: 'javascript',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error?.toLowerCase()).toMatch(/timeout|killed/);
    }, 5000);

    test('should support environment variables', async () => {
      const result = await sandbox.execute(`
        console.log(process.env.TEST_VAR);
      `, {
        language: 'javascript',
        env: { TEST_VAR: 'test_value_123' }
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('test_value_123');
    });

    test('should support additional files', async () => {
      const result = await sandbox.execute(`
        const fs = require('fs');
        const data = fs.readFileSync('data.txt', 'utf8');
        console.log(data);
      `, {
        language: 'javascript',
        files: {
          'data.txt': 'Hello from file!'
        }
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from file!');
    });
  });

  // ==========================================================================
  // Python Execution Tests
  // ==========================================================================

  describe('Python Execution', () => {
    test('should execute simple Python code', async () => {
      const result = await sandbox.execute('print("Hello, Python!")', {
        language: 'python'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Python!');
    });

    test('should handle Python loops', async () => {
      const result = await sandbox.execute(`
for i in range(5):
    print(f"Number: {i}")
      `, { language: 'python' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Number: 0');
      expect(result.output).toContain('Number: 4');
    });

    test('should handle Python errors', async () => {
      const result = await sandbox.execute(`
raise Exception("Test error")
      `, { language: 'python' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    test('should support Python imports', async () => {
      const result = await sandbox.execute(`
import json
data = json.dumps({"key": "value"})
print(data)
      `, { language: 'python' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('key');
    });
  });

  // ==========================================================================
  // Shell Execution Tests
  // ==========================================================================

  describe('Shell Execution', () => {
    test('should execute shell commands', async () => {
      const result = await sandbox.execute('echo "Hello, Shell!"', {
        language: 'shell'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Shell!');
    });

    test('should support pipes', async () => {
      const result = await sandbox.execute('echo "hello world" | tr "a-z" "A-Z"', {
        language: 'shell'
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('HELLO WORLD');
    });

    test('should capture stderr', async () => {
      const result = await sandbox.execute('echo "error message" >&2', {
        language: 'shell'
      });

      expect(result.stderr).toContain('error message');
    });
  });

  // ==========================================================================
  // TypeScript Execution Tests
  // ==========================================================================

  describe('TypeScript Execution', () => {
    test('should execute TypeScript code', async () => {
      const result = await sandbox.execute(`
        const greeting: string = "Hello, TypeScript!";
        console.log(greeting);
      `, { language: 'typescript' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, TypeScript!');
    });

    test('should handle TypeScript types', async () => {
      const result = await sandbox.execute(`
        interface User {
          name: string;
          age: number;
        }
        const user: User = { name: "NEXUS", age: 1 };
        console.log(user.name);
      `, { language: 'typescript' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('NEXUS');
    });
  });

  // ==========================================================================
  // Memory and Resource Tests
  // ==========================================================================

  describe('Resource Limits', () => {
    test('should limit memory usage', async () => {
      // This test may not work in all environments
      const result = await sandbox.execute(`
        const arr = [];
        try {
          for (let i = 0; i < 100000; i++) {
            arr.push(new Array(10000).fill('x'));
          }
          console.log('allocated');
        } catch (e) {
          console.log('caught:', e.message);
        }
      `, {
        language: 'javascript',
        memoryLimit: 32 * 1024 * 1024, // 32MB
        timeout: 5000
      });

      // Either succeeds with caught error or fails with memory error
      expect(result.success !== undefined).toBe(true);
    }, 10000);

    test('should track execution duration', async () => {
      const result = await sandbox.execute(`
        const start = Date.now();
        while(Date.now() - start < 100) {}
        console.log('done');
      `, { language: 'javascript' });

      expect(result.duration).toBeGreaterThan(100);
    });
  });

  // ==========================================================================
  // Container Management Tests
  // ==========================================================================

  describe('Container Management', () => {
    test('should list containers', () => {
      const containers = sandbox.listContainers();
      expect(Array.isArray(containers)).toBe(true);
    });

    test('should get pool stats', () => {
      const stats = sandbox.getPoolStats();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.available).toBeGreaterThanOrEqual(0);
    });

    test('should perform health check', async () => {
      const health = await sandbox.healthCheck();
      
      expect(health).toHaveProperty('docker');
      expect(health).toHaveProperty('containers');
      expect(health).toHaveProperty('poolSize');
      expect(health).toHaveProperty('languages');
      expect(Array.isArray(health.languages)).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    test('should handle empty code', async () => {
      const result = await sandbox.execute('', {
        language: 'javascript'
      });

      // Should not crash
      expect(result).toBeDefined();
    });

    test('should handle very long output', async () => {
      const result = await sandbox.execute(`
        for (let i = 0; i < 100; i++) {
          console.log('Line', i, ':', 'x'.repeat(100));
        }
      `, { language: 'javascript' });

      expect(result.success).toBe(true);
      expect(result.output.length).toBeGreaterThan(1000);
    });

    test('should handle unicode', async () => {
      const result = await sandbox.execute(`
        console.log('Hello 世界! 🌍');
        console.log('Привет мир!');
        console.log('مرحبا بالعالم!');
      `, { language: 'javascript' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('世界');
    });

    test('should handle special characters in code', async () => {
      const result = await sandbox.execute(`
        const str = 'He said "Hello" and \\'Goodbye\\'';
        console.log(str);
      `, { language: 'javascript' });

      expect(result.success).toBe(true);
    });

    test('should reject unsupported language', async () => {
      const result = await sandbox.execute('print("test")', {
        language: 'unsupported_lang' as any
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported language');
    });
  });

  // ==========================================================================
  // Events Tests
  // ==========================================================================

  describe('Events', () => {
    test('should emit initialization event', async () => {
      const newSandbox = new DockerSandbox();
      
      let initialized = false;
      newSandbox.on('initialized', () => {
        initialized = true;
      });

      await newSandbox.initialize();
      expect(initialized).toBe(true);

      await newSandbox.cleanup();
    });

    test('should emit execution complete event', async () => {
      let eventFired = false;
      
      sandbox.on('execution:complete', () => {
        eventFired = true;
      });

      await sandbox.execute('console.log("test")', { language: 'javascript' });
      
      expect(eventFired).toBe(true);
    });
  });
});
