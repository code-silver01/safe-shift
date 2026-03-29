import { AlertTriangle, Activity, GitBranch } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const modules = [
  { name: "checkout_flow.js", complexity: 92, coupling: 14, status: "Critical", coverage: 12 },
  { name: "legacy_api_v1.js", complexity: 85, coupling: 10, status: "High Risk", coverage: 23 },
  { name: "user_auth.js", complexity: 78, coupling: 8, status: "High Risk", coverage: 45 },
  { name: "payment_processor.ts", complexity: 71, coupling: 6, status: "Medium", coverage: 67 },
  { name: "notification_svc.js", complexity: 45, coupling: 3, status: "Low", coverage: 89 },
];

const chartData = [
  { service: "Checkout", coverage: 12, complexity: 92 },
  { service: "Legacy API", coverage: 23, complexity: 85 },
  { service: "Auth", coverage: 45, complexity: 78 },
  { service: "Payments", coverage: 67, complexity: 71 },
  { service: "Notifications", coverage: 89, complexity: 45 },
];

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

export function TeamHeatmap() {
  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Team Heatmap</p>
        <h2 className="text-xl font-semibold text-foreground">Technical Debt & Risk Hotspots</h2>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {modules.map((mod) => (
          <div
            key={mod.name}
            className={`glass-card p-4 border transition-all hover:scale-[1.01] cursor-pointer ${statusBg(mod.status)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-sm text-foreground">{mod.name}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${statusColor(mod.status)}`}>
                {mod.status}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> Complexity
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-risk-critical transition-all"
                      style={{ width: `${mod.complexity}%` }}
                    />
                  </div>
                  <span className="font-mono text-foreground w-8 text-right">{mod.complexity}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3" /> Coupling
                </span>
                <span className="font-mono text-foreground">{mod.coupling} deps</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Coverage
                </span>
                <span className={`font-mono ${mod.coverage < 50 ? "text-risk-critical" : "text-risk-safe"}`}>
                  {mod.coverage}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="glass-card p-6">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-6">
          Test Coverage vs. Code Complexity
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 16%)" />
            <XAxis
              dataKey="service"
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(220 14% 16%)" }}
            />
            <YAxis
              tick={{ fill: "hsl(215 14% 50%)", fontSize: 12 }}
              axisLine={{ stroke: "hsl(220 14% 16%)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 14% 9%)",
                border: "1px solid hsl(220 14% 16%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="coverage" name="Test Coverage %" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="complexity" name="Complexity Score" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
