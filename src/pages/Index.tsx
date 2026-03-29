import { useState, useCallback } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { RepoInput } from "@/components/RepoInput";
import { AnalyzingScreen } from "@/components/AnalyzingScreen";
import { AppSidebar } from "@/components/AppSidebar";
import { DeveloperSandbox } from "@/components/DeveloperSandbox";
import { TeamHeatmap } from "@/components/TeamHeatmap";
import { ExecutiveCommand } from "@/components/ExecutiveCommand";

type AppPhase = "splash" | "input" | "analyzing" | "dashboard";
type View = "developer" | "heatmap" | "executive";

const Index = () => {
  const [phase, setPhase] = useState<AppPhase>("splash");
  const [repo, setRepo] = useState("");
  const [activeView, setActiveView] = useState<View>("developer");

  const handleSplashComplete = useCallback(() => setPhase("input"), []);
  const handleAnalyze = useCallback((r: string) => {
    setRepo(r);
    setPhase("analyzing");
  }, []);
  const handleAnalysisComplete = useCallback(() => setPhase("dashboard"), []);

  if (phase === "splash") return <SplashScreen onComplete={handleSplashComplete} />;
  if (phase === "input") return <RepoInput onAnalyze={handleAnalyze} />;
  if (phase === "analyzing") return <AnalyzingScreen repo={repo} onComplete={handleAnalysisComplete} />;

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} repo={repo} />
      {activeView === "developer" && <DeveloperSandbox repo={repo} />}
      {activeView === "heatmap" && <TeamHeatmap repo={repo} />}
      {activeView === "executive" && <ExecutiveCommand repo={repo} />}
    </div>
  );
};

export default Index;
