import type { Feature, FeatureCollection, Polygon } from "geojson";

export type SatellitePatchClass = 1 | 2 | 3 | 4 | 5;

export type SatellitePatchFeatureProperties = {
  analysis_id?: string;
  original_filename?: string;
  created_at?: string;
  image_date?: string;
  patch_id: string;
  bounds_left: number;
  bounds_bottom: number;
  bounds_right: number;
  bounds_top: number;
  center_lon: number;
  center_lat: number;
  valid_ratio: number;
  predicted_class: SatellitePatchClass;
  confidence: number;
  probabilities: Record<string, number>;
};

export type SatellitePatchFeature = Feature<Polygon, SatellitePatchFeatureProperties>;

export type SatellitePatchFeatureCollection = FeatureCollection<
  Polygon,
  SatellitePatchFeatureProperties
>;

export type SatelliteImageBounds = {
  left: number;
  bottom: number;
  right: number;
  top: number;
};

export type SatelliteAnalysisSummary = {
  analysis_count?: number;
  total_patches: number;
  processed_patches: number;
  skipped_patches: number;
  class_counts: Record<string, number>;
  class_percentages: Record<string, number>;
  dominant_class: SatellitePatchClass | null;
  max_class: SatellitePatchClass | null;
  image_bounds: SatelliteImageBounds;
  district_detection?: string;
  intersecting_districts?: string[];
};

export type SatelliteAnalysisSuccessResponse = {
  status: "ok";
  analysis_id: string;
  summary: SatelliteAnalysisSummary;
  geojson: SatellitePatchFeatureCollection;
};

export type SatelliteAnalysisMetadata = {
  analysis_id: string;
  original_filename: string;
  stored_filename: string;
  created_at: string;
  image_date: string;
  model_path: string;
  model_name: string;
  patch_size: number;
  img_size: number;
  total_patches: number;
  processed_patches: number;
  skipped_patches: number;
  dominant_class: SatellitePatchClass | null;
  max_class: SatellitePatchClass | null;
  image_bounds: SatelliteImageBounds;
};

export type SatelliteAnalysisListItem = {
  analysis_id: string;
  original_filename: string;
  created_at: string;
  image_date: string;
  dominant_class: SatellitePatchClass | null;
  max_class: SatellitePatchClass | null;
  total_patches: number;
  processed_patches: number;
  skipped_patches: number;
  class_counts: Record<string, number>;
};

export type SatelliteAnalysisDetailResponse = {
  status: "ok";
  analysis_id: string;
  metadata: SatelliteAnalysisMetadata;
  summary: SatelliteAnalysisSummary;
  geojson: SatellitePatchFeatureCollection;
};

export type SatelliteAnalysisErrorResponse = {
  status: "error";
  message: string;
};

export type SatelliteAnalysisResponse =
  | SatelliteAnalysisSuccessResponse
  | SatelliteAnalysisDetailResponse
  | SatelliteAnalysisErrorResponse;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("fireforestAuthToken") ?? ""}`,
  };
}

export async function analyzeSatelliteImage(
  file: File,
  imageDate: string,
): Promise<SatelliteAnalysisSuccessResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("image_date", imageDate);

  const response = await fetch(`${API_BASE_URL}/api/satellite/analyze`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  const data = (await response.json()) as SatelliteAnalysisResponse;

  if (!response.ok || data.status === "error") {
    throw new Error(data.status === "error" ? data.message : "Не удалось выполнить анализ GeoTIFF");
  }

  return data;
}

export async function deleteSatelliteAnalysis(analysisId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/satellite/analyses/${analysisId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = (await response.json()) as { status: "ok" } | SatelliteAnalysisErrorResponse;

  if (!response.ok || data.status === "error") {
    throw new Error(data.status === "error" ? data.message : "Не удалось удалить анализ");
  }
}

export async function deleteAllSatelliteAnalyses(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/api/satellite/analyses`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = (await response.json()) as
    | { status: "ok"; deleted_count: number }
    | SatelliteAnalysisErrorResponse;

  if (!response.ok || data.status === "error") {
    throw new Error(data.status === "error" ? data.message : "Не удалось удалить анализы");
  }

  return data.deleted_count;
}

export async function getSatelliteAnalyses(): Promise<SatelliteAnalysisListItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/satellite/analyses`);

  if (!response.ok) {
    throw new Error("Не удалось получить список спутниковых анализов");
  }

  return response.json();
}

export async function getSatelliteAnalysisDetail(
  analysisId: string,
): Promise<SatelliteAnalysisDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/api/satellite/analyses/${analysisId}`);
  const data = (await response.json()) as SatelliteAnalysisDetailResponse | SatelliteAnalysisErrorResponse;

  if (!response.ok || data.status === "error") {
    throw new Error(data.status === "error" ? data.message : "Не удалось открыть сохранённый анализ");
  }

  return data;
}
