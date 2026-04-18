"""Resolve URL informada pelo usuário em algo que o OpenCV sabe abrir.

Tipos suportados:
    - RTSP direto (rtsp://)
    - HLS direto (.m3u8 ou http(s) genérico que já seja manifest)
    - YouTube (live ou VOD) → extrai HLS via yt-dlp
    - Dispositivo local ("0", "1") → webcam

Se yt-dlp não estiver instalado, URLs do YouTube devolvem ValueError com
instrução de instalação.
"""
from __future__ import annotations

import logging
import re
from typing import Tuple, Union
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


_YT_PATTERNS = (
    re.compile(r"(https?://)?(www\.)?youtube\.com/"),
    re.compile(r"(https?://)?youtu\.be/"),
    re.compile(r"(https?://)?(www\.)?youtube\.com/live/"),
)


def _is_youtube(url: str) -> bool:
    return any(p.search(url) for p in _YT_PATTERNS)


def _is_device_id(url: str) -> bool:
    return url.strip().isdigit()


def resolve_stream_source(url: str) -> Tuple[Union[str, int], str]:
    """Devolve (fonte_para_opencv, descrição_legível).

    Levanta ValueError se a URL for do YouTube mas não conseguirmos resolver.
    """
    url = url.strip()
    if not url:
        raise ValueError("source vazio")

    # Webcam local (raramente usado em prod mas útil em dev)
    if _is_device_id(url):
        idx = int(url)
        return idx, f"webcam:{idx}"

    # YouTube → precisa do yt-dlp pra pegar o manifest HLS
    if _is_youtube(url):
        try:
            import yt_dlp  # type: ignore
        except ImportError as exc:
            raise ValueError(
                "yt-dlp não instalado. Rode: pip install yt-dlp"
            ) from exc

        ydl_opts = {
            # Queremos HLS pois OpenCV/FFmpeg lidam bem com m3u8 ao vivo.
            "format": "best[protocol^=m3u8]/best",
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "noplaylist": True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception as exc:
            raise ValueError(f"yt-dlp falhou: {exc}") from exc

        # info["url"] normalmente é o manifest direto quando o format casou.
        stream_url = info.get("url")
        if not stream_url and info.get("formats"):
            # Fallback: pega o primeiro format com url
            for fmt in info["formats"]:
                if fmt.get("url"):
                    stream_url = fmt["url"]
                    break
        if not stream_url:
            raise ValueError("yt-dlp não retornou URL de stream")
        title = info.get("title", "youtube")
        logger.info("Resolveu YouTube %r → HLS ok (título: %s)", url, title)
        return stream_url, f"youtube:{title[:60]}"

    # RTSP, HTTP, HTTPS, arquivo local, m3u8: passa direto
    parsed = urlparse(url)
    if parsed.scheme in {"rtsp", "rtmp", "http", "https", "file"} or url.endswith(
        (".m3u8", ".mp4", ".mov")
    ):
        return url, url
    if parsed.scheme == "":
        # caminho absoluto ou relativo — deixa o OpenCV tentar
        return url, url

    raise ValueError(f"esquema não suportado: {parsed.scheme}")
