// Tipos compartilhados com a API FluxVision (/docs para contratos oficiais)

export type PointCategory =
  | "avenue"
  | "crossing"
  | "highway"
  | "event_gate"
  | "square"
  | "parking"
  | "other";

export type VideoStatus = "pending" | "processing" | "done" | "failed";
export type AlertLevel = "info" | "warning" | "critical";

// ---------- City ----------
export interface City {
  id: number;
  name: string;
  created_at: string;
  camera_count: number;
}

// ---------- Camera ----------
// Câmera concentra dados espaciais (lat/lng, distrito, categoria) e a URL
// do stream. A cidade é só o agrupador.
export interface Camera {
  id: number;
  name: string;
  city_id: number;
  city_name?: string | null;
  latitude: number;
  longitude: number;
  district?: string | null;
  category: PointCategory;
  notes?: string | null;
  stream_url?: string | null;
  active: boolean;
  created_at: string;
}

export interface Video {
  id: number;
  camera_id: number;
  filename: string;
  status: VideoStatus;
  duration_s: number;
  width: number;
  height: number;
  fps: number;
  recorded_at: string;
  processed_at?: string | null;
  heatmap_path?: string | null;
  annotated_path?: string | null;
}

export interface VideoProcessResult {
  video_id: number;
  total_vehicles: number;
  by_type: Record<string, number>;
  duration_s: number;
  heatmap_url?: string | null;
  annotated_url?: string | null;
}

export interface Kpi {
  total: number;
  avg_per_hour: number;
  peak_hour: string | null;
  peak_value: number;
  variation_pct_vs_previous: number;
  unique_cameras: number;
  unique_cities: number;
  unique_vehicles_today: number;
  active_alerts: number;
  /** Primeiro bucket com contagem > 0, ISO com timezone local. */
  data_start: string | null;
  /** Último bucket com contagem > 0, ISO com timezone local. */
  data_end: string | null;
  /** Quantidade de horas distintas com contagem > 0. */
  hours_with_data: number;
  /** Nome IANA do fuso usado na conversão (ex: "America/Sao_Paulo"). */
  timezone: string;
}

export interface TimeseriesPoint {
  bucket: string;
  /** Fluxo de veículos no bucket — não inclui pedestres. */
  total: number;
  cars: number;
  motorcycles: number;
  buses: number;
  trucks: number;
  others: number;
  /** Pedestres contados no bucket — categoria paralela, fora de `total`. */
  pedestrians: number;
}

export interface RankingRow {
  camera_id: number;
  camera_name: string;
  city_id: number;
  city_name: string;
  category: PointCategory;
  total: number;
  variation_pct: number;
}

export interface GeoPoint {
  camera_id: number;
  camera_name: string;
  city_id: number;
  city_name: string;
  latitude: number;
  longitude: number;
  total: number;
  intensity: number;
  category: PointCategory;
}

export interface Alert {
  id: number;
  level: AlertLevel;
  title: string;
  message: string;
  variation_pct: number;
  city_id?: number | null;
  camera_id?: number | null;
  created_at: string;
  acknowledged: boolean;
}

export interface ComparePayload {
  label_a: string;
  label_b: string;
  series_a: TimeseriesPoint[];
  series_b: TimeseriesPoint[];
  total_a: number;
  total_b: number;
  variation_pct: number;
}

export interface LiveStatus {
  camera_id: number;
  running: boolean;
  source: string;
  resolved_source: string;
  fps_real: number;
  frames_processed: number;
  total_counted: number;
  by_type: Record<string, number>;
  uptime_s: number;
  error?: string | null;
  using_fallback_detector: boolean;
}
