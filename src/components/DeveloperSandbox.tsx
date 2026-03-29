import { useState } from "react";
import {
  FileCode2, FolderOpen, ChevronRight, ChevronDown,
  AlertTriangle, Zap, Bot, Play, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fileTree = [
  { name: "src", type: "folder", open: true, children: [
    { name: "auth", type: "folder", open: true, children: [
      { name: "auth.js", type: "file", active: true },
      { name: "session.ts", type: "file" },
      { name: "tokens.ts", type: "file" },
    ]},
    { name: "payments", type: "folder", children: [
      { name: "PaymentGateway.js", type: "file" },
      { name: "Checkout.js", type: "file" },
    ]},
    { name: "utils", type: "folder", children: [
      { name: "helpers.ts", type: "file" },
    ]},
  ]},
];

const blastRadius = [
  { name: "PaymentGateway.js", risk: "critical" as const },
  { name: "UserSession.ts", risk: "critical" as const },
  { name: "Checkout.js", risk: "critical" as const },
  { name: "Dashboard.tsx", risk: "high" as const },
  { name: "Analytics.ts", risk: "high" as const },
];

function FileTreeNode({ node, depth = 0 }: { node: any; depth?: number }) {
  const [open, setOpen] = useState(node.open ?? false);
  const isFolder = node.type === "folder";

  return (
    <div>
      <button
        onClick={() => isFolder && setOpen(!open)}
        className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs rounded transition-colors ${
          node.active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (
          open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
        ) : (
          <FileCode2 className="w-3 h-3" />
        )}
        {isFolder && <FolderOpen className="w-3 h-3" />}
        <span className="font-mono">{node.name}</span>
        {node.active && <Circle className="w-1.5 h-1.5 fill-primary text-primary ml-auto" />}
      </button>
      {isFolder && open && node.children?.map((child: any, i: number) => (
        <FileTreeNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function DeveloperSandbox({ repo }: { repo?: string }) {
  const [simulated, setSimulated] = useState(false);

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Developer Sandbox</p>
        <h2 className="text-xl font-semibold text-foreground">
          Module Analysis: <span className="font-mono text-primary">auth.js</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Bomb Screen */}
        <div className="space-y-4">
          {/* File Tree */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">File Explorer</h3>
            <div className="space-y-0.5">
              {fileTree.map((node, i) => (
                <FileTreeNode key={i} node={node} />
              ))}
            </div>
          </div>

          {/* Risk Profile */}
          <div className="glass-card p-4 risk-glow-critical">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Risk Profile</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-risk-critical animate-pulse-glow" />
                  Risk Level
                </span>
                <span className="text-sm font-semibold text-risk-critical">HIGH</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Impact Radius
                </span>
                <span className="text-sm font-semibold text-foreground">8 files</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Test Coverage
                </span>
                <span className="text-sm font-semibold text-risk-critical">0%</span>
              </div>
              {/* Coverage bar */}
              <div className="w-full h-1.5 rounded-full bg-accent mt-1">
                <div className="h-full w-0 rounded-full bg-risk-critical" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Simulation & AI */}
        <div className="space-y-4">
          {/* Simulate */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Change Simulation</h3>
            <Button
              onClick={() => setSimulated(!simulated)}
              className="w-full h-12 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              {simulated ? "Reset Simulation" : "Simulate Change"}
            </Button>

            {simulated && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-risk-critical" />
                  <span className="text-xs font-medium text-risk-critical uppercase tracking-wider">Blast Radius</span>
                </div>
                {blastRadius.map((dep) => (
                  <div
                    key={dep.name}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                      dep.risk === "critical"
                        ? "border-risk-critical/30 bg-risk-critical/5"
                        : "border-risk-high/30 bg-risk-high/5"
                    }`}
                  >
                    <span className="text-sm font-mono text-foreground">{dep.name}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${
                      dep.risk === "critical" ? "text-risk-critical" : "text-risk-high"
                    }`}>
                      {dep.risk}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Execution */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5" />
              AI-Assisted Execution
            </h3>
            <div className="space-y-3">
              {/* User prompt */}
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-medium text-primary">You</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-accent text-sm text-foreground">
                  Refactor this safely.
                </div>
              </div>
              {/* System response */}
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-risk-safe/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3 h-3 text-risk-safe" />
                </div>
                <div className="px-3 py-2 rounded-lg bg-accent/50 text-sm text-muted-foreground space-y-1.5 border border-border">
                  <p><span className="text-foreground font-medium">Task Complexity:</span> High</p>
                  <p><span className="text-foreground font-medium">Routing:</span> GPT-4 <span className="text-xs text-muted-foreground">(Track 1.4)</span></p>
                  <p className="text-risk-safe">✓ Generated safe refactor with backwards compatibility.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
