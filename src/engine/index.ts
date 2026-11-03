/**
 * @file index.ts
 * @description Punto de entrada unificado y barrel exports para el motor gráfico de InkFlow Studio.
 */

// Tipos fundamentales
export * from './types';
export * from './environmentDetector';
export * from './toolNavigationState';

// Motores WebAssembly
export * from './wasmEngine';
export * from './wasmHistoryEngine';
export * from './wasmStreamingCompiler';
export * from './kotlinWasmBridge';

// Matemática y transformaciones espaciales
export * from './transformMath';
export * from './canvasResizeMath';

// Herramientas y características especializadas
export * from './floodFillEngine';
export * from './brushTextureEngine';
export * from './strokeAssistant';
export * from './tracingEngine';
export * from './exportEngine';

// Pipeline gráfico y shaders
export * from './bitmapCache';
export * from './webgpuEngine';
export * from './renderers/canvas2dRenderer';
export * from './shaders/brushShader.wgsl';
