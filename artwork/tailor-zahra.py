"""Fit Zahra's jacket and long hair. Input is the canonical pre-2.3.2 apparel GLB.
Uses NumPy and SciPy. The donor is the licensed Rocketbox hair in the shipped Tiffany mesh.
Run: python artwork/tailor-zahra.py path/to/original-apparel.glb public/models/apparel.glb
Then rebuild the compact wardrobe with artwork/pack-entry-models.mjs.
"""
import argparse
import json
import struct
from pathlib import Path

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.spatial.transform import Rotation


class Model:
    def __init__(self, path):
        data = Path(path).read_bytes()
        size = int.from_bytes(data[12:16], 'little')
        self.g = json.loads(data[20:20 + size])
        self.data = bytearray(data[28 + size:])

    def view(self, index):
        section = self.g['bufferViews'][index]
        start = section.get('byteOffset', 0)
        return self.data[start:start + section['byteLength']]

    def array(self, index, normalized=True):
        a = self.g['accessors'][index]
        v = self.g['bufferViews'][a['bufferView']]
        dtype = np.dtype({5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        array = np.ndarray((a['count'], width), dtype, self.data, offset, (v.get('byteStride', width * dtype.itemsize), dtype.itemsize))
        if normalized and a.get('normalized'):
            return np.maximum(-1, array / np.iinfo(dtype).max)
        return array

    def add(self, table, item):
        self.g[table].append(item)
        return len(self.g[table]) - 1

    def add_view(self, payload):
        self.data.extend(b'\0' * (-len(self.data) % 4))
        view = self.add('bufferViews', dict(buffer=0, byteOffset=len(self.data), byteLength=len(payload)))
        self.data.extend(payload)
        return view

    def attr(self, value, gl_type, width, bounds=False):
        dtype = {5121: 'u1', 5123: '<u2', 5126: '<f4'}[gl_type]
        a = np.ascontiguousarray(value, dtype=dtype)
        accessor = dict(bufferView=self.add_view(a.tobytes()), count=len(a), componentType=gl_type, type=width)
        if bounds:
            accessor.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
        return self.add('accessors', accessor)

    def node(self, name):
        return next(node for node in self.g['nodes'] if node.get('name') == name)

    def save(self, path):
        self.g['buffers'][0]['byteLength'] = len(self.data)
        header = json.dumps(self.g, separators=(',', ':')).encode()
        header += b' ' * (-len(header) % 4)
        self.data.extend(b'\0' * (-len(self.data) % 4))
        size = 28 + len(header) + len(self.data)
        Path(path).write_bytes(struct.pack('<4sIII4s', b'glTF', 2, size, len(header), b'JSON') + header
                               + struct.pack('<I4s', len(self.data), b'BIN\0') + self.data)


def smooth(x):
    t = np.clip(x, 0, 1)
    return t * t * (3 - 2 * t)


def jacket(xyz):
    x, y, z = xyz.T
    waist = np.exp(-((y - 1.106) / .125) ** 2)
    bust = np.exp(-((y - 1.343) / .099) ** 2)
    front = smooth((z + .012) / .10)
    princess = np.exp(-((abs(x) - .090) / .092) ** 2)
    shape = xyz.copy()
    shape[:, 0] *= 1 - .175 * waist + .050 * bust + .045 * np.exp(-((y - .944) / .092) ** 2)
    shape[:, 2] += front * (.090 * bust * (.39 + .61 * princess) - .022 * waist)
    shape[:, 2] -= .004 * waist * smooth(-z / .09)
    return shape


def normals(xyz, triangles):
    edges = xyz[triangles]
    face = np.cross(edges[:, 1] - edges[:, 0], edges[:, 2] - edges[:, 0])
    normal = np.zeros_like(xyz)
    for i in range(3):
        np.add.at(normal, triangles[:, i], face)
    return normal / np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)


def subdivide_facing(model, part, levels):
    attrs = {k: model.array(i).copy() for k,i in part['attributes'].items()}
    tri = model.array(part['indices']).reshape(-1, 3).copy()
    # A long tie and rolled lapels need vertices between their original sewing-pattern rows.
    for _ in range(levels):
        edges = np.stack([tri[:,[0,1]], tri[:,[1,2]], tri[:,[2,0]]], axis=1)
        pair, inverse = np.unique(np.sort(edges.reshape(-1, 2), axis=1), axis=0, return_inverse=True)
        m = inverse.reshape(-1,3) + len(attrs['POSITION'])
        for k in ['POSITION','NORMAL','TEXCOORD_0']:
            attrs[k] = np.concatenate([attrs[k], attrs[k][pair].mean(axis=1)])
        # Blends are assigned by physical height, using the same seam weights as the coat shell.
        y = attrs['POSITION'][:,1]
        joints = np.zeros((len(y),4), dtype='u1')
        weights = np.zeros((len(y),4))
        stops = [.90,1.10,1.26,1.45]
        bones = [0,1,10,11]
        for j,(lo,hi) in enumerate(zip(stops,stops[1:])):
            keep = (y>=lo)&(y<=hi)
            f = (y[keep]-lo)/(hi-lo)
            joints[keep,:2] = bones[j:j+2]
            weights[keep,:2] = np.stack([1-f,f], axis=1)
        joints[y>1.45,0], weights[y>1.45,0] = 11,1
        joints[y<.90,0], weights[y<.90,0] = 0,1
        attrs['JOINTS_0'], attrs['WEIGHTS_0'] = joints,weights
        a,b,c = tri.T
        ab,bc,ca = m.T
        tri = np.concatenate([np.stack(t,axis=1) for t in [(a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca)]])
    attrs['POSITION'][:,2] += .005
    for name,value in attrs.items():
        spec = model.g['accessors'][part['attributes'][name]]
        part['attributes'][name] = model.attr(value,spec['componentType'],spec['type'],name=='POSITION')
    part['indices'] = model.attr(tri.ravel(),5123,'SCALAR')


def tailor(model):
    mesh = model.g['meshes'][model.node('Suit_rebel')['mesh']]
    for part in mesh['primitives']:
        material = model.g['materials'][part['material']]['name']
        if material == 'Zahra sleeve trouser boot atlas':
            continue
        if material in ('Blue worsted lapels','Ocean blue silk tie'):
            subdivide_facing(model, part, 2 if material == 'Ocean blue silk tie' else 1)
        pos_id, normal_id = (part['attributes'][key] for key in ('POSITION', 'NORMAL'))
        xyz = model.array(pos_id).astype(float)
        normal = model.array(normal_id).astype(float)
        new = jacket(xyz)
        if material == 'Rose pink satin sash':
            # The facing and tie stand proud of the shell. Bind the ribbon outside both layers.
            new[:,2] += .015 * smooth((xyz[:,2] - .045) / .065)
            new[:,0] += .003 * np.sign(xyz[:,0]) * smooth(abs(xyz[:,0]) / .16)
        # Inverse transpose preserves seams, satin folds, and the original authored shading.
        h = .00005
        axes = np.eye(3) * h
        gradient = np.stack([(jacket(xyz + dx) - jacket(xyz - dx)) / (2 * h) for dx in axes], axis=2)
        normal = np.linalg.solve(gradient.transpose(0, 2, 1), normal[..., None])[..., 0]
        model.array(normal_id)[:] = normal / np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
        model.array(pos_id)[:] = new
        model.g['accessors'][pos_id].update(min=new.min(0).tolist(), max=new.max(0).tolist())


def rest_worlds(model):
    result = {}
    def visit(i, parent):
        node = model.g['nodes'][i]
        transform = np.eye(4)
        transform[:3, :3] = Rotation.from_quat(node.get('rotation', [0, 0, 0, 1])).as_matrix() @ np.diag(node.get('scale', [1, 1, 1]))
        transform[:3, 3] = node.get('translation', [0, 0, 0])
        result[i] = parent @ transform
        for child in node.get('children', []):
            visit(child, result[i])
    for i in model.g['scenes'][0]['nodes']:
        visit(i, np.eye(4))
    return result


def loose_strands(donor):
    node = donor.node('Hair')
    primitive = donor.g['meshes'][node['mesh']]['primitives'][0]
    a = primitive['attributes']
    skin = donor.g['skins'][node['skin']]
    # Quantized positions carry their scale/offset in the inverse bind matrix.
    bind = rest_worlds(donor)[skin['joints'][13]] @ donor.array(skin['inverseBindMatrices'])[13].reshape(4, 4).T
    xyz = donor.array(a['POSITION']) @ bind[:3, :3].T + bind[:3, 3]
    uv = donor.array(a['TEXCOORD_0'])
    tri = donor.array(primitive['indices']).reshape(-1, 3)
    c = xyz[tri].mean(axis=1)
    # The four cards across the eyes are eyelashes and stay with the donor.
    keep = c[:, 2] < .037
    selected, indices = np.unique(tri[keep], return_inverse=True)
    p = xyz[selected].copy()
    drop = smooth((1.617 - p[:, 1]) / .37)
    p[:, 0] = (p[:, 0] - .003) * (1.08 - .05 * drop)
    p[:, 2] += .080 - .056 * drop
    p[:, 1] += .115 - .170 * drop
    return p, uv[selected], indices.reshape(-1, 3), primitive['material']


def front_lock(side):
    # Curves sit against the outside of the temples and fall forward over the shoulders.
    path = np.array([[.011,1.837,.025], [.051,1.824,.076], [.085,1.783,.088], [.105,1.712,.076],
                     [.112,1.645,.056], [.116,1.585,.066], [.131,1.531,.104], [.148,1.483,.137],
                     [.147,1.428,.169], [.133,1.385,.202], [.136,1.350,.207]])
    if side < 0:
        path[:, 2] -= np.linspace(0, .041, len(path))
        path[-3:, 1] += [.021,.039,.054]
    path[:, 0] *= side
    center = PchipInterpolator(np.linspace(0, 1, len(path)), path)
    pos, uv, indices = [], [], []
    cols, rows = 9, 24
    for j in range(rows + 1):
        t = j / rows
        c = center(t)
        tangent = center.derivative()(t)
        tangent /= np.linalg.norm(tangent)
        across = np.array([1.,0.,0.]) - tangent[0] * tangent
        across /= np.linalg.norm(across)
        out = np.cross(tangent, across)
        width = .0285 * (.16 + .84 * smooth(t / .12)) * (1 - .52 * t) * max(.035, 1 - smooth((t - .68) / .34))
        for k in range(cols + 1):
            a = 2 * np.pi * k / cols
            ripple = .95 + .065 * np.sin(3 * a + 2 * t)
            pos.append(c + width * ripple * (np.cos(a)*across + .44*np.sin(a)*out))
            uv.append([.11 + .18*(k/cols) + (.33 if side<0 else 0), .01 + .97*t])
            if j < rows and k < cols:
                i = j * (cols + 1) + k
                indices.extend([[i,i+cols+1,i+1],[i+1,i+cols+1,i+cols+2]])
    return np.array(pos), np.array(uv), np.array(indices)


def add_material(model, donor, material_index, title, tint):
    original = donor.g['materials'][material_index]
    texture = donor.g['textures'][original['pbrMetallicRoughness']['baseColorTexture']['index']]
    image = donor.g['images'][texture['extensions']['EXT_texture_webp']['source']]
    image_index = model.add('images', dict(mimeType='image/webp', bufferView=model.add_view(donor.view(image['bufferView']))))
    tex = model.add('textures', {'extensions': {'EXT_texture_webp': {'source': image_index}}})
    material = dict(name=title, doubleSided=True, pbrMetallicRoughness=dict(
        baseColorTexture={'index': tex}, baseColorFactor=[*tint,1], metallicFactor=0, roughnessFactor=.73))
    if original.get('alphaMode') == 'MASK':
        material.update(alphaMode='MASK', alphaCutoff=.38)
    return model.add('materials', material)


def coiffure():
    # Layers sweep from an off-center part, with a shorter temple and staggered ends at the back.
    pos,uv,tri=[],[],[]
    cols,rows=68,33
    for j in range(rows+1):
        v=j/rows
        for i in range(cols+1):
            a=2*np.pi*(i/cols-.5)
            rear=smooth((abs(a)-1.23)/1.12)
            phi_end=1.03+.65*smooth(abs(a)/1.28)
            upper=min(1,v/.49)
            phi=.008+upper*phi_end
            length=np.clip((v-.49)/.51,0,1)
            low=.72 * length + .28 * smooth(length)
            deep=np.sin(phi)
            fringe=.004*np.sin(9*a+3*low)+.003*np.sin(14*a-6*low)
            rx=.111+.041*low*rear+fringe*(.22+.78*low)
            rz=.137+.026*low*rear+fringe*(.22+.78*low)
            x=.013*np.cos(phi)+rx*np.sin(a)*deep
            z=.010+rz*np.cos(a)*deep-.085*low*(.42+.58*low)*rear
            y=1.706+.150*np.cos(phi)
            y-=low*(.031*smooth(abs(a)/.85)+rear*(.442+.017*np.cos(7*a)+.016*np.sin(4*a-.4)))
            # Small curved waves lift different layers away from the nape.
            x+=.010*np.sin(2.4*np.pi*v+2*a)*low*rear
            z-=.012*np.sin(np.pi*low)*rear
            pos.append((x,y,z))
            uv.append((.27+1.62*i/cols + .039*np.sin(2.5*v+a), .02+.96*v))
            if i<cols and j<rows:
                k=j*(cols+1)+i
                tri.extend([[k,k+1,k+cols+1],[k+1,k+cols+2,k+cols+1]])
    return np.array(pos),np.array(uv),np.array(tri)


def wave_material(model):
    texture=Path(__file__).with_name('originals')/'zahra-waves.webp'
    image=model.add('images',dict(mimeType='image/webp',bufferView=model.add_view(texture.read_bytes())))
    tex=model.add('textures',{'extensions': {'EXT_texture_webp': {'source':image}}})
    return model.add('materials',dict(name='Espresso waves',doubleSided=True,
        pbrMetallicRoughness=dict(baseColorTexture={'index':tex},metallicFactor=0,roughnessFactor=.72)))


def hair(model, donor):
    head, neck, spine, lower = (next(i for i,k in enumerate(model.g['skins'][0]['joints']) if model.g['nodes'][k].get('name') == 'mixamorig:' + name)
                                for name in ['Head','Neck','Spine2','Spine1'])
    parts = []
    for name in ['Body','Hair']:
        if name == 'Body':
            xyz,uv,tri=coiffure()
            for side in [-1,1]:
                p,u,faces=front_lock(side)
                tri=np.concatenate([tri,faces+len(xyz)])
                xyz,uv=np.concatenate([xyz,p]),np.concatenate([uv,u])
            mat=wave_material(model)
        else:
            xyz,uv,tri,mi=loose_strands(donor)
            mat=add_material(model,donor,mi,'Loose dark strands',[.23,.21,.21])
        # The crown follows the head. Below the collar the locks settle onto the thorax.
        wh = smooth((xyz[:, 1] - 1.47) / .19)
        ws = smooth((1.59 - xyz[:, 1]) / .24) * (1 - wh)
        wl = smooth((1.34 - xyz[:, 1]) / .18) * ws * .65
        weights = np.stack([wh, 1-wh-ws, ws-wl, wl], axis=1)
        joints = np.tile([head,neck,spine,lower], (len(xyz),1))
        attributes = dict(POSITION=model.attr(xyz,5126,'VEC3',True), NORMAL=model.attr(normals(xyz,tri),5126,'VEC3'),
                          TEXCOORD_0=model.attr(uv,5126,'VEC2'), JOINTS_0=model.attr(joints,5121,'VEC4'),
                          WEIGHTS_0=model.attr(weights,5126,'VEC4'))
        parts.append(dict(attributes=attributes, indices=model.attr(tri.ravel(),5123,'SCALAR'), material=mat))
    mesh = model.add('meshes', {'name':'Head_rebel','primitives':parts})
    node = model.add('nodes', {'name':'Head_rebel','mesh':mesh,'skin':0})
    model.g['scenes'][0]['nodes'].append(node)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('original', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    model = Model(args.original)
    if any(n.get('name') == 'Head_rebel' for n in model.g['nodes']):
        raise ValueError('Use the original jacket as the input for this tailoring pattern.')
    tailor(model)
    hair(model, Model(root/'public/models/race/tiffany.glb'))
    model.save(args.output)
