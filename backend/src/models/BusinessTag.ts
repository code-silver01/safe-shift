import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IBusinessRule {
  pathPattern: string;
  businessDomain: string;
  revenueImpact: number;
  trafficShare: number;
  downtimeCostPerMin: number;
  priority: "critical" | "high" | "medium" | "low";
}

export interface IBusinessTag extends Document {
  _id: Types.ObjectId;
  repoId: Types.ObjectId;
  rules: IBusinessRule[];
  createdAt: Date;
  updatedAt: Date;
}

const BusinessRuleSchema = new Schema<IBusinessRule>(
  {
    pathPattern: { type: String, required: true },
    businessDomain: { type: String, required: true },
    revenueImpact: { type: Number, default: 0 },
    trafficShare: { type: Number, default: 0 },
    downtimeCostPerMin: { type: Number, default: 0 },
    priority: { type: String, enum: ["critical", "high", "medium", "low"], default: "medium" },
  },
  { _id: false }
);

const BusinessTagSchema = new Schema<IBusinessTag>(
  {
    repoId: { type: Schema.Types.ObjectId, ref: "Repository", required: true, unique: true },
    rules: [BusinessRuleSchema],
  },
  { timestamps: true }
);

export const BusinessTag = mongoose.model<IBusinessTag>("BusinessTag", BusinessTagSchema);
