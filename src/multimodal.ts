import { RpcClient } from "./rpc";

// ─── Forecast (timeseries) ───────────────────────────────────────────────

/** Curated forecast (timeseries) catalog entry returned by `listForecastCatalog`. */
export interface ForecastCatalogEntry {
  id: string;
  name: string;
  context_length: number;
  max_horizon: number;
  license_tier: string;
  [k: string]: unknown;
}

export interface LoadForecastModelParams {
  /** Model id to register under */
  model_id: string;
  /** Filesystem path to the ONNX file */
  path: string;
  /** Input context window length */
  context_length: number;
  /** Max prediction horizon */
  max_horizon: number;
  /** Optional ONNX output tensor name. Required for multi-output graphs
   * such as the TimesFM 2.5 transformers export, where output[0] is
   * `last_hidden_state` and the forecast is `full_predictions`. */
  output_name?: string;
  /** Optional fixed leading batch dim (default 1). TimesFM 2.5
   * transformers ONNX requires `batch_size=2` because its decoder
   * averages flip-invariance across the batch axis. */
  batch_size?: number;
}

export interface ForecastParams {
  model_id: string;
  history: number[];
  horizon: number;
  quantiles?: number[];
  frequency_seconds?: number;
}

// ─── Vision encoders (CLIP / SigLIP2 / DINOv3) ───────────────────────────

export interface VisionCatalogEntry {
  id: string;
  name: string;
  input_size: number;
  embedding_dim: number;
  normalization: string;
  license_tier: string;
  [k: string]: unknown;
}

export interface LoadVisionModelParams {
  model_id: string;
  path: string;
  /** Pick up `input_size`/`embedding_dim`/`normalization` from the catalog */
  catalog_id?: string;
  /** Required if `catalog_id` is omitted */
  input_size?: number;
  /** Required if `catalog_id` is omitted */
  embedding_dim?: number;
  /** `"clip" | "imagenet" | "siglip"` (default `"clip"`) */
  normalization?: string;
}

export interface ImageEmbedParams {
  model_id: string;
  /** Base64-encoded PNG/JPEG/WebP bytes */
  image_base64: string;
  normalize?: boolean;
}

export interface ImageEmbedResult {
  embedding: number[];
  dim: number;
  [k: string]: unknown;
}

export interface ImageTextSimilarityResult {
  similarity: number;
  dim: number;
}

// ─── Text embeddings (Qwen3-Embedding, EmbeddingGemma, BGE-M3, Arctic) ───

export interface TextEmbeddingCatalogEntry {
  id: string;
  name: string;
  embedding_dim: number;
  supports_matryoshka: boolean;
  license_tier: string;
  [k: string]: unknown;
}

export interface TextEmbedParams {
  model_id: string;
  inputs: string[];
  /** Optional Matryoshka truncation dim (Qwen3-Embedding, EmbeddingGemma) */
  requested_dim?: number;
  normalize?: boolean;
}

// ─── Segmentation (SAM 2 / EdgeSAM / MobileSAM) ─────────────────────────

export interface SegmentationCatalogEntry {
  id: string;
  name: string;
  family: string;
  license_tier: string;
  [k: string]: unknown;
}

/** Prompt for `segment` — one of: point, box, or padding marker. */
export type SegmentPrompt =
  | { kind: "point"; x: number; y: number; label: number }
  | { kind: "box"; x0: number; y0: number; x1: number; y1: number };

export interface SegmentParams {
  model_id: string;
  image_base64: string;
  prompts: SegmentPrompt[];
}

// ─── Detection (RF-DETR, D-FINE) ─────────────────────────────────────────

export interface DetectionCatalogEntry {
  id: string;
  name: string;
  family: string;
  num_classes: number;
  input_size: number;
  license_tier: string;
  [k: string]: unknown;
}

export interface DetectParams {
  model_id: string;
  image_base64: string;
  /** Default 0.25 */
  score_threshold?: number;
}

export interface Detection {
  bbox: [number, number, number, number];
  label_id: number;
  score: number;
}

// ─── Audio ASR (Moonshine, Whisper, Distil-Whisper, Parakeet, Canary) ────

export interface AudioCatalogEntry {
  id: string;
  name: string;
  family: string;
  max_audio_seconds: number;
  license_tier: string;
  [k: string]: unknown;
}

export type AudioFamily = "moonshine" | "whisper";

export type WhisperVariant = "distil-en" | "distil-large-v3" | "large-v3-turbo";

export interface LoadAudioModelParams {
  model_id: string;
  encoder_path: string;
  decoder_path: string;
  tokenizer_path: string;
  /** Pick up `family` / `max_audio_seconds` (+ inferred whisper variant) from the catalog */
  catalog_id?: string;
  /** Required if `catalog_id` is omitted */
  family?: AudioFamily;
  /** Default 30 */
  max_audio_seconds?: number;
  /** Required for whisper-family loads (unless `catalog_id` covers it) */
  whisper_variant?: WhisperVariant;
}

export interface TranscribeParams {
  model_id: string;
  /** Base64-encoded WAV/FLAC/MP3 bytes */
  audio_base64: string;
  language?: string;
  timestamps?: boolean;
  temperature?: number;
}

// ─── Video (clip-level embeddings; wave-1 catalog is empty) ──────────────

export interface VideoCatalogEntry {
  id: string;
  name: string;
  license_tier: string;
  [k: string]: unknown;
}

export interface VideoEmbedParams {
  model_id: string;
  video_base64: string;
  normalize?: boolean;
  frame_stride?: number;
}

// ─── Generic shapes ──────────────────────────────────────────────────────

export interface LoadedModelsList {
  models: string[];
}

export interface LoadModelResult {
  model_id: string;
  loaded: boolean;
  [k: string]: unknown;
}

export interface UnloadModelResult {
  model_id: string;
  removed: boolean;
}

/**
 * Multi-modal AI client — covers all 7 ONNX-backed runtimes on a Tenzro
 * node: forecast (timeseries), vision encoders, text embeddings,
 * segmentation, detection, audio (ASR), and video.
 *
 * Each modality has the same surface shape: `list{Modality}Catalog()` to
 * browse curated models, `list{Modality}Models()` to inspect what is
 * currently loaded, `load{Modality}Model()` to bring a model online,
 * `unload{Modality}Model()` to drop it, and one inference verb.
 *
 * **Wave-1 stubs.** Four modality loaders (`loadTextEmbeddingModel`,
 * `loadSegmentationModel`, `loadDetectionModel`, `loadVideoModel`)
 * currently return JSON-RPC `-32004` from the node ("not yet wired in
 * wave 1") — the surface is exposed for discovery and symmetry, but the
 * ONNX session-loader is pending. `forecast`, `vision`, and `audio` are
 * fully wired. Catalog + list + unload endpoints work for all seven.
 */
export class MultimodalClient {
  constructor(private rpc: RpcClient) {}

  // ── Forecast ──

  async listForecastCatalog(): Promise<{ models: ForecastCatalogEntry[] }> {
    return this.rpc.call("tenzro_listForecastCatalog");
  }

  async listForecastModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listForecastModels");
  }

  async loadForecastModel(params: LoadForecastModelParams): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadForecastModel", [params]);
  }

  async unloadForecastModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadForecastModel", [{ model_id: modelId }]);
  }

  async forecast(params: ForecastParams): Promise<unknown> {
    return this.rpc.call("tenzro_forecast", [params]);
  }

  // ── Vision encoders ──

  async listVisionCatalog(): Promise<{ models: VisionCatalogEntry[] }> {
    return this.rpc.call("tenzro_listVisionCatalog");
  }

  async listVisionModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listVisionModels");
  }

  async loadVisionModel(params: LoadVisionModelParams): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadVisionModel", [params]);
  }

  async unloadVisionModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadVisionModel", [{ model_id: modelId }]);
  }

  /** Embed a single image. Note: the node RPC is `tenzro_imageEmbed`. */
  async imageEmbed(params: ImageEmbedParams): Promise<ImageEmbedResult> {
    return this.rpc.call("tenzro_imageEmbed", [params]);
  }

  /**
   * Pure cosine similarity between two embeddings of identical dimension.
   * Pair an image embedding from `imageEmbed` with a text-tower embedding
   * (CLIP / SigLIP). Node RPC: `tenzro_imageTextSimilarity`.
   */
  async imageTextSimilarity(
    imageEmbedding: number[],
    textEmbedding: number[],
  ): Promise<ImageTextSimilarityResult> {
    return this.rpc.call("tenzro_imageTextSimilarity", [
      { image_embedding: imageEmbedding, text_embedding: textEmbedding },
    ]);
  }

  // ── Text embeddings ──

  async listTextEmbeddingCatalog(): Promise<{ models: TextEmbeddingCatalogEntry[] }> {
    return this.rpc.call("tenzro_listTextEmbeddingCatalog");
  }

  async listTextEmbeddingModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listTextEmbeddingModels");
  }

  /** Wave-1 stub: returns JSON-RPC `-32004` from the node until ONNX
   * loading lands. Exposed for surface symmetry. */
  async loadTextEmbeddingModel(params: {
    model_id: string;
    path: string;
    tokenizer_path: string;
    catalog_id?: string;
  }): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadTextEmbeddingModel", [params]);
  }

  async unloadTextEmbeddingModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadTextEmbeddingModel", [{ model_id: modelId }]);
  }

  async textEmbed(params: TextEmbedParams): Promise<unknown> {
    return this.rpc.call("tenzro_textEmbed", [params]);
  }

  // ── Segmentation ──

  async listSegmentationCatalog(): Promise<{ models: SegmentationCatalogEntry[] }> {
    return this.rpc.call("tenzro_listSegmentationCatalog");
  }

  async listSegmentationModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listSegmentationModels");
  }

  /** Wave-1 stub: returns JSON-RPC `-32004` from the node until ONNX
   * loading lands. Exposed for surface symmetry. */
  async loadSegmentationModel(params: {
    model_id: string;
    encoder_path: string;
    decoder_path: string;
    catalog_id?: string;
  }): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadSegmentationModel", [params]);
  }

  async unloadSegmentationModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadSegmentationModel", [{ model_id: modelId }]);
  }

  async segment(params: SegmentParams): Promise<unknown> {
    return this.rpc.call("tenzro_segment", [params]);
  }

  // ── Detection ──

  async listDetectionCatalog(): Promise<{ models: DetectionCatalogEntry[] }> {
    return this.rpc.call("tenzro_listDetectionCatalog");
  }

  async listDetectionModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listDetectionModels");
  }

  /** Wave-1 stub: returns JSON-RPC `-32004` from the node until ONNX
   * loading lands. Exposed for surface symmetry. */
  async loadDetectionModel(params: {
    model_id: string;
    path: string;
    catalog_id?: string;
  }): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadDetectionModel", [params]);
  }

  async unloadDetectionModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadDetectionModel", [{ model_id: modelId }]);
  }

  async detect(params: DetectParams): Promise<{ detections: Detection[] }> {
    return this.rpc.call("tenzro_detect", [params]);
  }

  // ── Audio ASR ──

  async listAudioCatalog(): Promise<{ models: AudioCatalogEntry[] }> {
    return this.rpc.call("tenzro_listAudioCatalog");
  }

  async listAudioModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listAudioModels");
  }

  async loadAudioModel(params: LoadAudioModelParams): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadAudioModel", [params]);
  }

  async unloadAudioModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadAudioModel", [{ model_id: modelId }]);
  }

  async transcribe(params: TranscribeParams): Promise<unknown> {
    return this.rpc.call("tenzro_transcribe", [params]);
  }

  // ── Video ──

  /** Wave-1 catalog is empty pending license clearance + ONNX export. */
  async listVideoCatalog(): Promise<{ models: VideoCatalogEntry[] }> {
    return this.rpc.call("tenzro_listVideoCatalog");
  }

  async listVideoModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listVideoModels");
  }

  /** Wave-1 stub: returns JSON-RPC `-32004` from the node — catalog is
   * empty pending license clearance + ONNX export (`tools/video-export`). */
  async loadVideoModel(params: {
    model_id: string;
    path: string;
    catalog_id?: string;
  }): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadVideoModel", [params]);
  }

  async unloadVideoModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadVideoModel", [{ model_id: modelId }]);
  }

  async videoEmbed(params: VideoEmbedParams): Promise<unknown> {
    return this.rpc.call("tenzro_videoEmbed", [params]);
  }
}
