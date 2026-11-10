// Cliente tipado da API FluxVision.
// Server Components usam `fetch` direto; client components chamam estas funções.
import type {
  Alert,
  Camera,
  City,
  ComparePayload,
  GeoPoint,
  Kpi,
  LiveStatus,
  PointCategory,
  RankingRow,
  TimeseriesPoint,
  Video,
  VideoProcessResult,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function jget<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    // Permite que server components façam cache curto;
    // no client, o caller pode passar `{ cache: "no-store" }`.
    next: { revalidate: 30 },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

// ---------- query-string helper ----------
function qs(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------- cities ----------
export const getCities = () => jget<City[]>(`/api/cities`);

export async function createCity(name: string): Promise<City> {
  const res = await fetch(`${API_BASE}/api/cities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`criar cidade falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as City;
}

export async function updateCity(cityId: number, name: string): Promise<City> {
  const res = await fetch(`${API_BASE}/api/cities/${cityId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`atualizar cidade falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as City;
}

export async function deleteCity(cityId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cities/${cityId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deletar cidade falhou: ${res.status} ${body}`);
  }
}

// ---------- cameras ----------
export const getCameras = () => jget<Camera[]>(`/api/cameras`);

export interface CameraCreatePayload {
  name: string;
  city_id: number;
  latitude: number;
  longitude: number;
  district?: string | null;
  category?: PointCategory;
  notes?: string | null;
  stream_url?: string | null;
  active?: boolean;
}

export async function createCamera(payload: CameraCreatePayload): Promise<Camera> {
  const res = await fetch(`${API_BASE}/api/cameras`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`criar câmera falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as Camera;
}

// Atualização parcial de câmera — usada por /live para salvar a URL padrão
// e por /cameras para editar coordenadas, categoria, etc.
export async function updateCamera(
  cameraId: number,
  patch: Partial<
    Pick<
      Camera,
      | "name"
      | "city_id"
      | "latitude"
      | "longitude"
      | "district"
      | "category"
      | "notes"
      | "stream_url"
      | "active"
    >
  >
): Promise<Camera> {
  const res = await fetch(`${API_BASE}/api/cameras/${cameraId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`patch câmera falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as Camera;
}

export async function deleteCamera(cameraId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/cameras/${cameraId}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`deletar câmera falhou: ${res.status} ${body}`);
  }
}

// ---------- videos ----------
export const getVideos = (limit = 50) => jget<Video[]>(`/api/videos?limit=${limit}`);

// ---------- analytics ----------
export const getKpis = (days = 30, cityId?: number, cameraId?: number) =>
  jget<Kpi>(`/api/analytics/summary${qs({ days, city_id: cityId, camera_id: cameraId })}`);

export const getHourly = (days = 7, cityId?: number, cameraId?: number) =>
  jget<TimeseriesPoint[]>(
    `/api/analytics/hourly${qs({ days, city_id: cityId, camera_id: cameraId })}`
  );

export const getDaily = (days = 30, cityId?: number, cameraId?: number) =>
  jget<TimeseriesPoint[]>(
    `/api/analytics/daily${qs({ days, city_id: cityId, camera_id: cameraId })}`
  );

export const getMonthly = (months = 12, cityId?: number, cameraId?: number) =>
  jget<TimeseriesPoint[]>(
    `/api/analytics/monthly${qs({ months, city_id: cityId, camera_id: cameraId })}`
  );

export const getRanking = (days = 30, cityId?: number) =>
  jget<RankingRow[]>(`/api/analytics/ranking${qs({ days, city_id: cityId })}`);

export const getGeo = (days = 30, cityId?: number) =>
  jget<GeoPoint[]>(`/api/analytics/geo${qs({ days, city_id: cityId })}`);

export const getCompare = (
  startA: string,
  endA: string,
  startB: string,
  endB: string,
  granularity: "hour" | "day" | "month" = "day",
  cityId?: number,
  cameraId?: number
) =>
  jget<ComparePayload>(
    `/api/analytics/compare${qs({
      start_a: startA,
      end_a: endA,
      start_b: startB,
      end_b: endB,
      granularity,
      city_id: cityId,
      camera_id: cameraId,
    })}`
  );

// ---------- alerts ----------
/** `limit`: a API devolve os mais recentes, 50 por padrão e no máximo 500. */
export const getAlerts = (onlyOpen = true, limit?: number) =>
  jget<Alert[]>(
    `/api/alerts?only_open=${onlyOpen}${limit ? `&limit=${limit}` : ""}`
  );

export const ackAlert = (id: number) =>
  jget<Alert>(`/api/alerts/${id}/ack`, { method: "POST" });

// ---------- videos ----------
export async function uploadVideo(
  cameraId: number,
  file: File,
  recordedAt?: string
): Promise<Video> {
  const fd = new FormData();
  fd.append("camera_id", String(cameraId));
  if (recordedAt) fd.append("recorded_at", recordedAt);
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/api/videos/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as Video;
}

export const heatmapUrl = (videoId: number) =>
  `${API_BASE}/api/heatmap/${videoId}`;

export const annotatedVideoUrl = (videoId: number) =>
  `${API_BASE}/api/videos/${videoId}/annotated`;

export const getVideo = (id: number) =>
  jget<Video>(`/api/videos/${id}`, { cache: "no-store" });

export const getVideoResult = (id: number) =>
  jget<VideoProcessResult>(`/api/videos/${id}/result`, { cache: "no-store" });

// ---------- live streaming ----------
export const listLive = () => jget<LiveStatus[]>(`/api/live`, { cache: "no-store" });

export const getLiveStatus = (cameraId: number) =>
  jget<LiveStatus>(`/api/live/${cameraId}`, { cache: "no-store" });

export async function startLive(cameraId: number, source: string): Promise<LiveStatus> {
  const res = await fetch(`${API_BASE}/api/live/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ camera_id: cameraId, source }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`start falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as LiveStatus;
}

export async function stopLive(cameraId: number): Promise<LiveStatus> {
  const res = await fetch(`${API_BASE}/api/live/${cameraId}/stop`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`stop falhou: ${res.status} ${body}`);
  }
  return (await res.json()) as LiveStatus;
}

export const liveMjpegUrl = (cameraId: number) =>
  `${API_BASE}/api/live/${cameraId}/mjpeg`;
