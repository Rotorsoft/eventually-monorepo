export function animate(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
) {
  const numEvents = 40;
  const padding = 5; // Margin on top and bottom to avoid cutting events
  const trackSpacing = 40;
  const stringCount =
    (canvas.height * 2) / window.devicePixelRatio / trackSpacing; // Number of horizontal lines (guitar strings)

  // Initialize events
  const events = [...Array(numEvents)].map(() => ({
    x: Math.random() * canvas.width,
    speed: Math.random() * 15 + 5,
    size: Math.random() * 15 + 5,
    track: Math.random() * stringCount
  }));

  // Draw horizontal lines for the guitar strings
  const drawStrings = () => {
    ctx.strokeStyle = "rgba(100, 200, 200, 0.5)";
    for (let i = 0; i < stringCount; i++) {
      const y = padding + i * trackSpacing + trackSpacing;
      ctx.lineWidth = 2 - i * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width / window.devicePixelRatio, y); // Use pixel ratio for proper scaling
      ctx.stroke();
    }
  };

  // Draw a 3D sphere with shading
  const draw3DSphere = ({
    x,
    size,
    track
  }: {
    x: number;
    size: number;
    track: number;
  }) => {
    const radius = size / 2;
    const y = (track + 1) * trackSpacing + padding;
    const gradient = ctx.createRadialGradient(
      x - radius / 3,
      y - radius / 3,
      radius / 6,
      x,
      y,
      radius
    );

    gradient.addColorStop(0, "rgba(249, 115, 22, 1.0)"); // Bright center
    gradient.addColorStop(0.7, "rgba(249, 115, 22, 0.8)");
    gradient.addColorStop(1, "rgba(249, 115, 22, 0.6)"); // Darker at edges

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  };

  const animate = () => {
    if (!ctx || !canvas) return;
    ctx.clearRect(
      0,
      0,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio
    );

    // Draw the guitar strings as horizontal lines
    drawStrings();

    events.forEach((e) => {
      e.x += e.speed;
      if (e.x > canvas.width / window.devicePixelRatio) {
        e.x = -e.size;
        e.track = Math.floor(Math.random() * stringCount);
      }
      draw3DSphere(e);
    });

    requestAnimationFrame(animate);
  };

  return animate;
}
