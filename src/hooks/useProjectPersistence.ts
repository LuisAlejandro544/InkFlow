/**
 * @file useProjectPersistence.ts
 * @description Hook especializado en la persistencia masiva de proyectos en SQLite Wasm con OPFS.
 * 
 * Gestiona:
 * - Ciclo de vida y arranque del Web Worker SQLite Wasm (`sqliteStorageService`).
 * - Reconstrucción de capas transparentes desde la base de datos con aceleración GPU (`GPUBitmapCache`).
 * - Centinela de Crash: Detección, restauración y descarte de puntos de rescate tras cierre abrupto.
 * - Auto-guardado debounced tras cada trazo terminado (`handleStrokeEnd`).
 * - Operaciones CRUD de proyectos en Galería (Crear, Abrir, Duplicar, Eliminar, Miniatura).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProjectData, Layer, TracingReference } from '../engine/types';
import { DEFAULT_PROJECT } from '../store/drawingStore';
import { sqliteStorageService, deserializeTracing } from '../storage/sqliteStorageService';
import { CrashRecoveryRecord, StoredProjectPayload } from '../storage/sqliteTypes';
import { gpuBitmapCache } from '../engine/bitmapCache';
import { globalAutoSaveSentinel } from '../engine/coroutinesBridge';

interface UseProjectPersistenceProps {
  initProjectLayers: (project: ProjectData) => Layer[];
  resetHistory: () => void;
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  setActiveLayerId: (id: string) => void;
  removeTracing: () => void;
  setCurrentScreen: (screen: 'welcome' | 'studio' | 'gallery' | 'engine') => void;
  tracingRef?: TracingReference | null;
  setTracingRef?: React.Dispatch<React.SetStateAction<TracingReference | null>>;
}

export function useProjectPersistence({
  initProjectLayers,
  resetHistory,
  setLayers,
  setActiveLayerId,
  removeTracing,
  setCurrentScreen,
  tracingRef,
  setTracingRef,
}: UseProjectPersistenceProps) {
  const [projects, setProjects] = useState<ProjectData[]>([DEFAULT_PROJECT]);
  const [currentProject, setCurrentProject] = useState<ProjectData>(DEFAULT_PROJECT);
  const [crashRecovery, setCrashRecovery] = useState<CrashRecoveryRecord | null>(null);
  const pendingLayersRef = useRef<Layer[] | null>(null);
  const currentProjectRef = useRef<ProjectData>(DEFAULT_PROJECT);
  const tracingRefCurrent = useRef<TracingReference | null>(tracingRef || null);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    tracingRefCurrent.current = tracingRef || null;
  }, [tracingRef]);

  // Centinela de Auto-Guardado no bloqueante orquestado por Corrutinas
  useEffect(() => {
    const sentinelJob = globalAutoSaveSentinel.start(
      10_000,
      () => pendingLayersRef.current !== null && pendingLayersRef.current.length > 0,
      async () => {
        if (currentProjectRef.current && pendingLayersRef.current) {
          const layersToSave = pendingLayersRef.current;
          pendingLayersRef.current = null;
          await sqliteStorageService.saveProject(
            currentProjectRef.current,
            layersToSave,
            tracingRefCurrent.current
          );
        }
      }
    );

    return () => {
      globalAutoSaveSentinel.stop();
    };
  }, []);

  /**
   * Carga un proyecto con todas sus capas reconstruidas fielmente desde SQLite Wasm (OPFS)
   */
  const loadProjectWithLayers = useCallback(async (proj: ProjectData) => {
    try {
      const stored = await sqliteStorageService.loadProject(proj.id);
      if (stored) {
        // Restaurar foto de calco o accesorio con su ángulo, escala y posición exacta
        if (stored.tracing && setTracingRef) {
          deserializeTracing(stored.tracing).then((t) => {
            if (t) setTracingRef(t);
          }).catch(() => {});
        } else if (!stored.tracing && setTracingRef) {
          setTracingRef(null);
        }

        if (stored.layers && stored.layers.length > 0) {
          const reconstructedLayers: Layer[] = await Promise.all(
            stored.layers.map((sl) => {
              return new Promise<Layer>((resolve) => {
                const canvas = document.createElement('canvas');
                canvas.width = proj.width;
                canvas.height = proj.height;
                const ctx = canvas.getContext('2d')!;

                if (sl.imageDataUrl) {
                  if (typeof createImageBitmap === 'function') {
                    gpuBitmapCache
                      .getOrCreate(`layer_${sl.id}_${sl.orderIndex}`, sl.imageDataUrl)
                      .then((bmp) => {
                        ctx.drawImage(bmp, 0, 0);
                        resolve({
                          id: sl.id,
                          name: sl.name,
                          visible: sl.visible,
                          opacity: sl.opacity,
                          blendMode: sl.blendMode,
                          locked: sl.locked,
                          canvas,
                          ctx,
                        });
                      })
                      .catch(() => {
                        const img = new Image();
                        img.onload = () => {
                          ctx.drawImage(img, 0, 0);
                          resolve({
                            id: sl.id,
                            name: sl.name,
                            visible: sl.visible,
                            opacity: sl.opacity,
                            blendMode: sl.blendMode,
                            locked: sl.locked,
                            canvas,
                            ctx,
                          });
                        };
                        img.onerror = () => {
                          resolve({
                            id: sl.id,
                            name: sl.name,
                            visible: sl.visible,
                            opacity: sl.opacity,
                            blendMode: sl.blendMode,
                            locked: sl.locked,
                            canvas,
                            ctx,
                          });
                        };
                        img.src = sl.imageDataUrl;
                      });
                  } else {
                    const img = new Image();
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0);
                      resolve({
                        id: sl.id,
                        name: sl.name,
                        visible: sl.visible,
                        opacity: sl.opacity,
                        blendMode: sl.blendMode,
                        locked: sl.locked,
                        canvas,
                        ctx,
                      });
                    };
                    img.onerror = () => {
                      resolve({
                        id: sl.id,
                        name: sl.name,
                        visible: sl.visible,
                        opacity: sl.opacity,
                        blendMode: sl.blendMode,
                        locked: sl.locked,
                        canvas,
                        ctx,
                      });
                    };
                    img.src = sl.imageDataUrl;
                  }
                } else {
                  resolve({
                    id: sl.id,
                    name: sl.name,
                    visible: sl.visible,
                    opacity: sl.opacity,
                    blendMode: sl.blendMode,
                    locked: sl.locked,
                    canvas,
                    ctx,
                  });
                }
              });
            })
          );

          setLayers(reconstructedLayers);
          setActiveLayerId(reconstructedLayers[0]?.id || '');
          resetHistory();
          return;
        }
      }
    } catch (err) {
      console.warn('[SQLite Wasm] No se encontraron capas previas, iniciando limpias:', err);
    }

    const created = initProjectLayers(proj);
    resetHistory();
    sqliteStorageService.scheduleAutoSave(proj, created, tracingRefCurrent.current, 800);
  }, [initProjectLayers, resetHistory, setActiveLayerId, setLayers, setTracingRef]);

  // Arranque del motor SQLite Wasm & Comprobación de Crash previo
  useEffect(() => {
    let isCancelled = false;

    async function bootstrap() {
      try {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
          navigator.storage.persist().catch(() => {});
        }

        await sqliteStorageService.init();

        const recovery = await sqliteStorageService.checkCrashRecovery();
        if (recovery && !isCancelled) {
          setCrashRecovery(recovery);
        }

        const dbProjects = await sqliteStorageService.getAllProjects();
        if (!isCancelled && dbProjects && dbProjects.length > 0) {
          setProjects(dbProjects);
          const latestProj = dbProjects[0];
          setCurrentProject(latestProj);
          await loadProjectWithLayers(latestProj);
          return;
        }

        if (!isCancelled) {
          const created = initProjectLayers(DEFAULT_PROJECT);
          resetHistory();
          sqliteStorageService.saveProject(DEFAULT_PROJECT, created);
        }
      } catch (err) {
        console.warn('Fallo en inicialización de almacenamiento SQLite:', err);
        if (!isCancelled) {
          initProjectLayers(DEFAULT_PROJECT);
          resetHistory();
        }
      }
    }

    bootstrap();

    return () => {
      isCancelled = true;
    };
  }, [initProjectLayers, loadProjectWithLayers, resetHistory]);

  /**
   * Restaura la obra de arte desde el punto de guardado de emergencia ante crash
   */
  const handleRestoreCrash = useCallback(async () => {
    if (!crashRecovery) return;

    try {
      const payload: StoredProjectPayload = JSON.parse(crashRecovery.payloadJson);
      setCurrentProject(payload.project);

      const restoredLayers: Layer[] = await Promise.all(
        payload.layers.map((sl) => {
          return new Promise<Layer>((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = payload.project.width;
            canvas.height = payload.project.height;
            const ctx = canvas.getContext('2d')!;

            if (sl.imageDataUrl) {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
                resolve({
                  id: sl.id,
                  name: sl.name,
                  visible: sl.visible,
                  opacity: sl.opacity,
                  blendMode: sl.blendMode,
                  locked: sl.locked,
                  canvas,
                  ctx,
                });
              };
              img.onerror = () => {
                resolve({
                  id: sl.id,
                  name: sl.name,
                  visible: sl.visible,
                  opacity: sl.opacity,
                  blendMode: sl.blendMode,
                  locked: sl.locked,
                  canvas,
                  ctx,
                });
              };
              img.src = sl.imageDataUrl;
            } else {
              resolve({
                id: sl.id,
                name: sl.name,
                visible: sl.visible,
                opacity: sl.opacity,
                blendMode: sl.blendMode,
                locked: sl.locked,
                canvas,
                ctx,
              });
            }
          });
        })
      );

      setLayers(restoredLayers);
      setActiveLayerId(restoredLayers[0]?.id || '');
      resetHistory();

      // Restaurar foto de calco o accesorio guardado en el punto de rescate
      if (payload.tracing && setTracingRef) {
        deserializeTracing(payload.tracing).then((t) => {
          if (t) setTracingRef(t);
        }).catch(() => {});
      }

      setCrashRecovery(null);
      await sqliteStorageService.clearCrashRecovery();
      setCurrentScreen('studio');
    } catch (err) {
      console.error('Error al restaurar sesión recuperada:', err);
    }
  }, [crashRecovery, resetHistory, setActiveLayerId, setCurrentScreen, setLayers, setTracingRef]);

  const handleDismissCrash = useCallback(async () => {
    setCrashRecovery(null);
    await sqliteStorageService.clearCrashRecovery();
  }, []);

  const handleStrokeEnd = useCallback((layers: Layer[]) => {
    pendingLayersRef.current = layers;
    if (currentProject && layers.length > 0) {
      sqliteStorageService.scheduleAutoSave(currentProject, layers, tracingRefCurrent.current, 1000);
    }
  }, [currentProject]);

  const handleOpenProject = async (proj: ProjectData) => {
    setCurrentProject(proj);
    await loadProjectWithLayers(proj);
    setCurrentScreen('studio');
  };

  const handleCreateNewProject = async (name: string, width: number, height: number) => {
    const newProj: ProjectData = {
      id: `proj_${Date.now()}`,
      name,
      width,
      height,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumbnailUrl: '',
      layerCount: 1,
    };
    const updated = [newProj, ...projects];
    setProjects(updated);
    setCurrentProject(newProj);
    const createdLayers = initProjectLayers(newProj);
    resetHistory();
    removeTracing();
    setCurrentScreen('studio');

    try {
      await sqliteStorageService.saveProject(newProj, createdLayers, null);
    } catch (e) {
      console.warn('Error al guardar nuevo proyecto en SQLite:', e);
    }
  };

  const handleDuplicateProject = async (proj: ProjectData) => {
    try {
      const newId = `proj_${Date.now()}`;
      const newName = `${proj.name} (Copia)`;
      const dupProj = await sqliteStorageService.duplicateProject(proj.id, newId, newName);
      setProjects([dupProj, ...projects]);
    } catch (err) {
      console.warn('Error al duplicar en SQLite:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) return;
    try {
      await sqliteStorageService.deleteProject(id);
    } catch (e) {
      console.warn('Error al eliminar proyecto de SQLite:', e);
    }
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (currentProject.id === id) {
      setCurrentProject(updated[0]);
      await loadProjectWithLayers(updated[0]);
      removeTracing();
    }
  };

  const handleUpdateProjectThumbnail = (thumbnailUrl: string, layers: Layer[]) => {
    setProjects(prev => prev.map(p => p.id === currentProject.id ? { ...p, thumbnailUrl, layerCount: layers.length } : p));
    if (currentProject && layers.length) {
      sqliteStorageService.scheduleAutoSave({ ...currentProject, thumbnailUrl }, layers, 400);
    }
  };

  return {
    projects,
    setProjects,
    currentProject,
    setCurrentProject,
    crashRecovery,
    loadProjectWithLayers,
    handleRestoreCrash,
    handleDismissCrash,
    handleStrokeEnd,
    handleOpenProject,
    handleCreateNewProject,
    handleDuplicateProject,
    handleDeleteProject,
    handleUpdateProjectThumbnail,
  };
}
