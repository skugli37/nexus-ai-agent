import { spawn } from 'child_process';
import { createServer } from 'http';

// Simple health check server
const healthServer = createServer((req, res) => {
  res.writeHead(200);
  res.end('NEXUS Web Service Running');
});

healthServer.listen(3001, () => {
  console.log('Health check on port 3001');
});

// Start Next.js
const nextProcess = spawn('bun', ['x', 'next', 'dev', '-p', '3000'], {
  cwd: '/home/z/my-project',
  stdio: 'inherit'
});

nextProcess.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
});

nextProcess.on('exit', (code) => {
  console.log('Next.js exited with code:', code);
  process.exit(code || 1);
});
