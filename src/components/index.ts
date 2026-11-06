/**
 * @file index.ts
 * @description Punto de entrada unificado y barrel exports para todos los componentes de InkFlow Studio.
 */

// Pantallas principales
export * from './screens/StudioScreen';
export * from './screens/GalleryScreen';
export * from './screens/WelcomeScreen';
export * from './screens/EngineInfoScreen';
export * from './screens/SettingsInfoScreen';
export * from './screens/ThemeCustomizationScreen';
export * from './screens/AppRoadmapScreen';
export * from './screens/DiagnosticMonitorScreen';

// Diálogos modales
export * from './modals/LayersModal';
export * from './modals/ColorPickerModal';
export * from './modals/ToolPickerModal';
export * from './modals/BrushTextureModal';
export * from './modals/ExportModal';
export * from './modals/CanvasResizeModal';

// Asistentes y calibradores
export * from './assistants/StrokeGuideAssistant';
export * from './assistants/TracingAdjuster';

// Subcomponentes del estudio
export * from './studio/StudioTopBar';
export * from './studio/StudioBottomBar';
export * from './studio/StudioCanvasOverlays';

// Subcomponentes de herramientas
export * from './tools/toolDefinitions';
export * from './tools/BucketSettingsCard';
export * from './tools/StabilizerScratchpad';

// Subcomponentes de calco
export * from './tracing/TracingControlBar';
export * from './tracing/TracingMinimizedPill';

// Componentes comunes
export * from './common/ErrorBoundary';
