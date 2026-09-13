import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
};

export function TensorServeStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let animationFrame = 0;
    let time = 0;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /*
       * Star density scales with the viewport.
       *
       * Larger screens = more stars.
       * Smaller screens = fewer stars.
       */
      const count = Math.round(
        (width * height) / 7500,
      );

      stars = Array.from(
        { length: count },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,

          /*
           * Most stars stay very subtle.
           * A small percentage are slightly larger.
           */
          r:
            Math.random() < 0.15
              ? 1.4
              : 0.9,

          /*
           * Random phase prevents synchronized
           * flickering.
           */
          phase:
            Math.random() *
            Math.PI *
            2,

          /*
           * Each star breathes at a slightly
           * different speed.
           */
          speed:
            0.6 +
            Math.random() * 1.2,
        }),
      );

      drawStars();
    };

    const drawStars = () => {
      ctx.clearRect(
        0,
        0,
        width,
        height,
      );

      stars.forEach((star) => {
        const twinkle = reducedMotion.matches
          ? 0.25
          : 0.08 +
            Math.abs(
              Math.sin(
                time *
                  0.02 *
                  star.speed +
                  star.phase,
              ),
            ) *
              0.35;

        ctx.beginPath();

        ctx.arc(
          star.x,
          star.y,
          star.r,
          0,
          Math.PI * 2,
        );

        ctx.fillStyle =
          `rgba(255,255,255,${twinkle.toFixed(2)})`;

        ctx.fill();
      });

      if (!reducedMotion.matches) {
        time++;

        animationFrame =
          requestAnimationFrame(drawStars);
      }
    };

    const handleMotionPreferenceChange = () => {
      cancelAnimationFrame(animationFrame);

      time = 0;

      drawStars();
    };

    reducedMotion.addEventListener(
      "change",
      handleMotionPreferenceChange,
    );

    resize();

    window.addEventListener(
      "resize",
      resize,
    );

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "resize",
        resize,
      );

      reducedMotion.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ts-starfield-canvas"
      aria-hidden="true"
    />
  );
}