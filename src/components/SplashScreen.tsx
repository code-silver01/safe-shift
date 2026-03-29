import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const phases = [
    "Initializing threat detection…",
    "Loading analysis modules…",
    "Calibrating risk engine…",
    "System ready.",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 600);
          return 100;
        }
        return p + 1.2;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [onComplete]);

  useEffect(() => {
    if (progress < 25) setPhase(0);
    else if (progress < 55) setPhase(1);
    else if (progress < 85) setPhase(2);
    else setPhase(3);
  }, [progress]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Pulsing rings */}
      <div className="relative mb-10">
        <div className="absolute inset-0 -m-8 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute inset-0 -m-16 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center backdrop-blur-sm">
          <Shield className="w-9 h-9 text-primary" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">SafeShift</h1>
      <p className="text-xs text-muted-foreground tracking-[0.3em] uppercase mb-10">Strategic Engineering Intelligence</p>

      {/* Progress bar */}
      <div className="w-64">
        <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-primary transition-all duration-100 ease-linear"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground font-mono">{phases[phase]}</p>
          <p className="text-xs text-muted-foreground font-mono">{Math.min(Math.round(progress), 100)}%</p>
        </div>
      </div>

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        style={{
          top: `${30 + (progress * 0.4)}%`,
          transition: "top 0.1s linear",
        }}
      />
    </div>
  );
}
