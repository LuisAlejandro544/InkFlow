/**
 * @file kotlinWasmBridge.ts
 * @description Puente de compatibilidad hacia el motor vectorial C++23 WebAssembly (IbisVectorEngine).
 * 
 * Re-exporta el motor vectorial C++23 (`cppVectorEngine`) manteniendo retrocompatibilidad total con la API:
 * 1. Generación de curvas Bézier cúbicas con suavizado Catmull-Rom para trazos continuos.
 * 2. Algoritmo Douglas-Peucker de decodificación y reducción de ruido táctil en memoria continua.
 * 3. Envoltura de grosor variable basada en la presión muestreada por el sensor o simulada por velocidad.
 * 4. Renderizado vectorial dinámico e independiente de la resolución (Cero Píxeles al Zoom).
 * 
 * Nueva responsabilidad asignada a Kotlin:
 * - Orquestador del runtime y persistencia nativa en Android (Stylus API, rechazo de palma con hardware).
 * - Empaquetador y serializador de proyectos de ilustración multi-capa `.inkflow`.
 * - Motor de armonía cromática y teoría del color (Oklab/CIELAB).
 */

import { cppVectorEngine, CppWasmVectorBridge } from './cppWasmVectorBridge';

export { CppWasmVectorBridge as KotlinWasmVectorBridge };
export const kotlinVectorEngine = cppVectorEngine;
export { cppVectorEngine };
