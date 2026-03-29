import { DollarSign, ShieldAlert, Cpu, AlertOctagon, TrendingUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const pieData = [
  { name: "Simple → Cheap AI", value: 40 },
  { name: "Complex → Premium AI", value: 60 },
];

const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(210, 100%, 52%)"];

const kpis = [
  {
    label: "AI Routing Savings",
    sublabel: "Track 1.4",
    value: "$12,450",
    change: "+18% vs last month",
    icon: DollarSign,
    accent: "safe" as const,
  },
  {
    label: "System Risk Exposure",
    sublabel: "Core revenue flows",
    value: "18%",
    change: "of revenue at risk",
    icon: ShieldAlert,
    accent: "critical" as const,
  },
  {
    label: "Modules Analyzed",
    sublabel: "This sprint",
    value: "142",
    change: "+23 this week",
    icon: Cpu,
    accent: "primary" as const,
  },
  {
    label: "Critical Fixes Queued",
    sublabel: "Awaiting deployment",
    value: "7",
    change: "3 in auth subsystem",
    icon: AlertOctagon,
    accent: "high" as const,
  },
];

function accentClasses(accent: string) {
  switch (accent) {
    case "safe": return { text: "text-risk-safe", bg: "bg-risk-safe/10", glow: "risk-glow-safe" };
    case "critical": return { text: "text-risk-critical", bg: "bg-risk-critical/10", glow: "risk-glow-critical" };
    case "high": return { text: "text-risk-high", bg: "bg-risk-high/10", glow: "risk-glow-high" };
    default: return { text: "text-primary", bg: "bg-primary/10", glow: "" };
  }
}

export function ExecutiveCommand({ repo }: { repo?: string }) {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Executive Command Center</p>
        <h2 className="text-xl font-semibold text-foreground">Business Risk & ROI Dashboard</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => {
          const ac = accentClasses(kpi.accent);
          return (
            <div key={kpi.label} className={`glass-card p-4 ${ac.glow} hover:scale-[1.01] transition-transform cursor-pointer`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-[10px] text-muted-foreground/60">{kpi.sublabel}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg ${ac.bg} flex items-center justify-center`}>
                  <kpi.icon className={`w-4 h-4 ${ac.text}`} />
                </div>
              </div>
              <p className={`text-2xl font-semibold ${ac.text} mb-1`}>{kpi.value}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {kpi.change}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Path Analysis */}
        <div className="glass-card p-6 border border-risk-critical/20 risk-glow-critical">
          <h3 className="text-xs font-medium text-risk-critical uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertOctagon className="w-3.5 h-3.5" />
            Critical Path Analysis
          </h3>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-risk-critical/5 border border-risk-critical/10">
              <p className="text-sm text-foreground mb-2">
                Module <span className="font-mono text-primary font-medium">auth.js</span> powers{" "}
                <span className="font-medium">Login & Payments</span>.
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                It affects <span className="text-foreground font-semibold">60%</span> of active user traffic.
                Failure here equals <span className="text-risk-critical font-medium">High Revenue Risk</span>.
              </p>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-md bg-risk-critical/20 text-risk-critical text-[10px] font-semibold uppercase tracking-wider">
                  Priority: Fix Immediately
                </span>
                <span className="text-[10px] text-muted-foreground">Est. impact: $2.4M ARR</span>
              </div>
            </div>
            {/* Mini metrics */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Traffic Share", value: "60%" },
                { label: "Revenue Link", value: "$2.4M" },
                { label: "Downtime Cost", value: "$4k/min" },
              ].map((m) => (
                <div key={m.label} className="text-center p-2 rounded-md bg-accent/50">
                  <p className="text-lg font-semibold text-foreground">{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
            AI API Spend by Task Complexity
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 14%, 9%)",
                  border: "1px solid hsl(220, 14%, 16%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
