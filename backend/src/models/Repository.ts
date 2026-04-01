import mongoose, { Schema, type Document, type Types } from "mongoose";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------
export interface IFunction {
  name: string;
  lineCount: number;
  startLine: number;
  params: number;
}

export interface IFileEntry {
  path: string;
  language: string;
  lineCount: number;
  size: number;
  imports: string[];
  exports: string[];
  functions: IFunction[];
  complexity: number;
  testCoverage: number;
  hasTests: boolean;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
}

export interface IRepository extends Document {
  _id: Types.ObjectId;
  name: string;
  fullUrl: string;
  clonePath: string;
  status: "queued" | "cloning" | "parsing" | "analyzing" | "building_graph" | "scoring" | "ready" | "error";
  statusMessage: string;
  progress: number;              // 0-100
  files: IFileEntry[];
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>; // language -> file count
  createdAt: Date;
  updatedAt: Date;
}

const FunctionSchema = new Schema<IFunction>(
  {
    name: { type: String, required: true },
    lineCount: { type: Number, required: true },
    startLine: { type: Number, required: true },
    params: { type: Number, default: 0 },
  },
  { _id: false }
);

const FileEntrySchema = new Schema<IFileEntry>(
  {
    path: { type: String, required: true },
    language: { type: String, required: true },
    lineCount: { type: Number, default: 0 },
    size: { type: Number, default: 0 },
    imports: [String],
    exports: [String],
    functions: [FunctionSchema],
    complexity: { type: Number, default: 0 },
    testCoverage: { type: Number, default: 0 },
    hasTests: { type: Boolean, default: false },
    riskScore: { type: Number, default: 0 },
    riskLevel: { type: String, enum: ["critical", "high", "medium", "low"], default: "low" },
  },
  { _id: false }
);

const RepositorySchema = new Schema<IRepository>(
  {
    name: { type: String, required: true, index: true },
    fullUrl: { type: String, required: true },
    clonePath: { type: String, default: "" },
    status: {
      type: String,
      enum: ["queued", "cloning", "parsing", "analyzing", "building_graph", "scoring", "ready", "error"],
      default: "queued",
    },
    statusMessage: { type: String, default: "" },
    progress: { type: Number, default: 0 },
    files: [FileEntrySchema],
    totalFiles: { type: Number, default: 0 },
    totalLines: { type: Number, default: 0 },
    languages: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Repository = mongoose.model<IRepository>("Repository", RepositorySchema);
