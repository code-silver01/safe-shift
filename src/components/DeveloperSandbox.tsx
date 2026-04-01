import { useState, useEffect } from "react";
import {
  FileCode2, FolderOpen, ChevronRight, ChevronDown,
  AlertTriangle, Zap, Bot, Play, Circle, Loader2, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRepoFiles, simulateBlast, routePrompt, getFileContent, type FlatFile } from "@/lib/api";
import { DependencyGraphVisualizer } from "./DependencyGraphVisualizer";

interface TreeNode {
  name: string; type: "folder" | "file"; path: string;
  children?: TreeNode[]; metadata?: Record<string, any>;
}

function FileTreeNode({ node, depth = 0, onSelect, selectedPath }: {
  node: TreeNode; depth?: number; onSelect: (path: string) => void; selectedPath: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isFolder = node.type === "folder";
  const active = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => isFolder ? setOpen(!open) : onSelect(node.path)}
        className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs rounded transition-colors ${
          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isFolder ? (open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />) : <FileCode2 className="w-3 h-3" />}
        {isFolder && <FolderOpen className="w-3 h-3" />}
        <span className="font-mono truncate">{node.name}</span>
        {active && <Circle className="w-1.5 h-1.5 fill-primary text-primary ml-auto shrink-0" />}
        {node.metadata?.riskLevel === "critical" && <span className="w-1.5 h-1.5 rounded-full bg-risk-critical ml-auto shrink-0" />}
      </button>
      {isFolder && open && node.children?.map((child, i) => (
        <FileTreeNode key={i} node={child} depth={depth + 1} onSelect={onSelect} selectedPath={selectedPath} />
      ))}
    </div>
  );
}

export function DeveloperSandbox({ repo, repoId }: { repo?: string; repoId?: string }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [flatFiles, setFlatFiles] = useState<FlatFile[]>([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedMeta, setSelectedMeta] = useState<FlatFile | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [blastFiles, setBlastFiles] = useState<{ path: string; depth: number; riskLevel: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [simLoading, setSimLoading] = useState(false);

  // AI chat
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string; meta?: any }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    getRepoFiles(repoId).then((data) => {
      setTree(data.tree);
      setFlatFiles(data.flatFiles);
      if (data.flatFiles.length > 0) {
        const first = data.flatFiles.find(f => !f.hasTests) || data.flatFiles[0];
        setSelectedFile(first.path);
        setSelectedMeta(first);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [repoId]);

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    setSelectedMeta(flatFiles.find(f => f.path === path) || null);
    setSimulated(false);
    setBlastFiles([]);
  };

  const handleSimulate = async () => {
    if (!repoId || !selectedFile) return;
    if (simulated) { setSimulated(false); setBlastFiles([]); return; }
    setSimLoading(true);
    try {
      const result = await simulateBlast(repoId, selectedFile);
      setBlastFiles(result.affectedFiles);
      setSimulated(true);
    } catch { /* silent */ }
    setSimLoading(false);
  };

  const handleChat = async () => {
    if (!chatInput.trim() || !repoId) return;
    const prompt = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: prompt }]);
    setChatLoading(true);
    try {
      const result = await routePrompt(repoId, selectedFile, prompt, "");
      setChatMessages(prev => [...prev, {
        role: "ai", text: result.response,
        meta: {
          model: result.modelName,
          tier: result.complexityTier,
          complexityScore: result.complexityScore,
          savings: result.savingsUSD,
          localRouter: result.localRouterDecision,
        }
      }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: "ai",
        text: "The AI service is currently classifying locally via Transformers.js. Configure AWS Bedrock credentials for full AI responses.",
        meta: { model: "Local Router", tier: "low", complexityScore: 0, savings: 0 }
      }]);
    }
    setChatLoading(false);
  };

  const riskColor = (level: string) => level === "critical" ? "text-risk-critical" : level === "high" ? "text-risk-high" : level === "medium" ? "text-risk-medium" : "text-risk-safe";
  const riskBorder = (level: string) => level === "critical" ? "border-risk-critical/30 bg-risk-critical/5" : "border-risk-high/30 bg-risk-high/5";

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  const fileName = selectedFile.split("/").pop() || "Select a file";

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Developer Sandbox</p>
        <h2 className="text-xl font-semibold text-foreground">
          Module Analysis: <span className="font-mono text-primary">{fileName}</span>
        </h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* File Tree */}
          <div className="glass-card p-4 max-h-64 overflow-auto">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">File Explorer</h3>
            <div className="space-y-0.5">
              {tree.length > 0 ? tree.map((node, i) => (
                <FileTreeNode key={i} node={node} onSelect={handleSelectFile} selectedPath={selectedFile} />
              )) : <p className="text-xs text-muted-foreground">No files found</p>}
            </div>
          </div>
          {/* Risk Profile */}
          <div className={`glass-card p-4 ${selectedMeta?.riskLevel === "critical" ? "risk-glow-critical" : ""}`}>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Risk Profile</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${selectedMeta?.riskLevel === "critical" ? "bg-risk-critical animate-pulse-glow" : "bg-risk-safe"}`} />
                  Risk Level
                </span>
                <span className={`text-sm font-semibold ${riskColor(selectedMeta?.riskLevel || "low")}`}>{(selectedMeta?.riskLevel || "LOW").toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><FolderOpen className="w-3.5 h-3.5" /> Impact Radius</span>
                <span className="text-sm font-semibold text-foreground">{selectedMeta?.importCount || 0} deps</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" /> Test Coverage</span>
                <span className={`text-sm font-semibold ${(selectedMeta?.testCoverage || 0) < 50 ? "text-risk-critical" : "text-risk-safe"}`}>{selectedMeta?.testCoverage || 0}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-accent mt-1">
                <div className={`h-full rounded-full transition-all ${(selectedMeta?.testCoverage || 0) < 50 ? "bg-risk-critical" : "bg-risk-safe"}`} style={{ width: `${selectedMeta?.testCoverage || 0}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Complexity</span>
                <span className="text-sm font-semibold text-foreground font-mono">{selectedMeta?.complexity || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Simulate */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Change Simulation</h3>
            <Button onClick={handleSimulate} disabled={simLoading || !selectedFile} className="w-full h-12 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all" size="lg">
              {simLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {simulated ? "Reset Simulation" : "Simulate Change"}
            </Button>
            {simulated && blastFiles.length > 0 && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-risk-critical" />
                  <span className="text-xs font-medium text-risk-critical uppercase tracking-wider">Blast Radius — {blastFiles.length} files affected</span>
                </div>
                {blastFiles.slice(0, 8).map((dep) => (
                  <div key={dep.path} className={`flex items-center justify-between px-3 py-2 rounded-md border ${riskBorder(dep.riskLevel)}`}>
                    <span className="text-sm font-mono text-foreground truncate">{dep.path.split("/").pop()}</span>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${riskColor(dep.riskLevel)}`}>{dep.riskLevel}</span>
                  </div>
                ))}
                {blastFiles.length > 8 && <p className="text-xs text-muted-foreground text-center">+ {blastFiles.length - 8} more files</p>}
              </div>
            )}
            {simulated && blastFiles.length === 0 && (
              <p className="mt-4 text-xs text-risk-safe text-center">✓ No downstream dependents affected</p>
            )}
          </div>

          {/* AI Chat */}
          <div className="glass-card p-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Bot className="w-3.5 h-3.5" /> AI-Assisted Execution
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-auto mb-4 custom-scrollbar pr-2">
              {chatMessages.length === 0 && (
                <div className="text-center py-8 opacity-40">
                  <Bot className="w-8 h-8 mx-auto mb-2 text-primary/50" />
                  <p className="text-xs text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
                    Ready to assist with refactoring, explanations, or security reviews.
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 px-1">
                    {msg.role === "ai" ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">SafeShift AI</span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-right">Developer</span>
                        <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center border border-border">
                          <div className="w-2.5 h-2.5 rounded-full bg-foreground/20" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className={`group relative max-w-[90%] px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/10" 
                      : "bg-accent/40 text-foreground border border-border/50 rounded-tl-none hover:border-border selection:bg-primary/20"
                  }`}>
                    {msg.role === "ai" && msg.meta && (
                      <div className="mb-3 flex flex-wrap gap-2 items-center">
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border ${
                          msg.meta.tier === "premium" || msg.meta.tier === "high"
                            ? "bg-risk-critical/10 text-risk-critical border-risk-critical/20" 
                            : msg.meta.tier === "mid" || msg.meta.tier === "medium"
                            ? "bg-risk-medium/10 text-risk-medium border-risk-medium/20"
                            : "bg-risk-safe/10 text-risk-safe border-risk-safe/20"
                        }`}>
                          {msg.meta.model}
                        </div>
                        {msg.meta.localRouter && (
                          <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            msg.meta.localRouter.cluster === "complex"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          }`}>
                            🧠 {msg.meta.localRouter.cluster.toUpperCase()} ({(msg.meta.localRouter.confidence * 100).toFixed(0)}%)
                          </div>
                        )}
                        {msg.meta.savings > 0 && (
                          <div className="px-2 py-0.5 rounded-full bg-risk-safe/20 text-risk-safe text-[9px] font-bold border border-risk-safe/30 flex items-center gap-1">
                            <span>$</span> SAVED {msg.meta.savings.toFixed(3)}
                          </div>
                        )}
                        <div className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-medium text-muted-foreground border border-white/10">
                          {msg.meta.complexityScore} COMPLEXITY
                        </div>
                      </div>
                    )}
                    <div className="leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.text.includes("```") ? (
                        <div className="bg-black/40 rounded-lg p-2 my-2 font-mono text-[11px] border border-white/5 overflow-x-auto">
                          {msg.text}
                        </div>
                      ) : msg.text}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex flex-col gap-2 animate-pulse">
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest italic">Classifying via Transformers.js...</span>
                  </div>
                  <div className="w-2/3 h-12 bg-accent/20 rounded-2xl rounded-tl-none border border-border/20" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !chatLoading && handleChat()}
                placeholder="Refactor this safely..."
                className="h-9 text-sm bg-background"
                disabled={chatLoading}
              />
              <Button onClick={handleChat} disabled={chatLoading || !chatInput.trim()} size="sm" className="h-9 px-3">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Core Architecture Topology Graph */}
      <div className="mt-6 glass-card p-6">
        <h3 className="text-sm font-medium text-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
          🧠 TS Compiler API — Dependency Graph with Community Detection
        </h3>
        <DependencyGraphVisualizer repoId={repoId} selectedFile={selectedFile} blastFiles={blastFiles} />
      </div>
    </div>
  );
}
