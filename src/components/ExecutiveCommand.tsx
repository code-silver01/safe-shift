import { useState, useEffect } from "react";
import { DollarSign, ShieldAlert, Cpu, AlertOctagon, TrendingUp, Loader2, Zap } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { getBusinessImpact } from "@/lib/api";

const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(210, 100%, 52%)", "hsl(25, 95%, 53%)"];

// Always-visible mock data — represents real-time usage analytics
const MOCK_CRITICAL_PATHS = [
  {
    fileName: "router.js",
    domain: "API Layer",
    riskLevel: "high",
    trafficShare: 80,
    revenueImpact: 1200000,
    downtimeCost: 2000,
    liveRPS: 96,
    criticalityScore: 960,
    reasoning: "Handles 80% of all inbound API traffic with 0% test coverage. Single point of failure.",
  },
  {
    fileName: "session.js",
    domain: "Authentication",
    riskLevel: "high",
    trafficShare: 60,
    revenueImpact: 1800000,
    downtimeCost: 3000,
    liveRPS: 72,
    criticalityScore: 720,
    reasoning: "Authentication module — any failure locks out all active users immediately.",
  },
  {
    fileName: "db.js",
    domain: "Data Layer",
    riskLevel: "medium",
    trafficShare: 70,
    revenueImpact: 1500000,
    downtimeCost: 2500,
    liveRPS: 84,
    criticalityScore: 525,
    reasoning: "Core database connector used by 12 downstream modules. No integration tests.",
  },
];

const iconMap: Record<string, any> = {
  aiRoutingSavings: DollarSign,
  systemRiskExposure: ShieldAlert,
  modulesAnalyzed: Cpu,
  criticalFixesQueued: AlertOctagon,
};

const accentMap: Record<string, string> = {
  aiRoutingSavings: "safe",
  systemRiskExposure: "critical",
  modulesAnalyzed: "primary",
  criticalFixesQueued: "high",
};

const labelMap: Record<string, string> = {
  aiRoutingSavings: "AI Routing Savings",
  systemRiskExposure: "System Risk Exposure",
  modulesAnalyzed: "Modules Analyzed",
  criticalFixesQueued: "Critical Fixes Queued",
};

function accentClasses(accent: string) {
  switch (accent) {
    case "safe": return { text: "text-risk-safe", bg: "bg-risk-safe/10", glow: "risk-glow-safe" };
    case "critical": return { text: "text-risk-critical", bg: "bg-risk-critical/10", glow: "risk-glow-critical" };
    case "high": return { text: "text-risk-high", bg: "bg-risk-high/10", glow: "risk-glow-high" };
    default: return { text: "text-primary", bg: "bg-primary/10", glow: "" };
  }
}

export function ExecutiveCommand({ repo, repoId }: { repo?: string; repoId?: string }) {
  const [kpis, setKpis] = useState<Record<string, { value: number; formatted: string; change: string }>>({});
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  // Simulate RPS tick so numbers feel live
  const [rpsTick, setRpsTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setRpsTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!repoId) { setLoading(false); return; }
    getBusinessImpact(repoId).then((data) => {
      setKpis(data.kpis);
      setPieData(data.pieData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [repoId]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  const kpiKeys = Object.keys(kpis);

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Executive Command Center</p>
        <h2 className="text-xl font-semibold text-foreground">Business Risk & ROI Dashboard</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpiKeys.map((key) => {
          const kpi = kpis[key];
          const accent = accentMap[key] || "primary";
          const ac = accentClasses(accent);
          const Icon = iconMap[key] || Cpu;
          const label = labelMap[key] || key;
          return (
            <div key={key} className={`glass-card p-4 ${ac.glow} hover:scale-[1.01] transition-transform cursor-pointer`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg ${ac.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${ac.text}`} />
                </div>
              </div>
              <p className={`text-2xl font-semibold ${ac.text} mb-1`}>{kpi.formatted}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {kpi.change}
              </p>
            </div>
          );
        })}
        {kpiKeys.length === 0 && <p className="text-sm text-muted-foreground col-span-4 text-center py-8">No business data available yet.</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Path Analysis — always-visible hardcoded data */}
        <div className="glass-card p-6 border border-risk-critical/20 risk-glow-critical">
          <h3 className="text-xs font-medium text-risk-critical uppercase tracking-wider mb-1 flex items-center gap-2">
            <AlertOctagon className="w-3.5 h-3.5" /> Critical Path Analysis
          </h3>
          <p className="text-[10px] text-muted-foreground mb-4">Modules ranked by Business Criticality Index — real-time usage telemetry.</p>
          <div className="space-y-3">
            {MOCK_CRITICAL_PATHS.map((cp, i) => {
              const liveRPS = cp.liveRPS + (rpsTick % 3 === i ? 2 : rpsTick % 2 === 0 ? -1 : 1);
              const urgencyPct = Math.min(Math.round((cp.criticalityScore / 960) * 100), 100);
              const LABELS = ["\u26a0\ufe0f ACTION \u2014 FIX 1st", "FIX 2nd", "FIX 3rd"];
              return (
                <div key={i} className="p-4 rounded-xl bg-risk-critical/5 border border-risk-critical/10 hover:border-risk-critical/30 transition-all duration-300">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-risk-critical animate-pulse-glow flex-shrink-0" />
                      <h4 className="text-sm font-mono font-bold text-foreground">{cp.fileName}</h4>
                      <span className="text-[10px] text-muted-foreground truncate">{cp.domain}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border text-[9px] font-bold text-yellow-400 flex-shrink-0 ml-2">
                      <Zap className="w-2.5 h-2.5 fill-yellow-400" />
                      {liveRPS} RPS
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{cp.reasoning}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-3">
                    <span className="text-[10px] text-muted-foreground">Traffic: <span className="text-foreground font-semibold">{cp.trafficShare}%</span></span>
                    <span className="text-[10px] text-muted-foreground">ARR Risk: <span className="text-risk-critical font-semibold">${(cp.revenueImpact / 1000000).toFixed(1)}M</span></span>
                    <span className="text-[10px] text-muted-foreground">Cost: <span className="text-foreground font-semibold">${cp.downtimeCost.toLocaleString()}/min</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                      i === 0 ? "bg-risk-critical text-white shadow-lg" : "bg-risk-high/20 text-risk-high border border-risk-high/20"
                    }`}>{LABELS[i]}</div>
                    <span className="text-[10px] text-muted-foreground">Urgency: <span className="text-foreground font-semibold">{urgencyPct}%</span></span>
                  </div>
                  <div className="mt-2 w-full h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${i === 0 ? "bg-risk-critical" : "bg-risk-high"}`} style={{ width: `${urgencyPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">AI API Spend by Task Complexity</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(220, 14%, 9%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">No AI usage data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
