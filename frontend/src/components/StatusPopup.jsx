import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { playSuccessSound } from "../utils/sound";

function fireConfetti() {
  const burst = (particleRatio, opts) =>
    confetti({
      origin: { y: 0.7 },
      zIndex: 200,
      ...opts,
      particleCount: Math.floor(200 * particleRatio),
    });
  burst(0.25, { spread: 26, startVelocity: 55 });
  burst(0.2, { spread: 60 });
  burst(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  burst(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  burst(0.1, { spread: 120, startVelocity: 45 });
}

const VARIANTS = {
  success: {
    emoji: "🎉",
    title: "Congratulations!",
    message: "Task completed!",
    border: "border-emerald-200",
    accent: "text-emerald-600",
    celebrate: true,
    duration: 3000,
  },
  pending: {
    emoji: "😔",
    title: "Task Pending",
    message: "Please complete it when you can.",
    border: "border-amber-200",
    accent: "text-amber-600",
    celebrate: false,
    duration: 3000,
  },
};

/**
 * Consistent status-change popup:
 *  - success: 🎉 short congratulation + confetti + one chime (auto-hide 3s)
 *  - pending: 😔 gentle pending reminder (auto-hide 3s, no sound)
 * Non-blocking (clicks pass through).
 */
export default function StatusPopup({ variant = "success", taskTitle, onDone }) {
  const conf = VARIANTS[variant] || VARIANTS.success;
  const playedRef = useRef(false);

  useEffect(() => {
    const c = VARIANTS[variant] || VARIANTS.success;
    if (c.celebrate && !playedRef.current) {
      playedRef.current = true;
      playSuccessSound(); // rings once
      fireConfetti();
    }
    const timer = setTimeout(onDone, c.duration);
    return () => clearTimeout(timer);
  }, [variant, onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className={`animate-celebration-pop rounded-2xl border bg-white px-7 py-5 text-center shadow-2xl ${conf.border}`}
      >
        <div className={variant === "success" ? "animate-bounce text-4xl" : "text-4xl"}>
          {conf.emoji}
        </div>
        <h3 className="mt-1.5 text-base font-bold text-slate-800">{conf.title}</h3>
        <p className="mt-0.5 text-sm text-slate-600">{conf.message}</p>
        {taskTitle && (
          <p className={`mt-1 max-w-xs truncate text-xs font-medium ${conf.accent}`}>
            “{taskTitle}”
          </p>
        )}
      </div>
    </div>
  );
}
