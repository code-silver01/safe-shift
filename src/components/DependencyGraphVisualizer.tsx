import { useEffect, useState, useRef, useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { getGraph } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface NodeData {
  id: string;
  label: string;
  type?: string;
  riskLevel?: string;
  x?: number;
  y?: number;
}

interface LinkData {
  source: string | NodeData;
  target: string | NodeData;
}

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444", // Red
  high: "#F97316",     // Orange
  medium: "#EAB308",   // Yellow
  low: "#10B981",      // Green
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
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>();

  // Determine the set of nodes that are in the blast radius (including the selected file)
  const blastPathSet = useMemo(() => {
    const set = new Set(blastFiles.map(f => f.path));
    if (selectedFile) set.add(selectedFile);
    return set;
  }, [blastFiles, selectedFile]);

  // Observer to keep graph dimensions synced to container for landscape/window-fit
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width && height) {
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!repoId) return;
    setLoading(true);
    getGraph(repoId).then((data) => {
      // Calculate node degrees (connections)
      const degrees: Record<string, number> = {};
      data.edges.forEach((e: any) => {
        degrees[e.source] = (degrees[e.source] || 0) + 1;
        degrees[e.target] = (degrees[e.target] || 0) + 1;
      });

      // Sort by connections and take top 20
      const sortedNodes = [...data.nodes].sort((a, b) => (degrees[b.id] || 0) - (degrees[a.id] || 0));
      const topNodes = sortedNodes.slice(0, 20);
      const topNodeIds = new Set(topNodes.map((n: any) => n.id));

      // Filter to induced subgraph (edges between top nodes only)
      const coreEdges = data.edges.filter((e: any) => topNodeIds.has(e.source) && topNodeIds.has(e.target));

      setGraphData({
        nodes: topNodes as NodeData[],
        links: coreEdges.map((e: any) => ({ source: e.source, target: e.target })),
      });
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [repoId]);

  // When selection changes, we might want to center the graph on the selected node
  useEffect(() => {
    if (graphRef.current && selectedFile && graphData) {
      const node = graphData.nodes.find(n => n.id === selectedFile);
      if (node && node.x !== undefined && node.y !== undefined) {
        // Smoothly zoom/pan to the selected file
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
      {/* Glow overlay to simulate the intense dark theme look from reference */}
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
            // High-visibility glowing line for blast path
            return "rgba(234, 179, 8, 1)"; // Solid golden yellow
          }
          return "rgba(255, 255, 255, 0.4)"; // Bright background edges so they are clearly visible
        }}
        linkWidth={(link: any) => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          return blastPathSet.has(sourceId) && blastPathSet.has(targetId) ? 2 : 1; // Thicker lines
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link: any) => {
          const sourceId = typeof link.source === "object" ? link.source.id : link.source;
          const targetId = typeof link.target === "object" ? link.target.id : link.target;
          return blastPathSet.has(sourceId) && blastPathSet.has(targetId) ? 2 : 0;
        }}
        linkDirectionalParticleSpeed={0.01}

        // Custom Node Drawing
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isSelected = node.id === selectedFile;
          const riskColor = RISK_COLORS[node.riskLevel || "low"] || RISK_COLORS.low;
          
          const label = node.label || node.id.split("/").pop();
          const r = isSelected ? 12 : 9; // Large prominent nodes
          const fontSize = 5; // Fixed relative font size so it's always readable when zoomed

          // Draw Node Circle (Solid Color fill)
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = riskColor;
          ctx.fill();

          if (isSelected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            // Outer glow for selection
            ctx.beginPath();
            ctx.arc(node.x, node.y, r * 1.5, 0, 2 * Math.PI, false);
            ctx.strokeStyle = `${riskColor}80`;
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Draw inner icon/text type
          const typeLabel = (node.type || "file").substring(0, 2).toUpperCase();
          ctx.font = `bold ${r * 0.6}px Sans-Serif`;
          ctx.fillStyle = "#ffffff"; // White text inside colored circle
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(typeLabel, node.x, node.y);

          // Draw Label ALWAYS underneath
          ctx.font = `${fontSize}px Sans-Serif`;
          const textWidth = ctx.measureText(label).width;
          
          // Background for text so it stands out over lines
          ctx.fillStyle = "rgba(10, 10, 11, 0.7)";
          ctx.fillRect(node.x - textWidth / 2 - 1, node.y + r + 2, textWidth + 2, fontSize + 2);
          
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = isSelected ? "#ffffff" : "#cbd5e1";
          ctx.fillText(label, node.x, node.y + r + 3);
        }}
      />
      
      {/* Overlay Stats/Legend (Reference Match) */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between gap-4">
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-yellow-500">{graphData.nodes.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">Connected Entities</div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-yellow-500">{graphData.links.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">Relationships</div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-yellow-500">{blastFiles.length}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">Blast Radius Size</div>
        </div>
        <div className="bg-[#111113]/80 backdrop-blur-md border border-white/5 rounded-lg px-4 py-3 flex-1 text-center">
          <div className="text-2xl font-bold text-yellow-500">{blastFiles.length > 0 ? Math.max(...blastFiles.map(f => f.depth)) : 0}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-widest mt-0.5">Depth Levels</div>
        </div>
      </div>
    </div>
  );
}
