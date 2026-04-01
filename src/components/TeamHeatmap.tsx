import { useState, useEffect } from "react";
import { AlertTriangle, Activity, GitBranch, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getRiskScores } from "@/lib/api";

function statusColor(status: string) {
  if (status === "Critical") return "text-risk-critical";
  if (status === "High Risk") return "text-risk-high";
  if (status === "Medium") return "text-risk-medium";
  return "text-risk-safe";
}

function statusBg(status: string) {
  if (status === "Critical") return "bg-risk-critical/10 border-risk-critical/20";
  if (status === "High Risk") return "bg-risk-high/10 border-risk-high/20";
  if (status === "Medium") return "bg-risk-medium/10 border-risk-medium/20";
  return "bg-risk-safe/10 border-risk-safe/20";
}

export function TeamHeatmap({ repo, repoId }: { repo?: string; repoId?: string }) {
  const [modules, setModules] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    getRiskScores(repoId).then((data) => {
      setModules(data.topRiskFiles.map(f => ({
        name: f.name, complexity: f.complexity, coupling: f.imports,
        status: f.riskLevel === "critical" ? "Critical" : f.riskLevel === "high" ? "High Risk" : f.riskLevel === "medium" ? "Medium" : "Low",
        coverage: f.coverage,
      })));
      setChartData(data.chartData);
      setSummary(data.summary);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [repoId]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Team Heatmap</p>
        <h2 className="text-xl font-semibold text-foreground">Technical Debt & Risk Hotspots</h2>
        {summary && (
          <div className="flex gap-4 mt-3">
            <span className="text-xs text-muted-foreground">Files: <span className="text-foreground font-medium">{summary.totalFiles}</span></span>
            <span className="text-xs text-risk-critical">Critical: <span className="font-medium">{summary.critical}</span></span>
            <span className="text-xs text-risk-high">High: <span className="font-medium">{summary.high}</span></span>
            <span className="text-xs text-muted-foreground">Avg Complexity: <span className="text-foreground font-medium">{summary.avgComplexity}</span></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {modules.map((mod) => (
          <div key={mod.name} className={`glass-card p-4 border transition-all hover:scale-[1.01] cursor-pointer ${statusBg(mod.status)}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-sm text-foreground truncate">{mod.name}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider shrink-0 ml-2 ${statusColor(mod.status)}`}>{mod.status}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="w-3 h-3" /> Complexity</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-accent">
                    <div className="h-full rounded-full bg-risk-critical transition-all" style={{ width: `${Math.min(mod.complexity, 100)}%` }} />
                  </div>
                  <span className="font-mono text-foreground w-8 text-right">{mod.complexity}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><GitBranch className="w-3 h-3" /> Coupling</span>
                <span className="font-mono text-foreground">{mod.coupling} deps</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Coverage</span>
                <span className={`font-mono ${mod.coverage < 50 ? "text-risk-critical" : "text-risk-safe"}`}>{mod.coverage}%</span>
              </div>
            </div>
          </div>
        ))}
        {modules.length === 0 && <p className="text-sm text-muted-foreground col-span-3 text-center py-8">No risk data available yet.</p>}
      </div>

      {chartData.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-6">Test Coverage vs. Code Complexity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
              <XAxis dataKey="service" tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={{ stroke: "hsl(220 14% 16%)" }} />
              <YAxis tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }} axisLine={{ stroke: "hsl(220 14% 16%)" }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(220 14% 9%)", border: "1px solid hsl(220 14% 16%)", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="coverage" name="Test Coverage %" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="complexity" name="Complexity Score" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
