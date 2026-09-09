import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import next from 'next';

// Test runner only. Vercel continues to use its normal Next.js deployment.
const hostname = '127.0.0.1';
const port = 3100;
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer({
  pfx: Buffer.from(readFileSync(new URL('./fixtures/localhost.pfx.base64', import.meta.url), 'utf8'), 'base64'),
  passphrase: 'tates-tv-tests-only',
}, (request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.on('error', error => {
  console.error(error);
  process.exit(1);
});
server.listen(port, hostname, () => {
  console.log(`Test production server ready at https://${hostname}:${port}`);
});
