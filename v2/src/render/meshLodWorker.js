// Costa del Gzowo: background worker that reduces a model's triangle list with meshoptimizer; it returns index lists only, the vertices stay as they are.
import { MeshoptSimplifier } from 'https://cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/meshopt_simplifier.js';

self.onmessage = async (event) => {
  const { id, positions, indices, errors } = event.data;
  await MeshoptSimplifier.ready;
  const levels = [];
  let source = indices;
  for (const error of errors) {
    let result = null;
    try {
      const [list, reached] = MeshoptSimplifier.simplify(source, positions, 3, 0, error, ['ErrorAbsolute']);
      if (reached <= error * 1.001 && list.length < source.length * 0.8 && list.length >= 3) result = list;
    } catch (failure) {
      result = null;
    }
    levels.push(result);
    if (result) source = result;
  }
  self.postMessage({ id, levels }, levels.filter(Boolean).map((l) => l.buffer));
};
