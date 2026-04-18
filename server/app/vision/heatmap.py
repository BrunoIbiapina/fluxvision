"""Geração do heatmap de densidade dentro do frame."""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Tuple

import cv2
import numpy as np


class HeatmapAccumulator:
    """Acumula "calor" por pixel a cada detecção e produz uma imagem final."""

    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.heat = np.zeros((height, width), dtype=np.float32)

    def add_box(self, x1: float, y1: float, x2: float, y2: float, weight: float = 1.0) -> None:
        xi1 = max(0, int(x1))
        yi1 = max(0, int(y1))
        xi2 = min(self.width, int(x2))
        yi2 = min(self.height, int(y2))
        if xi2 <= xi1 or yi2 <= yi1:
            return
        self.heat[yi1:yi2, xi1:xi2] += weight

    def render(self, background: np.ndarray | None = None, alpha: float = 0.6) -> np.ndarray:
        """Renderiza o heatmap, opcionalmente sobreposto a uma imagem BGR."""
        heat_blur = cv2.GaussianBlur(self.heat, (0, 0), sigmaX=25, sigmaY=25)
        if heat_blur.max() > 0:
            heat_norm = (heat_blur / heat_blur.max() * 255.0).astype(np.uint8)
        else:
            heat_norm = np.zeros_like(heat_blur, dtype=np.uint8)
        colored = cv2.applyColorMap(heat_norm, cv2.COLORMAP_JET)
        if background is None:
            return colored
        bg = cv2.resize(background, (self.width, self.height))
        return cv2.addWeighted(bg, 1 - alpha, colored, alpha, 0)

    def save(self, path: Path, background: np.ndarray | None = None) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(path), self.render(background))
