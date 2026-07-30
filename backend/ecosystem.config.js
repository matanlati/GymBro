module.exports = {
  apps: [
    {
      name: 'gymbro',
      script: 'dist/src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
      },
      time: true,
    },
  ],
}
