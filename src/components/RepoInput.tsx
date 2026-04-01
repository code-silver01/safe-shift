import { useState } from "react";
import { GitBranch, ArrowRight, Search, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeRepo } from "@/lib/api";

interface RepoInputProps {
  onAnalyze: (repo: string, repoId: string) => void;
}

const suggestions = [
  { name: "vercel/next.js", desc: "React framework for production" },
  { name: "facebook/react", desc: "Library for building UIs" },
  { name: "microsoft/vscode", desc: "Code editor" },
];

export function RepoInput({ onAnalyze }: RepoInputProps) {
  const [repo, setRepo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = repo.trim();
    if (!trimmed) {
      setError("Please enter a repository.");
      return;
    }
    const match = trimmed.match(/(?:github\.com\/)?([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (!match) {
      setError("Enter a valid repo (e.g. owner/repo or a GitHub URL).");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const result = await analyzeRepo(match[1]);
      onAnalyze(result.name, result.id);
    } catch (err: any) {
      setError(err.message || "Failed to start analysis. Is the backend running?");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Search className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Analyze a Repository</h2>
          <p className="text-sm text-muted-foreground">Enter a GitHub repository to scan for risks, complexity, and technical debt.</p>
        </div>
        <div className="glass-card p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Repository</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={repo}
                  onChange={(e) => { setRepo(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
                  placeholder="owner/repo or GitHub URL"
                  className="pl-10 h-11 bg-background border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                  disabled={loading}
                />
              </div>
              <Button onClick={handleSubmit} disabled={loading} className="h-11 px-5 bg-primary hover:bg-primary/90 text-primary-foreground">
                {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...</> : <>Analyze <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
            {error && <p className="text-xs text-risk-critical">{error}</p>}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  onClick={() => { setRepo(s.name); setError(""); }}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent/80 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <Folder className="w-3 h-3" /> {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
