// PM2 process definition for the GymBro Node/Express backend.
//
// Usage (from this directory, backend/):
//   npm install
//   npm run build            # compile TS -> dist/server.js
//   pm2 start ecosystem.config.js
//   pm2 logs gymbro-backend
//   pm2 restart gymbro-backend
//   pm2 save                 # persist across reboots (with `pm2 startup`)
//
// Reads .env from this directory (dotenv is loaded inside server.ts).
// To also serve the built frontend, run `npm run build:full` before starting.

module.exports = {
  apps: [
    {
      name: 'gymbro-backend',
      cwd: __dirname,
      script: 'dist/server.js',
      instances: 1,          // MongoDB connection + in-memory state -> single instance
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        // PORT and secrets come from backend/.env (loaded by server.ts).
      },
    },
  ],
}
