import { useEffect, useRef, useState } from "react";

export function TensorServeOrb() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;

    if (!stage || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let width = 0;
    let height = 0;
    let radius = 0;

    const resize = () => {
      const rect = stage.getBoundingClientRect();

      width = rect.width;
      height = rect.height;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      radius = Math.min(width, height) * 0.34;
    };

    resize();

    window.addEventListener("resize", resize);

    /*
     * Fibonacci sphere
     *
     * 900 points distributed across a real sphere surface.
     */
    const POINT_COUNT = 900;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    const points = Array.from(
      { length: POINT_COUNT },
      (_, i) => {
        const y = 1 - (i / (POINT_COUNT - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;

        return {
          ox: Math.cos(theta) * radiusAtY,
          oy: y,
          oz: Math.sin(theta) * radiusAtY,
          size: 0.55 + Math.random() * 1.05,
        };
      },
    );

    let rotationY = 0.4;
    let rotationX = -0.15;

    const IDLE_SPIN = 0.001;

    let velocityY = IDLE_SPIN;
    let velocityX = 0;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const rotatePoint = (point: (typeof points)[number]) => {
      // Y rotation
      const x =
        point.ox * Math.cos(rotationY) +
        point.oz * Math.sin(rotationY);

      const z =
        -point.ox * Math.sin(rotationY) +
        point.oz * Math.cos(rotationY);

      const y = point.oy;

      // X rotation
      const y2 =
        y * Math.cos(rotationX) -
        z * Math.sin(rotationX);

      const z2 =
        y * Math.sin(rotationX) +
        z * Math.cos(rotationX);

      return {
        x,
        y: y2,
        z: z2,
      };
    };

    let animationFrame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      /*
       * Perspective strength.
       * Lower values = stronger 3D bulge.
       */
      const focal = 3.8;

      /*
       * Soft sphere body underneath the particles.
       */
      const coreRadius = radius * 0.94;

      const gradient = ctx.createRadialGradient(
        centerX - coreRadius * 0.32,
        centerY - coreRadius * 0.38,
        coreRadius * 0.1,
        centerX,
        centerY,
        coreRadius,
      );

      gradient.addColorStop(
        0,
        "rgba(220, 200, 255, 0.9)",
      );

      gradient.addColorStop(
        0.35,
        "rgba(150, 100, 255, 0.55)",
      );

      gradient.addColorStop(
        0.7,
        "rgba(70, 40, 140, 0.35)",
      );

      gradient.addColorStop(
        1,
        "rgba(10, 5, 25, 0.15)",
      );

      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        coreRadius,
        0,
        Math.PI * 2,
      );

      ctx.fillStyle = gradient;
      ctx.fill();

      /*
       * Project every point into 2D.
       * Sort by Z so distant points render first.
       */
      const projected = points
        .map((point) => {
          const rotated = rotatePoint(point);

          const scale = 1 + rotated.z * 0.18;

          return {
            screenX:
              centerX +
              rotated.x *
                radius *
                scale,

            screenY:
              centerY +
              rotated.y *
                radius *
                scale,

            scale,
            z: rotated.z,
            size: point.size,
          };
        })
        .sort((a, b) => a.z - b.z);

      projected.forEach((point) => {
        /*
         * Far side = smaller + darker.
         * Near side = larger + brighter.
         */
        const depth =
          (point.z + 1) / 2;

        const alpha =
          0.15 + depth * 0.7;

        const pointRadius =
          point.size *
          (0.5 + depth * 0.9);

        ctx.beginPath();

        ctx.arc(
          point.screenX,
          point.screenY,
          pointRadius,
          0,
          Math.PI * 2,
        );

        ctx.fillStyle =
          `rgba(255,255,255,${alpha.toFixed(2)})`;

        ctx.fill();
      });

      /*
       * Very subtle sphere rim.
       */
      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        coreRadius,
        0,
        Math.PI * 2,
      );

      ctx.strokeStyle =
        "rgba(200,180,255,0.18)";

      ctx.lineWidth = 1.5;

      ctx.stroke();

      /*
       * Idle rotation.
       */
      if (!dragging) {
        rotationY += velocityY;
        rotationX += velocityX;

        velocityX *= 0.94;

        velocityY =
          velocityY * 0.985 +
          IDLE_SPIN * 0.015;
      } else {
        rotationY += velocityY;
        rotationX += velocityX;
      }

      animationFrame =
        requestAnimationFrame(draw);
    };

    draw();

    const getPointer = (event: PointerEvent) => ({
      x: event.clientX,
      y: event.clientY,
    });

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      dragging = true;

      const pointer =
        getPointer(event);

      lastX = pointer.x;
      lastY = pointer.y;

      velocityX = 0;
      velocityY = 0;

      stage.setPointerCapture(
        event.pointerId,
      );

      setInteracted(true);
    };

    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      if (!dragging) return;

      const pointer =
        getPointer(event);

      const dx =
        pointer.x - lastX;

      const dy =
        pointer.y - lastY;

      rotationY += dx * 0.012;

      rotationX -= dy * 0.012;

      rotationX = Math.max(
        -1.1,
        Math.min(1.1, rotationX),
      );

      velocityY = dx * 0.012;
      velocityX = -dy * 0.012;

      lastX = pointer.x;
      lastY = pointer.y;
    };

    const handlePointerUp = () => {
      dragging = false;

      velocityY = Math.max(
        -0.25,
        Math.min(0.25, velocityY),
      );

      velocityX = Math.max(
        -0.15,
        Math.min(0.15, velocityX),
      );
    };

    stage.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    stage.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    stage.addEventListener(
      "pointerup",
      handlePointerUp,
    );

    stage.addEventListener(
      "pointercancel",
      handlePointerUp,
    );

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "resize",
        resize,
      );

      stage.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );

      stage.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      stage.removeEventListener(
        "pointerup",
        handlePointerUp,
      );

      stage.removeEventListener(
        "pointercancel",
        handlePointerUp,
      );
    };
  }, []);

  return (
    <div className="ts-orb-wrapper">
      <div className="ts-orb-stage" ref={stageRef}>
        <div className="ts-orb-glow" />

        <div className="ts-orb-ring ts-orb-ring-one" />
        <div className="ts-orb-ring ts-orb-ring-two" />

        <canvas
          ref={canvasRef}
          className="ts-orb-canvas"
        />

        {!interacted && (
          <div className="ts-orb-hint">
            
          </div>
        )}
      </div>

      <div className="ts-orb-caption">
        <span>TENSORSERVE</span>
        <small>
          LLM INFERENCE · PERFORMANCE
        </small>
      </div>
    </div>
  );
}