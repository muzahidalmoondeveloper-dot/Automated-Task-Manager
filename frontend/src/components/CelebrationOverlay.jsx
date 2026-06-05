import { useEffect, useRef, useState } from "react";

const CONFETTI_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4",
];

const CELEBRATION_SECONDS = 60;

export default function CelebrationOverlay({ taskName, completedByName, onDismiss }) {
  const canvasRef = useRef(null);
  const [secondsLeft, setSecondsLeft] = useState(CELEBRATION_SECONDS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    const particles = Array.from({ length: 140 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight - window.innerHeight,
      w: Math.random() * 11 + 5,
      h: Math.random() * 7 + 3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      vy: Math.random() * 3 + 2,
      vx: Math.random() * 2 - 1,
      rot: Math.random() * 360,
      rotSpeed: Math.random() * 6 - 3,
      opacity: Math.random() * 0.4 + 0.6,
    }));

    let frameId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        if (p.y > canvas.height) {
          p.y = -p.h;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      frameId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss]);

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = (secondsLeft / CELEBRATION_SECONDS) * circumference;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onDismiss}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <div
        className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white px-8 py-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-slate-900">Great job!</h2>
        <p className="mt-2 text-slate-500">
          {completedByName ? (
            <><span className="font-semibold text-slate-700">{completedByName}</span> completed the task</>
          ) : (
            "You completed the task"
          )}
        </p>
        {taskName && (
          <p className="mt-2 break-words font-semibold text-indigo-600">
            &ldquo;{taskName}&rdquo;
          </p>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Continue
        </button>

        <div className="mt-4 flex flex-col items-center gap-1">
          <svg width="54" height="54" className="-rotate-90">
            <circle
              cx="27" cy="27" r={radius}
              fill="none" stroke="#e2e8f0" strokeWidth="4"
            />
            <circle
              cx="27" cy="27" r={radius}
              fill="none"
              stroke="#6366f1"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              style={{ transition: "stroke-dashoffset 0.9s linear" }}
            />
          </svg>
          <p className="text-xs text-slate-400">
            Closes in <span className="font-semibold text-slate-600">{secondsLeft}s</span>
          </p>
        </div>
      </div>
    </div>
  );
}
