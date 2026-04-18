"""Classificador de viatura policial via VLM (Claude Vision).

Opção A do roadmap de "identificação de viatura": em vez de treinar um
modelo dedicado (opções B/C, semanas de trabalho), recortamos o box do
track no frame e perguntamos pro Claude Vision se parece viatura. Não
substitui um modelo especializado, mas entrega sinal aproveitável em
horas de trabalho pra validar o produto.

Arquitetura:

    - `PoliceClassifier` é síncrono e stateless. Quem chama decide quando
      pagar o custo da inferência remota (~$0.001-0.01 por chamada).
    - `LiveStreamWorker` chama através de um `ThreadPoolExecutor` pra não
      bloquear o loop de vídeo enquanto espera a API responder.
    - Rate limit (um track a cada N segundos) e dedupe por track_id
      acontecem no chamador, não aqui — mantemos esta classe focada em
      "dado um recorte, é viatura?".

Trade-offs conhecidos:

    - Latência: 500ms-3s por chamada. Por isso rate-limited + async.
    - Custo: ~$0.001-0.01 por classificação dependendo do modelo. Uma
      câmera com 1 classificação a cada 30s é $0.1-1/hora.
    - Falso negativo: viatura descaracterizada (investigação, operação
      velada) não é detectada — esperado.
    - Falso positivo: carro branco com adesivo aleatório pode passar.
      Prompt pede confirmação de elemento policial específico (escudo,
      rotativo, faixa refletiva) pra mitigar.
"""
from __future__ import annotations

import base64
import logging
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

try:
    import anthropic  # type: ignore
    _ANTHROPIC_AVAILABLE = True
except Exception:  # pragma: no cover - depende do ambiente
    anthropic = None  # type: ignore
    _ANTHROPIC_AVAILABLE = False


# Prompt deliberadamente conservador: pede evidência explícita e aceita
# "nao" em caso de dúvida. Falso positivo ("pintamos de viatura aleatório
# que não é") é pior pro produto que falso negativo (perder 1 viatura).
_PROMPT = (
    "Analise a imagem recortada deste veículo e diga se é uma viatura "
    "policial brasileira (Polícia Militar, Polícia Rodoviária Federal, "
    "Polícia Civil, Polícia Federal, Guarda Municipal ou afins). "
    "Exige-se identificação visual clara: faixa refletiva característica, "
    "escudo/brasão da corporação, rotativo (giroflex) no teto, ou "
    "pintura institucional reconhecível. Se houver qualquer dúvida, "
    "responda 'nao'.\n\n"
    "Formato OBRIGATÓRIO da resposta (uma única linha):\n"
    "<sim|nao>|<orgao_ou_'nao'>|<justificativa curta, max 15 palavras>\n\n"
    "Exemplos:\n"
    "sim|PM|Carro branco com faixa preta e escudo PM no capô.\n"
    "nao|nao|Carro branco liso sem identificação visível.\n"
    "sim|PRF|Viatura prata com faixas amarelas e logotipo PRF.\n"
)


@dataclass
class PoliceClassification:
    is_police: bool
    agency: Optional[str]       # "PM", "PRF", "GM", "PC", "PF" ou None
    reasoning: str
    raw_response: str


class PoliceClassifier:
    """Wrapper fino em cima do Claude Vision."""

    def __init__(
        self,
        model: str = "claude-3-5-sonnet-20241022",
        api_key: Optional[str] = None,
        timeout_s: float = 15.0,
    ) -> None:
        self.model = model
        self.timeout_s = timeout_s
        self._client = None
        if _ANTHROPIC_AVAILABLE:
            # API key: se for passada, usa; senão o SDK lê ANTHROPIC_API_KEY
            # do ambiente sozinho.
            kwargs = {"timeout": timeout_s}
            if api_key:
                kwargs["api_key"] = api_key
            try:
                self._client = anthropic.Anthropic(**kwargs)
            except Exception as exc:  # pragma: no cover
                logger.warning("Falha inicializando cliente Anthropic: %s", exc)
                self._client = None

    @property
    def available(self) -> bool:
        return self._client is not None

    # ------------------------------------------------------------------ API
    def classify_crop(
        self,
        frame_bgr: np.ndarray,
        box: Tuple[float, float, float, float],
        padding: float = 0.10,
    ) -> Optional[PoliceClassification]:
        """Retorna classificação ou None se a chamada falhou / SDK ausente.

        `padding` é uma margem relativa aplicada ao box (10% por padrão)
        pra dar contexto além das rodas e capô — placa, teto e entorno
        imediato ajudam o modelo.
        """
        if not self.available:
            return None
        if frame_bgr is None or frame_bgr.size == 0:
            return None

        h, w = frame_bgr.shape[:2]
        x1, y1, x2, y2 = box
        bw = max(0.0, x2 - x1)
        bh = max(0.0, y2 - y1)
        px = bw * padding
        py = bh * padding
        xa = int(max(0, x1 - px))
        ya = int(max(0, y1 - py))
        xb = int(min(w, x2 + px))
        yb = int(min(h, y2 + py))
        if xb <= xa or yb <= ya:
            return None

        crop = frame_bgr[ya:yb, xa:xb]
        # Downscale pra reduzir tokens da imagem. 512px no lado maior é
        # o suficiente pra o modelo ler identificação de viatura.
        max_side = 512
        ch, cw = crop.shape[:2]
        scale = min(1.0, max_side / max(ch, cw))
        if scale < 1.0:
            crop = cv2.resize(crop, (int(cw * scale), int(ch * scale)))

        ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ok:
            return None
        b64 = base64.b64encode(buf.tobytes()).decode("ascii")

        try:
            msg = self._client.messages.create(  # type: ignore[union-attr]
                model=self.model,
                max_tokens=120,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": _PROMPT},
                        ],
                    }
                ],
            )
        except Exception as exc:  # pragma: no cover - depende de rede
            logger.warning("classify_crop falha na API Anthropic: %s", exc)
            return None

        # Extrai texto. A lib devolve lista de blocks de content.
        raw = ""
        try:
            for block in msg.content:
                if getattr(block, "type", None) == "text":
                    raw += getattr(block, "text", "") or ""
        except Exception:  # pragma: no cover
            raw = str(msg)

        return _parse_response(raw.strip())


def _parse_response(raw: str) -> PoliceClassification:
    """Interpreta resposta no formato esperado `sim|PM|justificativa`.

    Fazemos parsing tolerante: se o modelo não seguir exatamente o
    formato, tentamos extrair o bit "sim/nao" do começo e deixamos o
    resto como justificativa.
    """
    line = raw.splitlines()[0] if raw else ""
    parts = [p.strip() for p in line.split("|")]
    answer = parts[0].lower() if parts else ""
    is_police = answer.startswith("sim")

    agency: Optional[str] = None
    reasoning = raw
    if len(parts) >= 2 and parts[1] and parts[1].lower() != "nao":
        agency = parts[1].upper()
    if len(parts) >= 3 and parts[2]:
        reasoning = parts[2]

    return PoliceClassification(
        is_police=is_police,
        agency=agency,
        reasoning=reasoning[:500],
        raw_response=raw[:2000],
    )
