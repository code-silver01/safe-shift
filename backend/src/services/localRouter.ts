// ─────────────────────────────────────────────────────────────────────────────
// Engine 2: Local Hugging Face Transformer Router
//
// Replaces expensive cloud API calls for the initial routing decision.
// Uses all-MiniLM-L6-v2 (via @huggingface/transformers) to vectorize the
// user's prompt and compare it against pre-defined intent clusters using
// cosine similarity. Runs 100% locally — zero network calls, zero cost.
// ─────────────────────────────────────────────────────────────────────────────

// We lazy-load the pipeline to avoid blocking server startup.
let extractorPromise: Promise<any> | null = null;
let extractorInstance: any = null;

// Pre-computed cluster seed sentences
const SIMPLE_SEEDS = [
  "Explain this code",
  "What does this function do",
  "Add comments to this code",
  "Rename this variable",
  "Fix this typo",
  "Format this code",
  "What is this import used for",
  "Describe this module",
  "Add JSDoc to this function",
  "Simplify this expression",
  "Convert this to arrow function",
  "What does this regex do",
  "Add a log statement",
  "List all exports",
];

const COMPLEX_SEEDS = [
  "If I change this API what breaks on the frontend",
  "Refactor the authentication flow across services",
  "Analyze the blast radius of modifying this database schema",
  "What is the architectural impact of removing this module",
  "Redesign the state management for this application",
  "Identify all security vulnerabilities in this codebase",
  "Migrate this codebase from REST to GraphQL",
  "Propose a microservices decomposition strategy",
  "Analyze cross-boundary dependencies between frontend and backend",
  "What files are affected if I change this shared type definition",
  "Refactor this safely considering all downstream consumers",
  "Build a caching layer for the database queries",
  "Implement error handling across the entire API surface",
  "Optimize the critical rendering path for performance",
];

// Cached cluster centroid vectors (computed once at warm-up)
let simpleCentroid: Float32Array | null = null;
let complexCentroid: Float32Array | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lazy-load the transformer pipeline. Downloads the model on first call
 * (~80MB, cached on disk after that). Subsequent calls are instant.
 */
async function getExtractor(): Promise<any> {
  if (extractorInstance) return extractorInstance;

  if (!extractorPromise) {
    extractorPromise = (async () => {
      console.log("[LOCAL ROUTER] Loading all-MiniLM-L6-v2 model...");
      const startTime = Date.now();

      // Dynamic import to avoid bundling issues
      const { pipeline } = await import("@huggingface/transformers");
      extractorInstance = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { dtype: "fp32" }
      );

      const elapsed = Date.now() - startTime;
      console.log(`[LOCAL ROUTER] Model loaded in ${elapsed}ms`);
      return extractorInstance;
    })();
  }

  return extractorPromise;
}

/**
 * Convert a text string into a 384-dimensional embedding vector.
 */
async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  // The output is a Tensor — extract the raw Float32Array
  return new Float32Array(output.data);
}

/**
 * Compute the centroid (average) of multiple embedding vectors.
 * This is the "representative point" for a cluster.
 */
function computeCentroid(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) return new Float32Array(384);
  const dim = vectors[0].length;
  const centroid = new Float32Array(dim);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }

  // Normalize the centroid to unit length
  let magnitude = 0;
  for (let i = 0; i < dim; i++) {
    magnitude += centroid[i] * centroid[i];
  }
  magnitude = Math.sqrt(magnitude);
  if (magnitude > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= magnitude;
    }
  }

  return centroid;
}

/**
 * Cosine similarity between two normalized vectors.
 * Since we normalized during embedding, this is just the dot product.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Pre-compute the cluster centroids. Call this once during server warm-up
 * (or it will auto-run on first classify call).
 */
export async function warmUpRouter(): Promise<void> {
  console.log("[LOCAL ROUTER] Warming up cluster centroids...");
  const startTime = Date.now();

  // Embed all seed sentences
  const simpleVectors = await Promise.all(SIMPLE_SEEDS.map(embed));
  const complexVectors = await Promise.all(COMPLEX_SEEDS.map(embed));

  // Compute centroids
  simpleCentroid = computeCentroid(simpleVectors);
  complexCentroid = computeCentroid(complexVectors);

  const elapsed = Date.now() - startTime;
  console.log(`[LOCAL ROUTER] Centroids ready in ${elapsed}ms. Simple seeds: ${SIMPLE_SEEDS.length}, Complex seeds: ${COMPLEX_SEEDS.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// The Main API
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteDecision {
  cluster: "simple" | "complex";
  confidence: number;       // 0-1, how confident we are in the classification
  simpleScore: number;      // raw cosine similarity to the "simple" centroid
  complexScore: number;     // raw cosine similarity to the "complex" centroid
  reasoning: string;
}

/**
 * Classify a user's prompt as "simple" or "complex" using local embeddings.
 * 
 * Simple → route to a cheap/fast model (Haiku, Nova Lite, etc.)
 * Complex → route to a premium reasoning model (Sonnet, etc.) with
 *           blast radius context from the knowledge graph.
 *
 * This runs 100% locally. No API calls. No cost.
 */
export async function classifyPrompt(prompt: string): Promise<RouteDecision> {
  // Ensure centroids are computed
  if (!simpleCentroid || !complexCentroid) {
    await warmUpRouter();
  }

  // Embed the user's prompt
  const promptVec = await embed(prompt);

  // Compare against cluster centroids
  const simpleScore = cosineSimilarity(promptVec, simpleCentroid!);
  const complexScore = cosineSimilarity(promptVec, complexCentroid!);

  // The cluster with the higher similarity wins
  const isComplex = complexScore > simpleScore;
  const confidence = Math.abs(complexScore - simpleScore);

  // If scores are very close (< 0.05 difference), default to complex (safer)
  const cluster = isComplex || confidence < 0.05 ? "complex" : "simple";

  const reasoning = cluster === "simple"
    ? `Local classifier: Simple task (simple=${simpleScore.toFixed(3)}, complex=${complexScore.toFixed(3)}). Routing to cost-efficient model.`
    : `Local classifier: Complex task (simple=${simpleScore.toFixed(3)}, complex=${complexScore.toFixed(3)}). Routing to premium model with graph context.`;

  return {
    cluster,
    confidence,
    simpleScore,
    complexScore,
    reasoning,
  };
}

/**
 * Map the route decision to a concrete model tier.
 * This is a lookup table — the actual model invocation happens in aiRouter.ts.
 */
export function decisionToTier(decision: RouteDecision): "low" | "medium" | "high" {
  if (decision.cluster === "simple") return "low";
  
  // For complex tasks, further split based on confidence
  if (decision.confidence > 0.15) return "high";
  return "medium";
}
