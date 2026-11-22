// Costa del Gzowo: helper that injects world-space varyings and custom color/roughness snippets into standard materials; alpha marks moving things (0) and soft bodies that take little screen-space occlusion (0.25).
export function hookMaterial(material, { key, uniforms = {}, pars = '', fragPars = null, color = '', rough = '', normal = '', vertex = '', physical = '', emissive = '', final = '', dynamic = false }) {
  material.userData.customShader = true;
  material.customProgramCacheKey = () => key + (dynamic === 'soft' ? '-soft' : dynamic ? '-dyn' : '');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\n' + (vertex ? pars : ''))
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
        {
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWNormal = normalize(mat3(modelMatrix) * wn);
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${vertex}
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWPos = (modelMatrix * wp).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\n' + (fragPars !== null ? fragPars : pars))
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + color)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normal)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + physical)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emissive)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + final + (dynamic ? `\ngl_FragColor.a = ${dynamic === 'soft' ? '0.25' : '0.0'};` : ''));
  };
  return material;
}
