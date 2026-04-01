import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  type InvokeModelCommandInput,
} from "@aws-sdk/client-bedrock-runtime";

// ---------------------------------------------------------------------------
// Model pricing (per 1K tokens, approximate)
// ---------------------------------------------------------------------------
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  "anthropic.claude-3-haiku-20240307-v1:0":   { input: 0.00025, output: 0.00125 },
  "anthropic.claude-3-5-sonnet-20241022-v2:0": { input: 0.003,   output: 0.015 },
  // Amazon Nova
  "amazon.nova-lite-v1:0":                     { input: 0.00006, output: 0.00024 },
  "amazon.nova-pro-v1:0":                      { input: 0.0008,  output: 0.0032 },
  // Amazon Titan
  "amazon.titan-text-lite-v1":                 { input: 0.00015, output: 0.0002 },
  "amazon.titan-text-express-v1":              { input: 0.0002,  output: 0.0006 },
};

// Model tier mapping
export const MODEL_TIERS = {
  cheap: [
    { id: "amazon.nova-lite-v1:0",        name: "Amazon Nova Lite" },
    { id: "amazon.titan-text-lite-v1",     name: "Amazon Titan Lite" },
  ],
  mid: [
    { id: "anthropic.claude-3-haiku-20240307-v1:0", name: "Claude 3 Haiku" },
    { id: "amazon.nova-pro-v1:0",                    name: "Amazon Nova Pro" },
  ],
  premium: [
    { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", name: "Claude 3.5 Sonnet" },
  ],
};

// Premium model for savings calculation baseline
export const PREMIUM_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------
let client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Invoke a model
// ---------------------------------------------------------------------------
export interface BedrockResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
}

export async function invokeModel(
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048
): Promise<BedrockResponse> {
  const bedrock = getBedrockClient();

  // Different payload formats for different model families
  let body: string;
  let responseParser: (body: any) => { text: string; inputTokens: number; outputTokens: number };

  if (modelId.startsWith("anthropic.")) {
    // Anthropic Claude format
    body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    responseParser = (resp) => ({
      text: resp.content?.[0]?.text || "",
      inputTokens: resp.usage?.input_tokens || 0,
      outputTokens: resp.usage?.output_tokens || 0,
    });
  } else if (modelId.startsWith("amazon.nova")) {
    // Amazon Nova format
    body = JSON.stringify({
      messages: [
        { role: "user", content: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
      ],
      inferenceConfig: { maxNewTokens: maxTokens },
    });
    responseParser = (resp) => ({
      text: resp.output?.message?.content?.[0]?.text || "",
      inputTokens: resp.usage?.inputTokens || 0,
      outputTokens: resp.usage?.outputTokens || 0,
    });
  } else if (modelId.startsWith("amazon.titan")) {
    // Amazon Titan format
    body = JSON.stringify({
      inputText: `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant:`,
      textGenerationConfig: {
        maxTokenCount: maxTokens,
        temperature: 0.7,
        topP: 0.9,
      },
    });
    responseParser = (resp) => ({
      text: resp.results?.[0]?.outputText || "",
      inputTokens: resp.inputTextTokenCount || 0,
      outputTokens: resp.results?.[0]?.tokenCount || 0,
    });
  } else {
    throw new Error(`Unsupported model family: ${modelId}`);
  }

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body,
  } as InvokeModelCommandInput);

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const parsed = responseParser(responseBody);

  return {
    ...parsed,
    modelId,
  };
}

/**
 * Calculate cost for a given model and token counts.
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) return 0;
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

/**
 * Calculate what the same request would have cost on the premium model.
 */
export function calculatePremiumCost(inputTokens: number, outputTokens: number): number {
  return calculateCost(PREMIUM_MODEL_ID, inputTokens, outputTokens);
}
