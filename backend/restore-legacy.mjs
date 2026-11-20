import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Keep the existing operator mail configuration and SDK out of the public game repository.
const config = JSON.parse(await readFile(new URL('./wrangler.jsonc', import.meta.url), 'utf8'));
const wrangler = process.argv[2];
let token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
    if (!wrangler) throw new Error('Pass the Wrangler CLI JavaScript path or set CLOUDFLARE_API_TOKEN.');
    const auth = execFileSync(process.execPath, [wrangler, 'auth', 'token', '--json'], { encoding: 'utf8' });
    token = JSON.parse(auth).token;
}
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/scripts/${config.name}`, {
    headers: { Authorization: 'Bearer ' + token }
});
if (!res.ok) throw new Error('Could not read the deployed Worker (' + res.status + ').');
const modules = await res.formData();
const legacy = modules.get('legacy.js') ?? modules.get('index.js');
if (!legacy) throw new Error('Could not find the legacy Worker module.');
const source = Buffer.from(typeof legacy === 'string' ? legacy : await legacy.arrayBuffer());
const checksum = createHash('sha256').update(source).digest('hex');
if (checksum !== '8ce820a7c338b8e8b2a12e57cac1592661b679b3a660d6d221e73c630a8ebe0c') {
    throw new Error('The deployed legacy module has changed. Review the new source before updating the pinned digest.');
}
await writeFile(new URL('./src/legacy.js', import.meta.url), source);
console.log('Restored the verified legacy Worker module.');
