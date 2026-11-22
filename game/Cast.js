const base = (import.meta.env?.BASE_URL ?? './') + 'models/';
const models = new Map();
let loader;

async function modelBytes(file) {
    const response = await fetch(base + file);
    if (!response.ok && !(response.status === 0 && location.protocol === 'capacitor:')) {
        throw Error('Could not load ' + file);
    }
    return response.arrayBuffer();
}

async function unpack(file) {
    const bytes = await modelBytes(file);
    // A web server may already have decoded Content-Encoding. Native bundles serve the file directly.
    const header = new Uint8Array(bytes, 0, 2);
    if (header[0] !== 0x1f || header[1] !== 0x8b) return bytes;
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
}

function loadModel(name) {
    if (!models.has(name)) {
        const outfit = name.startsWith('outfits/');
        const packed = outfit ? name + '.glb.gz' : 'street/' + name + '.glb.gz';
        loader ??= import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader());
        const parse = bytes => Promise.all([loader, bytes]).then(([parser, buffer]) => parser.parseAsync(buffer, base));
        const original = () => outfit ? loadModel('apparel')
            : parse(modelBytes(name === 'apparel' ? 'apparel.glb?v=241' : name + '.glb'));
        const asset = name !== 'apparel' && typeof DecompressionStream !== 'undefined' && Blob.prototype.stream
            ? parse(unpack(packed)).catch(original)
            : original();
        models.set(name, asset.catch(error => { models.delete(name); throw error; }));
    }
    return models.get(name);
}

export function loadOutfit(id) {
    const edition = { rebel: '232', worker: '241' }[id] ?? '231';
    return id === 'default' ? null : loadModel('outfits/' + edition + '/' + id);
}

export async function loadMayor() {
    const [mayor, apparel] = await Promise.all([loadModel('mayor'), loadOutfit('wearables')]);
    mayor.apparel = apparel.scene;
    return mayor;
}

export async function loadCast() {
    const [mayor, chaser, commuter, newYorker] = await Promise.all([
        loadMayor(), loadModel('chaser'), loadModel('commuter'), loadModel('new-yorker')
    ]);
    return { mayor, chaser, commuter, 'new-yorker': newYorker };
}
