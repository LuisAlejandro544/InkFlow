/**
 * @file useStudioModals.ts
 * @description Hook especializado en el control de apertura y cierre de diálogos y modales del estudio.
 */

import { useState } from 'react';

export function useStudioModals() {
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isToolPickerOpen, setIsToolPickerOpen] = useState(false);
  const [isTextureModalOpen, setIsTextureModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCanvasResizeModalOpen, setIsCanvasResizeModalOpen] = useState(false);

  return {
    isLayersModalOpen,
    setIsLayersModalOpen,
    isColorPickerOpen,
    setIsColorPickerOpen,
    isToolPickerOpen,
    setIsToolPickerOpen,
    isTextureModalOpen,
    setIsTextureModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isCanvasResizeModalOpen,
    setIsCanvasResizeModalOpen,
  };
}
