#!/usr/bin/env bun
/**
 * NEXUS CLI Entry Point
 * Run with: bun run nexus-cli.ts <command>
 */

export { NexusCLI, main } from './nexus/cli/index';
export * from './nexus/cli/config';
export * from './nexus/cli/commands';
export * from './nexus/cli/build-node';

// Run main if called directly
import { main } from './nexus/cli/index';

if (import.meta.main) {
  main().then(code => process.exit(code));
}
