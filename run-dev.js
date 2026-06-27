const { spawn } = require('child_process');

// If this is the recursive invocation from within Vercel Dev, bypass it.
if (process.env.VERCEL_DEV_RUNNING) {
  console.log('Detected Vercel Dev subprocess. Skipping recursion.');
  process.exit(0);
}

process.env.VERCEL_DEV_RUNNING = '1';

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';

console.log('Starting Vercel Dev...');
const child = spawn(cmd, ['vercel', 'dev', '--local', '--yes'], {
  stdio: 'inherit',
  shell: isWindows
});

child.on('close', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('Failed to start Vercel Dev:', err);
  process.exit(1);
});
