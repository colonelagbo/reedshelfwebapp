import { spawn } from 'child_process';
import http from 'http';

function isPortActive(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (_res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function start() {
  console.log('🌱 Starting ReedShelf Full-Stack Development Environment...');

  const serverAlreadyRunning = await isPortActive(5000);

  if (!serverAlreadyRunning) {
    console.log('📡 Starting Backend API Server (Port 5000)...');
    const serverProc = spawn('node', ['--watch', 'server/src/index.js'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: '5000' }
    });

    process.on('SIGINT', () => serverProc.kill('SIGINT'));
    process.on('SIGTERM', () => serverProc.kill('SIGTERM'));
  } else {
    console.log('📡 Backend API Server is already active on Port 5000.');
  }

  console.log('⚡ Starting Frontend Vite Server (Port 5173)...');
  const viteProc = spawn('npx', ['vite'], {
    stdio: 'inherit'
  });

  process.on('SIGINT', () => {
    viteProc.kill('SIGINT');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    viteProc.kill('SIGTERM');
    process.exit(0);
  });
}

start();
