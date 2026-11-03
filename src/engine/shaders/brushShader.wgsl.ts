/**
 * @file brushShader.wgsl.ts
 * @description Shaders WGSL (WebGPU Shading Language) para sellos de pincel (brush stamps).
 * 
 * Modela:
 * - Geometría de cuadrilátero (quad) con coordenadas UV normalizadas.
 * - Suavizado radial Gaussiano/Hermite según el parámetro softness.
 * - Dinámica de atenuación y canal alfa para aceleración en GPU móvil.
 */

export const BRUSH_WGSL_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  var output: VertexOutput;
  output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
  output.uv = pos[vertexIndex] * 0.5 + 0.5;
  return output;
}

struct BrushUniforms {
  color: vec4f,
  softness: f32,
  opacity: f32,
  padding: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: BrushUniforms;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let dist = distance(uv, vec2f(0.5, 0.5)) * 2.0;
  if (dist > 1.0) {
    discard;
  }
  // Suavizado de bordes según la suavidad del pincel
  let alpha = smoothstep(1.0, 1.0 - uniforms.softness, dist) * uniforms.color.a * uniforms.opacity;
  return vec4f(uniforms.color.rgb, alpha);
}
`;
