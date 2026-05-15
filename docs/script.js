/* global document, window */

const canvas = document.querySelector("#signal-field");
const context = canvas.getContext("2d");
const colors = ["#1f7a4d", "#197985", "#d89424", "#c94d35"];
const labels = ["#trust", "[[Session]]", "folder:notes", "2025 Q4", "#design", "[[Research]]"];
let width = 0;
let height = 0;
let points = [];

function resize() {
  const scale = window.devicePixelRatio || 1;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  seedPoints();
}

function seedPoints() {
  const count = Math.max(22, Math.floor(width / 48));
  points = Array.from({ length: count }, (_, index) => ({
    color: colors[index % colors.length],
    label: labels[index % labels.length],
    phase: Math.random() * Math.PI * 2,
    radius: 3 + Math.random() * 4,
    speed: 0.002 + Math.random() * 0.004,
    x: width * (0.28 + Math.random() * 0.68),
    y: height * (0.12 + Math.random() * 0.68),
  }));
}

function draw(time) {
  context.clearRect(0, 0, width, height);
  context.lineWidth = 1;

  const moved = points.map((point) => ({
    ...point,
    x: point.x + Math.cos(time * point.speed + point.phase) * 14,
    y: point.y + Math.sin(time * point.speed + point.phase) * 18,
  }));

  for (let i = 0; i < moved.length; i += 1) {
    for (let j = i + 1; j < moved.length; j += 1) {
      const a = moved[i];
      const b = moved[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 170) {
        context.strokeStyle = `rgba(22, 32, 27, ${0.12 * (1 - distance / 170)})`;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }
    }
  }

  for (const point of moved) {
    context.fillStyle = point.color;
    context.beginPath();
    context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    context.fill();

    if (width > 760 && point.x > width * 0.56) {
      context.fillStyle = "rgba(22, 32, 27, 0.64)";
      context.font =
        '600 13px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      context.fillText(point.label, point.x + 10, point.y + 4);
    }
  }

  window.requestAnimationFrame(draw);
}

window.addEventListener("resize", resize);
resize();
window.requestAnimationFrame(draw);
