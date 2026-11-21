// Costa del Gzowo: asks the graphics card whether any pixel of the river was drawn, so the mirrored scene for the water can be skipped while no water is on screen.
export function createWaterWatch(renderer, meshes, viewCamera) {
  const gl = renderer.getContext();
  const free = [];
  const pending = [];
  let open = null;
  let frame = 0;
  let seen = 0;
  let answered = -1;

  const begin = (camera) => {
    if (open || camera !== viewCamera) return;
    open = free.pop() || gl.createQuery();
    gl.beginQuery(gl.ANY_SAMPLES_PASSED, open);
  };
  const end = () => {
    if (!open) return;
    gl.endQuery(gl.ANY_SAMPLES_PASSED);
    pending.push([open, frame]);
    open = null;
  };
  for (const mesh of meshes) {
    const before = mesh.onBeforeRender;
    const after = mesh.onAfterRender;
    mesh.onBeforeRender = function (renderer_, scene, camera, geometry, material, group) {
      before.call(this, renderer_, scene, camera, geometry, material, group);
      begin(camera);
    };
    mesh.onAfterRender = function (renderer_, scene, camera, geometry, material, group) {
      end();
      after.call(this, renderer_, scene, camera, geometry, material, group);
    };
  }

  return {
    tick() {
      frame++;
      while (pending.length) {
        const [query, at] = pending[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        if (gl.getQueryParameter(query, gl.QUERY_RESULT)) seen = Math.max(seen, at);
        answered = Math.max(answered, at);
        free.push(query);
      }
      while (pending.length > 32) gl.deleteQuery(pending.shift()[0]);
    },
    get visible() {
      return answered < 0 || frame - answered > 8 || frame - seen <= 12;
    },
  };
}
