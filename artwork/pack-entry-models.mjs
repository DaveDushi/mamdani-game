// Offline art tool. Install @gltf-transform/{core,extensions,functions} 4.5.1 to rebuild
// these files after editing the canonical GLBs. The game needs no art-tool dependencies.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const models = new URL('../public/models/', import.meta.url);
const street = new URL('street/', models);
await mkdir(street, { recursive: true });

for (const name of ['mayor', 'chaser', 'commuter', 'new-yorker']) {
    const original = await readFile(new URL(name + '.glb', models));
    await writeFile(new URL(name + '.glb.gz', street), gzipSync(original, { level: 9 }));
}

const io = new NodeIO().registerExtensions([EXTTextureWebP]);
const apparel = await readFile(new URL('apparel.glb', models));
for (const id of ['wearables', 'rebel', 'worker', 'activist', 'imam']) {
    const edition = { rebel: '232', worker: '241' }[id] ?? '231';
    const outfits = new URL('outfits/' + edition + '/', models);
    await mkdir(outfits, { recursive: true });
    const document = await io.readBinary(apparel);
    for (const node of document.getRoot().listNodes()) {
        if (!node.getMesh()) continue;
        const name = node.getName();
        const costume = /^(Suit|Head)_/.test(name);
        const keep = id === 'wearables' ? !costume : costume && name.endsWith('_' + id);
        if (!keep) node.dispose();
    }
    await document.transform(prune({ keepSolidTextures: true, keepAttributes: true }));
    const bytes = await io.writeBinary(document);
    await writeFile(new URL(id + '.glb.gz', outfits), gzipSync(bytes, { level: 9 }));
}
