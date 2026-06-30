const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = Number(process.env.PORT || 3000);
const isWindows = process.platform === 'win32';

function isAllowedHost(host) {
  if (typeof host !== 'string') {
    return false;
  }

  const value = host.trim();
  if (!value || value.length > 255) {
    return false;
  }

  const hostRegex = /^[a-zA-Z0-9.-]+$/;
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  return hostRegex.test(value) || ipv4Regex.test(value);
}

function pingHost(host) {
  return new Promise((resolve, reject) => {
    const args = isWindows ? ['-n', '1', '-w', '1000', host] : ['-c', '1', '-W', '1', host];
    const child = spawn('ping', args, { windowsHide: true });

    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        resolve(false);
      }
    }, 2500);

    child.on('error', (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });

    child.on('close', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(code === 0);
      }
    });
  });
}

app.get('/api/ping', async (req, res) => {
  const host = String(req.query.host || '').trim();

  if (!isAllowedHost(host)) {
    res.status(400).json({ error: 'Invalid host parameter' });
    return;
  }

  try {
    const online = await pingHost(host);
    res.json({ online });
  } catch {
    res.status(500).json({ error: 'Ping failed' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist', 'devopswww', 'browser');
  app.use(express.static(distPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
