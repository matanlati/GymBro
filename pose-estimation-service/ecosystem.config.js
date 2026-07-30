// PM2 process definition for the pose-estimation FastAPI service, run via uv.
//
// Usage (from this directory, pose-estimation-service/):
//   uv sync                       # install deps into .venv (first time / after changes)
//   pm2 start ecosystem.config.js
//   pm2 logs pose-estimation
//   pm2 restart pose-estimation
//   pm2 save                      # persist across reboots (with `pm2 startup`)
//
// `uv run` executes uvicorn inside the project's virtualenv. PM2 supervises the
// uvicorn process. Use --workers > 1 for concurrency; keep 1 if the model/state
// must be per-process.
//
// If PM2 fails with "uv: not found" (common under sudo, whose PATH differs from
// your login shell), either set `script` to uv's absolute path — `which uv`,
// often ~/.local/bin/uv — or point it straight at '.venv/bin/uvicorn' and drop
// the leading 'run','uvicorn' entries from args.

module.exports = {
  apps: [
    {
      name: 'pose-estimation',
      // Absolute path recommended in production; PM2 resolves cwd for relative runs.
      cwd: __dirname,
      script: 'uv',
      args: [
        'run',
        'uvicorn',
        'src.main:app',
        '--host', '0.0.0.0',
        '--port', '8000',
        '--workers', '1',
      ],
      interpreter: 'none', // run `uv` directly, not through node
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      // uvicorn already logs to stdout/stderr; PM2 captures both.
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
}
