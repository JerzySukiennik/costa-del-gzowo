// Costa del Gzowo: loads the baked pedestrian pack and builds one geometry per person with a near and a far triangle list on shared vertices.
import * as THREE from 'three';

export async function loadPeds(base = 'assets/npc/') {
  const [meta, data] = await Promise.all([fetch(base + 'peds.json').then((r) => r.json()), fetch(base + 'peds.bin').then((r) => r.arrayBuffer())]);
  const people = meta.people.map((person) => {
    const view = (name, Type) => new Type(data, person.blocks[name][0], person.blocks[name][1]);
    const attributes = {
      position: new THREE.BufferAttribute(view('position', Float32Array), 3),
      normal: new THREE.BufferAttribute(view('normal', Int8Array), 3, true),
      skinIndex: new THREE.BufferAttribute(view('skinIndex', Uint8Array), 4),
      skinWeight: new THREE.BufferAttribute(view('skinWeight', Uint8Array), 4, true),
      aMat: new THREE.BufferAttribute(view('mat', Uint8Array), 4),
      aFace: new THREE.BufferAttribute(view('face', Int16Array), 3, true),
    };
    const make = (indexName) => {
      const g = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(attributes)) g.setAttribute(name, attribute);
      g.setIndex(new THREE.BufferAttribute(view(indexName, Uint16Array), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.1);
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.2, -1), new THREE.Vector3(1, 2, 1));
      return g;
    };
    return { meta: person, id: person.id, near: make('index'), far: make('far') };
  });
  return { people, byId: Object.fromEntries(people.map((p) => [p.id, p])) };
}
