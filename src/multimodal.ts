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
  /** Pick up `context_length`/`max_horizon`/`output_name`/`batch_size` from
   * the catalog, and enforce the entry's license tier */
  catalog_id?: string;
  /** Input context window length. Required if `catalog_id` is omitted */
  context_length?: number;
  /** Max prediction horizon. Required if `catalog_id` is omitted */
  max_horizon?: number;
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

// ─── Text embeddings (Qwen3-Embedding, EmbeddingGemma, BGE-M3, ModernBERT) ─

export interface TextEmbeddingCatalogEntry {
  id: string;
  name: string;
  embedding_dim: number;
  supports_matryoshka: boolean;
  license_tier: string;
  [k: string]: unknown;
}

/** Pooling strategy over the encoder's last hidden state. */
export type TextEmbeddingFamily = "qwen3" | "cls" | "mean" | "sentence_embedding";

export interface LoadTextEmbeddingModelParams {
  model_id: string;
  /** Omit to have the node fetch the ONNX graph and tokenizer from
   * HuggingFace Hub, using `model_id` as the catalog id. Set it to point at
   * files already on the node's filesystem — the paths are node-local. */
  path?: string;
  /** Required alongside `path` */
  tokenizer_path?: string;
  /** Required alongside `path` unless `catalog_id` covers it */
  family?: TextEmbeddingFamily;
  /** Pick up `embedding_dim`/`max_sequence_length` from the catalog, and
   * enforce the entry's license tier */
  catalog_id?: string;
  /** Required if neither `catalog_id` nor the HuggingFace path is used */
  embedding_dim?: number;
  /** Token ceiling per input. Default 512 */
  max_sequence_length?: number;
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

/** Decoder ABI: `sam1` is the 6-input EdgeSAM/MobileSAM graph, `sam2` the
 * 7-input graph with high-resolution feature taps. */
export type SegmentationFamily = "sam1" | "sam2";

export interface LoadSegmentationModelParams {
  model_id: string;
  encoder_path: string;
  decoder_path: string;
  /** Pick up `family`/`input_size` from the catalog, and enforce the entry's
   * license tier */
  catalog_id?: string;
  /** Required if `catalog_id` is omitted */
  family?: SegmentationFamily;
  /** Encoder input resolution. Required if `catalog_id` is omitted */
  input_size?: number;
}

/** A point anchoring the mask to a pixel. `is_foreground` distinguishes
 * "this is the object" from "this is background". */
export interface PointPrompt {
  x: number;
  y: number;
  is_foreground: boolean;
}

/**
 * Prompt for `segment`. Coordinates are original-image pixels — the runtime
 * scales them into encoder space itself.
 */
export type SegmentPrompt =
  | ({ type: "point" } & PointPrompt)
  | { type: "box"; x0: number; y0: number; x1: number; y1: number }
  | { type: "points"; points: PointPrompt[] };

export interface SegmentParams {
  model_id: string;
  image_base64: string;
  prompts: SegmentPrompt[];
}

// ─── Text-promptable segmentation (SAM 3 / SAM 3.1) ─────────────────────

export interface TextSegmentationCatalogEntry {
  id: string;
  name: string;
  license_tier: string;
  [k: string]: unknown;
}

/** Box prompt for `textSegment` — centre plus extent, unlike the corner
 * pairs the click-driven `segment` surface takes. */
export interface TextSegmentBoxPrompt {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface TextSegmentParams {
  model_id: string;
  image_base64: string;
  /** Free-text label, e.g. `"dog"`. Pass `""` together with `box_prompt` to
   * run box-only mode. */
  text_prompt: string;
  box_prompt?: TextSegmentBoxPrompt;
  /** Default 0.5 */
  score_threshold?: number;
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

/** Post-processing ABI: `rf_detr` indexes 90 COCO classes and returns raw
 * logits in `cxcywh`; `d_fine` indexes 80 and returns sorted `xyxy` pixels.
 * Both are NMS-free. */
export type DetectionFamily = "rf_detr" | "d_fine";

export interface LoadDetectionModelParams {
  model_id: string;
  path: string;
  /** Pick up `family`/`input_size`/`num_classes` from the catalog, and
   * enforce the entry's license tier */
  catalog_id?: string;
  /** Required if `catalog_id` is omitted */
  family?: DetectionFamily;
  /** Required if `catalog_id` is omitted */
  input_size?: number;
  /** Required if `catalog_id` is omitted */
  num_classes?: number;
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

export type AudioFamily = "moonshine" | "whisper" | "parakeet" | "canary";

export type WhisperVariant = "distil-en" | "distil-large-v3" | "large-v3-turbo";

/** Canary's decoder prefix language, one of `en` / `de` / `es` / `fr`. */
export type CanaryLang = "en" | "de" | "es" | "fr";

export interface LoadAudioModelParams {
  model_id: string;
  encoder_path: string;
  decoder_path: string;
  /** Required for `moonshine` and `whisper` */
  tokenizer_path?: string;
  /** Required for `parakeet` and `canary` */
  preprocessor_path?: string;
  /** Required for `parakeet` and `canary` */
  vocab_path?: string;
  /** Pick up `family` / `max_audio_seconds` (+ inferred whisper variant) from the catalog */
  catalog_id?: string;
  /** Required if `catalog_id` is omitted */
  family?: AudioFamily;
  /** Default 30 */
  max_audio_seconds?: number;
  /** Required for whisper-family loads (unless `catalog_id` covers it) */
  whisper_variant?: WhisperVariant;
  /** Canary only. Default `"en"` */
  source_lang?: CanaryLang;
  /** Canary only. Default `"en"` — set it differently from `source_lang` to
   * translate rather than transcribe. */
  target_lang?: CanaryLang;
}

export interface TranscribeParams {
  model_id: string;
  /** Base64-encoded WAV/FLAC/MP3 bytes */
  audio_base64: string;
  language?: string;
  timestamps?: boolean;
  temperature?: number;
}

// ─── Video (clip-level embeddings over an image encoder) ─────────────────

export interface VideoCatalogEntry {
  id: string;
  name: string;
  license_tier: string;
  [k: string]: unknown;
}

export interface LoadVideoModelParams {
  /** Id to register the clip encoder under */
  model_id: string;
  /** Id of an image encoder already brought online with `loadVisionModel` */
  vision_model_id: string;
  /** Frames to sample per clip. Default 8, clamped to 1..128 */
  num_frames?: number;
}

export interface VideoEmbedParams {
  model_id: string;
  /** Base64-encoded video container bytes */
  video_base64: string;
  normalize?: boolean;
  /** Keep every `frame_stride`-th decoded frame instead of spreading the
   * samples evenly across the clip. Still capped at the `num_frames` the clip
   * encoder was registered with, so a tight stride surveys the opening of the
   * clip rather than the whole of it. */
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
 * Multi-modal AI client — covers the ONNX-backed runtimes on a Tenzro node:
 * forecast (timeseries), vision encoders, text embeddings, click-driven
 * segmentation, text-promptable segmentation, detection, audio (ASR), and
 * video.
 *
 * Each modality has the same surface shape: `list{Modality}Catalog()` to
 * browse curated models, `list{Modality}Models()` to inspect what is
 * currently loaded, `load{Modality}Model()` to bring a model online,
 * `unload{Modality}Model()` to drop it, and one inference verb.
 *
 * Most loaders need the ONNX already on the node's filesystem — the paths
 * are node-local, not client-local. Two fetch from HuggingFace Hub
 * themselves: `loadTextEmbeddingModel` when called with a catalog id and no
 * path, and `loadTextSegmentationModel` always.
 *
 * `catalog_id` inherits the structural parameters from the curated catalog
 * entry and enforces its license tier: the node refuses with JSON-RPC
 * `-32010` when the operator has not accepted that entry's terms. Those are
 * node-operator startup flags, never client parameters.
 *
 * The runtimes are feature-gated. A node built without the `onnx` feature
 * answers every load and inference call with JSON-RPC `-32011`.
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

  /**
   * Load a text encoder. Two paths: pass a catalog id as `model_id` and omit
   * `path`, and the node fetches the ONNX graph and tokenizer from
   * HuggingFace onto its models directory. Or pass `path` + `tokenizer_path`
   * + `family` for files already on the node.
   */
  async loadTextEmbeddingModel(
    params: LoadTextEmbeddingModelParams,
  ): Promise<LoadModelResult> {
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

  /** Load a segmenter from node-local encoder + decoder ONNX files. */
  async loadSegmentationModel(
    params: LoadSegmentationModelParams,
  ): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadSegmentationModel", [params]);
  }

  async unloadSegmentationModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadSegmentationModel", [{ model_id: modelId }]);
  }

  /** Segment from clicks or boxes. The encoder pass is cached per image, so
   * each additional prompt costs one more decoder pass. */
  async segment(params: SegmentParams): Promise<unknown> {
    return this.rpc.call("tenzro_segment", [params]);
  }

  // ── Text-promptable segmentation ──

  async listTextSegmentationCatalog(): Promise<{ models: TextSegmentationCatalogEntry[] }> {
    return this.rpc.call("tenzro_listTextSegmentationCatalog");
  }

  async listTextSegmentationModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listTextSegmentationModels");
  }

  /**
   * Load a SAM-3-family segmenter by catalog id. The node fetches the ONNX
   * bundle from HuggingFace Hub (or reuses its cache) and registers it under
   * the same id — no filesystem path needed.
   */
  async loadTextSegmentationModel(modelId: string): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadTextSegmentationModel", [{ model_id: modelId }]);
  }

  async unloadTextSegmentationModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadTextSegmentationModel", [{ model_id: modelId }]);
  }

  /** Segment by free-text label, no click needed. */
  async textSegment(params: TextSegmentParams): Promise<unknown> {
    return this.rpc.call("tenzro_textSegment", [params]);
  }

  // ── Detection ──

  async listDetectionCatalog(): Promise<{ models: DetectionCatalogEntry[] }> {
    return this.rpc.call("tenzro_listDetectionCatalog");
  }

  async listDetectionModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listDetectionModels");
  }

  /** Load a detector from a node-local ONNX file. */
  async loadDetectionModel(
    params: LoadDetectionModelParams,
  ): Promise<LoadModelResult> {
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

  /** The V-JEPA 2 entries the node knows about. They describe the reference
   * clip encoders; the loader below composes over an image encoder instead. */
  async listVideoCatalog(): Promise<{ models: VideoCatalogEntry[] }> {
    return this.rpc.call("tenzro_listVideoCatalog");
  }

  async listVideoModels(): Promise<LoadedModelsList> {
    return this.rpc.call("tenzro_listVideoModels");
  }

  /**
   * Register a clip encoder over an image encoder that `loadVisionModel` has
   * already brought online. Each call samples `num_frames` evenly-spaced
   * frames, embeds them through that encoder, and mean-pools. The node answers
   * `-32004` when `vision_model_id` names an encoder it has not loaded.
   */
  async loadVideoModel(params: LoadVideoModelParams): Promise<LoadModelResult> {
    return this.rpc.call("tenzro_loadVideoModel", [params]);
  }

  async unloadVideoModel(modelId: string): Promise<UnloadModelResult> {
    return this.rpc.call("tenzro_unloadVideoModel", [{ model_id: modelId }]);
  }

  async videoEmbed(params: VideoEmbedParams): Promise<unknown> {
    return this.rpc.call("tenzro_videoEmbed", [params]);
  }
}
