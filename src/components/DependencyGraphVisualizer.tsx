import { useEffect, useState, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getGraph, getTsGraph } from "@/lib/api";
import { Loader2, Layers, AlertTriangle } from "lucide-react";

interface NodeData {
  id: string;
  label: string;
  type?: string;
  riskLevel?: string;
  community?: "frontend" | "backend" | "shared" | "island";
  isEntryPoint?: boolean;
  inDegree?: number;
  outDegree?: number;
  x?: number;
  y?: number;
}

interface LinkData {
  source: string | NodeData;
  target: string | NodeData;
}

// Community-based color scheme — this is the big visual upgrade
const COMMUNITY_COLORS: Record<string, string> = {
  frontend: "#3B82F6",  // Vivid Blue
  backend:  "#8B5CF6",  // Purple
  shared:   "#6B7280",  // Neutral Gray
  island:   "#EF4444",  // Red (danger — dead code!)
};

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#10B981",
};

export function DependencyGraphVisualizer({
  repoId,
  selectedFile,
  blastFiles,
}: {
  repoId: string;
  selectedFile: string;
  blastFiles: { path: string; depth: number; riskLevel: string }[];
}) {
  const [graphData, setGraphData] = useState<{ nodes: NodeData[]; links: LinkData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [useTsGraph, setUseTsGraph] = useState(true);
  const [communityStats, setCommunityStats] = useState<{
    frontend: number; backend: number; shared: number; islands: number;
  }>({ frontend: 0, backend: 0, shared: 0, islands: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();

  const blastPathSet = useMemo(() => {
    const set = new Set(blastFiles.map(f => f.path));
    if (selectedFile) set.add(selectedFile);
    return set;
  }, [blastFiles, selectedFile]);

  // Observer for responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);

    // Try the new TS Compiler API graph first, fall back to Neo4j graph
    const fetchGraph = useTsGraph
      ? getTsGraph(repoId).then((data) => {
          // Community stats
          setCommunityStats({
            frontend: data.stats.frontendCount,
            backend: data.stats.backendCount,
            shared: data.stats.sharedCount,
            islands: data.stats.islandCount,
          });

          // Render all nodes and edges (max 500 for performance safety)
          const allNodes = data.nodes.slice(0, 500);
          const allNodeIds = new Set(allNodes.map((n) => n.id));

          // Filter edges to only include those between rendered nodes
          const allEdges = data.edges.filter(
            (e) => allNodeIds.has(e.source) && allNodeIds.has(e.target)
          );

          return {
            nodes: allNodes as NodeData[],
            links: allEdges.map((e) => ({ source: e.source, target: e.target })),
          };
        })
      : getGraph(repoId).then((data) => {
          const allNodes = data.nodes.slice(0, 500);
          const allNodeIds = new Set(allNodes.map((n: any) => n.id));
          const allEdges = data.edges.filter(
            (e: any) => allNodeIds.has(e.source) && allNodeIds.has(e.target)
          );
          return {
            nodes: allNodes as NodeData[],
            links: allEdges.map((e: any) => ({ source: e.source, target: e.target })),
          };
        });

    fetchGraph
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.warn("[Graph] TS graph failed, falling back to Neo4j:", err);
        if (useTsGraph) {
          setUseTsGraph(false); // Will retry with Neo4j on next effect
        } else {
          setLoading(false);
        }
      });
  }, [repoId, useTsGraph]);

  // Center on selected node
  useEffect(() => {
    if (graphRef.current && selectedFile && graphData) {
      const node = graphData.nodes.find(n => n.id === selectedFile);
      if (node && node.x !== undefined && node.y !== undefined) {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(3, 1000);
      }
    }
  }, [selectedFile, graphData, blastFiles]);

  if (loading) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-black/40 rounded-xl border border-white/10">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-black/40 rounded-xl border border-white/10 text-muted-foreground text-sm">
        No dependency graph available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-[600px] xl:h-[750px] overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0B]">
      {/* Glow overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.05)_0%,transparent_70%)]" />

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        backgroundColor="transparent"
        minZoom={0.5}
        maxZoom={8}

        // Link Styling
        linkColor={(link: any) => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          if (blastPathSet.has(sourceId) && blastPathSet.has(targetId)) {
            return "rgba(234, 179, 8, 1)"; // Blast radius highlight
          }
          return "rgba(255, 255, 255, 0.8)"; // Bright solid white
        }}
        linkWidth={(link: any) => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          return blastPathSet.has(sourceId) && blastPathSet.has(targetId) ? 3 : 2; // Thicker lines
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link: any) => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          return blastPathSet.has(sourceId) && blastPathSet.has(targetId) ? 2 : 0;
        }}
        linkDirectionalParticleSpeed={0.01}

        // Custom Node Drawing — Community-colored with island pulsing
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isSelected = node.id === selectedFile;
          const isIsland = node.community === "island";
          const communityColor = COMMUNITY_COLORS[node.community || "shared"] || COMMUNITY_COLORS.shared;
          const label = node.label || node.id.split("/").pop();
          const r = isSelected ? 12 : isIsland ? 10 : 8;
          const fontSize = 5;

          // Island pulse effect (breathing glow)
          if (isIsland) {
            const pulse = Math.sin(Date.now() / 400) * 0.3 + 0.7;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.1 * pulse})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 1.5, 0, 2 * Math.PI, false);
            ctx.fillStyle = `rgba(239, 68, 68, ${0.2 * pulse})`;
            ctx.fill();
          }

          // Entry point diamond ring
          if (node.isEntryPoint) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI, false);
            ctx.strokeStyle = "#FBBF24";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Main node circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = communityColor;
          ctx.fill();

          // Selection ring
          if (isSelected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 1.6, 0, 2 * Math.PI, false);
            ctx.strokeStyle = `${communityColor}80`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Inner type abbreviation
          const typeLabel = isIsland ? "🏝" : (node.type || "file").substring(0, 2).toUpperCase();
          ctx.font = `bold ${r * 0.6}px Sans-Serif`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(typeLabel, node.x, node.y);

          // Label underneath
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          ctx.fillStyle = "rgba(10, 10, 11, 0.8)";
          ctx.fillRect(node.x - textWidth / 2 - 2, node.y + r + 2, textWidth + 4, fontSize + 3);
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = isSelected ? "#ffffff" : isIsland ? "#FCA5A5" : "#cbd5e1";
          ctx.fillText(label, node.x, node.y + r + 3);
        }}
      />

      {/* ── Community Legend (top-right) ──────────────────────────────── */}
      {useTsGraph && (
        <div className="absolute top-4 right-4 bg-[#111113]/90 backdrop-blur-md border border-white/10 rounded-lg px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 mb-1">
            <Layers className="w-3.5 h-3.5" />
            Community Detection
          </div>
          {[
            { key: "frontend", label: "Frontend", color: COMMUNITY_COLORS.frontend },
            { key: "backend", label: "Backend", color: COMMUNITY_COLORS.backend },
            { key: "shared", label: "Shared", color: COMMUNITY_COLORS.shared },
            { key: "island", label: "Island (Dead Code)", color: COMMUNITY_COLORS.island },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Island Warning (top-left) ────────────────────────────────── */}
      {communityStats.islands > 0 && (
        <div className="absolute top-4 left-4 bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-red-300">
              {communityStats.islands} Island{communityStats.islands > 1 ? "s" : ""} Detected
            </div>
            <div className="text-[10px] text-red-400/80">
              Orphaned files with zero importers
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom Stats ─────────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between gap-3">
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-blue-400">{communityStats.frontend || graphData.nodes.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">
            {useTsGraph ? "Frontend" : "Connected Entities"}
          </div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-purple-400">{communityStats.backend || graphData.links.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">
            {useTsGraph ? "Backend" : "Relationships"}
          </div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-red-400">{communityStats.islands || blastFiles.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">
            {useTsGraph ? "Islands" : "Blast Radius"}
          </div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-yellow-400">{graphData.links.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">
            Edges
          </div>
        </div>
      </div>
    </div>
  );
}

