import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IGraphNode {
  id: string;        // relative file path
  label: string;     // file name
  type: string;      // language
  lineCount: number;
  complexity: number;
  riskLevel: string;
  dependencyCount: number; // in-degree + out-degree
}

export interface IGraphEdge {
  source: string; // importer
  target: string; // imported
  type: "import" | "re-export";
}

export interface IDependencyGraph extends Document {
  _id: Types.ObjectId;
  repoId: Types.ObjectId;
  nodes: IGraphNode[];
  edges: IGraphEdge[];
  createdAt: Date;
  updatedAt: Date;
}

const GraphNodeSchema = new Schema<IGraphNode>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, default: "unknown" },
    lineCount: { type: Number, default: 0 },
    complexity: { type: Number, default: 0 },
    riskLevel: { type: String, default: "low" },
    dependencyCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const GraphEdgeSchema = new Schema<IGraphEdge>(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    type: { type: String, enum: ["import", "re-export"], default: "import" },
  },
  { _id: false }
);

const DependencyGraphSchema = new Schema<IDependencyGraph>(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, index: true },
    nodes: [GraphNodeSchema],
    edges: [GraphEdgeSchema],
  },
  { timestamps: true }
);

export const DependencyGraph = mongoose.model<IDependencyGraph>("DependencyGraph", DependencyGraphSchema);
