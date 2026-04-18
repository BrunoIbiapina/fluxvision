"""Detector de veículos baseado em Ultralytics (YOLO ou RT-DETR).

O nome do modelo em `settings.yolo_model` decide a arquitetura carregada:
    - começa com "rtdetr" → usa a classe `RTDETR` (transformer, sem NMS
      interno, acurácia maior em cena com oclusão parcial)
    - qualquer outra coisa → usa `YOLO` (v8/v9/v10/v11, detector clássico)

Ambos expõem a mesma API (`model.predict(frame, conf, classes)`) e devolvem
`results[i].boxes.xyxy`, então o resto da pipeline é agnóstico.

Se Ultralytics não estiver instalado, cai para um detector simulado que emite
bounding boxes aleatórias coerentes — suficiente para desenvolver o frontend
e o pipeline sem precisar dos pesos.

Camada de pós-processamento aplicada depois do detector:
    1. Filtro de área mínima (descarta ruído distante)
    2. Filtro de aspect ratio por classe (pedestre alto e estreito marcado
       como "motorcycle" é dropado)
    3. NMS cross-class (dois boxes sobrepostos com classes diferentes — car +
       truck no mesmo veículo — mantém só o de maior confiança). O RT-DETR
       não faz NMS interno e o YOLO só faz intra-classe, então essa camada
       continua útil nos dois casos.
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass
from typing import List

import numpy as np

from ..config import settings
from ..models import VehicleType

logger = logging.getLogger(__name__)


# Mapeia os IDs COCO que nos interessam para VehicleType.
# COCO: 0=person, 1=bicycle, 2=car, 3=motorcycle, 5=bus, 7=truck
#
# Pedestre (id 0) entra junto com os veículos: o pipeline downstream trata
# "person" como categoria paralela (coluna `pedestrians`, fora do total
# de veículos). Isso também habilita o alerta de pessoa em zona de risco
# — sem adicionar a classe no predict, o YOLO não devolve essas caixas.
_COCO_TO_VEHICLE = {
    0: VehicleType.PERSON,
    1: VehicleType.BICYCLE,
    2: VehicleType.CAR,
    3: VehicleType.MOTORCYCLE,
    5: VehicleType.BUS,
    7: VehicleType.TRUCK,
}
_VEHICLE_COCO_IDS = set(_COCO_TO_VEHICLE.keys())

# Aspect ratio (largura/altura) mínima esperada por classe.
# Pedestre típico tem w/h ~ 0.3–0.5; moto/bike vista de lado, > 0.8. Um box
# "motorcycle" com w/h < 0.7 é quase sempre pessoa mal classificada.
_MIN_ASPECT_RATIO = {
    VehicleType.MOTORCYCLE: 0.7,
    VehicleType.BICYCLE: 0.7,
    VehicleType.CAR: 0.0,       # variado (vista frontal estreita); não filtra
    VehicleType.TRUCK: 0.0,
    VehicleType.BUS: 0.0,
}

# Fração mínima da área do frame que uma detecção precisa ter (descarta
# detecções a 300m de distância que são só ruído).
_MIN_AREA_FRAC = 0.0008  # 0.08% do frame

# IoU acima do qual consideramos que dois boxes de classes diferentes estão
# na verdade sobrepostos no mesmo veículo (ex.: YOLO marcou um SUV como "car"
# e "truck" simultaneamente). Nesse caso mantemos só o de maior confiança.
_CROSS_CLASS_NMS_IOU = 0.6


@dataclass
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    vehicle_type: VehicleType

    @property
    def cx(self) -> float:
        return (self.x1 + self.x2) / 2.0

    @property
    def cy(self) -> float:
        return (self.y1 + self.y2) / 2.0

    @property
    def area(self) -> float:
        return max(0.0, self.x2 - self.x1) * max(0.0, self.y2 - self.y1)

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def aspect_ratio(self) -> float:
        """Largura / altura. Pedestre ~0.3–0.5, moto de lado ~0.8–1.2, carro ~1.3+."""
        h = self.height
        if h <= 0:
            return 0.0
        return self.width / h


# ---------------------------------------------------------------- pós-processamento
def _iou(a: Detection, b: Detection) -> float:
    """IoU padrão entre dois bounding boxes."""
    ix1 = max(a.x1, b.x1)
    iy1 = max(a.y1, b.y1)
    ix2 = min(a.x2, b.x2)
    iy2 = min(a.y2, b.y2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    union = a.area + b.area - inter
    if union <= 0.0:
        return 0.0
    return inter / union


def _passes_sanity(det: Detection, frame_area: float) -> bool:
    """Descarta detecções com área ínfima ou aspect ratio incompatível
    com a classe que o YOLO atribuiu.

    - Área mínima elimina ruído distante (carrinho a 300m que o YOLO
      "acha" que viu).
    - Aspect ratio filtra pedestres marcados como moto/bike: pessoa vista
      de frente tem w/h ~0.3–0.5; moto/bike vista de lado > 0.8. Abaixo
      de 0.7 para essas classes → quase sempre é pessoa.
    """
    # Área mínima (fração do frame)
    if frame_area > 0 and det.area / frame_area < _MIN_AREA_FRAC:
        return False

    # Aspect ratio por classe
    min_ar = _MIN_ASPECT_RATIO.get(det.vehicle_type, 0.0)
    if min_ar > 0.0 and det.aspect_ratio < min_ar:
        return False

    return True


def _cross_class_nms(detections: List[Detection], iou_threshold: float = _CROSS_CLASS_NMS_IOU) -> List[Detection]:
    """NMS que ignora a classe: se dois boxes de classes diferentes têm
    IoU alto, mantém só o de maior confiança.

    Motivo: o YOLO só faz NMS *dentro* da classe — é comum um SUV sair
    marcado simultaneamente como "car" e "truck", duplicando a contagem
    quando o tracker pega os dois tracks distintos.
    """
    if not detections:
        return detections

    # Ordena por confiança decrescente
    sorted_dets = sorted(detections, key=lambda d: d.confidence, reverse=True)
    kept: List[Detection] = []
    for cand in sorted_dets:
        suppressed = False
        for k in kept:
            if _iou(cand, k) >= iou_threshold:
                suppressed = True
                break
        if not suppressed:
            kept.append(cand)
    return kept


class VehicleDetector:
    """Wrapper em torno do YOLOv8 com fallback simulado."""

    def __init__(self, model_name: str | None = None, conf: float | None = None) -> None:
        self.model_name = model_name or settings.yolo_model
        self.conf = conf if conf is not None else settings.conf_threshold
        self._model = None
        self._using_fallback = False
        self._load()

    def _load(self) -> None:
        """Carrega YOLO ou RT-DETR de acordo com o nome do modelo.

        RT-DETR precisa de classe dedicada no `ultralytics`. Detecção por
        prefixo do filename evita configurar isso em mais um lugar — quem
        troca o modelo via env var não precisa mexer em código.
        """
        is_rtdetr = self.model_name.lower().startswith("rtdetr")
        try:
            if is_rtdetr:
                from ultralytics import RTDETR  # type: ignore

                logger.info("Carregando modelo RT-DETR: %s", self.model_name)
                self._model = RTDETR(self.model_name)
            else:
                from ultralytics import YOLO  # type: ignore

                logger.info("Carregando modelo YOLO: %s", self.model_name)
                self._model = YOLO(self.model_name)
        except Exception as exc:  # pragma: no cover - depende do ambiente
            logger.warning(
                "Ultralytics indisponível (%s). Usando detector simulado. "
                "Instale 'ultralytics' para detecção real.",
                exc,
            )
            self._using_fallback = True

    @property
    def using_fallback(self) -> bool:
        return self._using_fallback

    # --------------------------------------------------------------------
    def detect(self, frame: np.ndarray) -> List[Detection]:
        """Retorna as detecções de veículos em um frame BGR (OpenCV).

        Pipeline:
            YOLO → filtros de sanidade (área + aspect ratio) → NMS cross-class.
        """
        if self._using_fallback:
            return self._simulate(frame)

        assert self._model is not None
        # verbose=False reduz ruído no log; classes filtra só os veículos
        results = self._model.predict(
            frame, conf=self.conf, classes=list(_VEHICLE_COCO_IDS), verbose=False
        )
        raw: List[Detection] = []
        for r in results:
            if not hasattr(r, "boxes") or r.boxes is None:
                continue
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                if cls_id not in _COCO_TO_VEHICLE:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0].item())
                raw.append(
                    Detection(
                        x1=float(x1),
                        y1=float(y1),
                        x2=float(x2),
                        y2=float(y2),
                        confidence=conf,
                        vehicle_type=_COCO_TO_VEHICLE[cls_id],
                    )
                )

        # Pós-processamento: filtra nois e NMS cross-class
        frame_h, frame_w = frame.shape[:2]
        frame_area = float(frame_h * frame_w)
        sane = [d for d in raw if _passes_sanity(d, frame_area)]
        deduped = _cross_class_nms(sane)
        return deduped

    # --------------------------------------------------------------------
    def _simulate(self, frame: np.ndarray) -> List[Detection]:
        """Gera ~1-4 detecções aleatórias coerentes com o tamanho do frame.

        Útil para desenvolvimento sem YOLO instalado.
        """
        h, w = frame.shape[:2]
        n = random.randint(1, 4)
        out: List[Detection] = []
        for _ in range(n):
            bw = random.randint(int(w * 0.05), int(w * 0.2))
            bh = random.randint(int(h * 0.05), int(h * 0.2))
            x1 = random.randint(0, max(1, w - bw))
            y1 = random.randint(int(h * 0.3), max(int(h * 0.3) + 1, h - bh))
            vtype = random.choices(
                [VehicleType.CAR, VehicleType.MOTORCYCLE, VehicleType.BUS, VehicleType.TRUCK],
                weights=[0.7, 0.15, 0.05, 0.1],
            )[0]
            out.append(
                Detection(
                    x1=float(x1),
                    y1=float(y1),
                    x2=float(x1 + bw),
                    y2=float(y1 + bh),
                    confidence=round(random.uniform(0.4, 0.9), 2),
                    vehicle_type=vtype,
                )
            )
        return out
