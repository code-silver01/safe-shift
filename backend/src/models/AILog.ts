import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IAILog extends Document {
  _id: Types.ObjectId;
  repoId: Types.ObjectId;
  prompt: string;
  filePath: string;
  complexityScore: number;
  complexityTier: "low" | "medium" | "high";
  modelUsed: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  premiumCostUSD: number;   // what it would have cost on premium
  savingsUSD: number;
  response: string;
  latencyMs: number;
  createdAt: Date;
}

const AILogSchema = new Schema<IAILog>(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    prompt: { type: String, required: true },
    filePath: { type: String, default: "" },
    complexityScore: { type: Number, default: 0 },
    complexityTier: { type: String, enum: ["low", "medium", "high"], default: "low" },
    modelUsed: { type: String, required: true },
    modelId: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    costUSD: { type: Number, default: 0 },
    premiumCostUSD: { type: Number, default: 0 },
    savingsUSD: { type: Number, default: 0 },
    response: { type: String, default: "" },
    latencyMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const AILog = mongoose.model<IAILog>("AILog", AILogSchema);
