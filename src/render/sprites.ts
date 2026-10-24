/**
 * Small vector icons drawn with the canvas API (no emoji: they render differently on every
 * system). Each sprite is drawn centred on (0,0) in a box of about `s` pixels.
 */
type Ctx = CanvasRenderingContext2D;

const OUT = "#1a1410";

function shape(c: Ctx, fill: string, path: () => void, line = 2) {
  c.beginPath();
  path();
  c.fillStyle = fill;
  c.fill();
  if (line) {
    c.lineWidth = line;
    c.strokeStyle = OUT;
    c.stroke();
  }
}

function star(c: Ctx, r: number, inner = 0.45, n = 5) {
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  c.closePath();
}

function label(c: Ctx, text: string, size: number, color: string, y = 0) {
  c.font = `${size}px Bungee, Impact, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(text, 0, y);
}

const SPRITES: Record<string, (c: Ctx, s: number) => void> = {
  unicorn(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#fbf3ff", () => c.ellipse(-2, 4, 15, 9, 0, 0, Math.PI * 2));
    shape(c, "#fbf3ff", () => {
      c.moveTo(8, 0);
      c.quadraticCurveTo(14, -14, 20, -12);
      c.lineTo(22, -4);
      c.quadraticCurveTo(16, -4, 14, 4);
      c.closePath();
    });
    shape(c, "#ffd34a", () => {
      c.moveTo(18, -13);
      c.lineTo(26, -24);
      c.lineTo(21, -11);
      c.closePath();
    }, 1.5);
    c.strokeStyle = "#ff6fae";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(10, -6);
    c.quadraticCurveTo(4, -14, -4, -6);
    c.stroke();
    c.strokeStyle = "#7ad0ff";
    c.beginPath();
    c.moveTo(-16, 2);
    c.quadraticCurveTo(-24, -4, -22, 10);
    c.stroke();
    c.fillStyle = OUT;
    for (const x of [-12, -5, 3, 9]) c.fillRect(x, 11, 3, 8);
    c.beginPath();
    c.arc(17, -7, 1.5, 0, Math.PI * 2);
    c.fill();
  },
  books(c, s) {
    const u = s / 40;
    c.scale(u, u);
    const cols = ["#c8102e", "#1d3fa0", "#2e7d32", "#f2b632"];
    cols.forEach((col, i) => shape(c, col, () => c.rect(-16 + (i % 2) * 3, 10 - i * 8, 32, 7), 1.5));
    c.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) c.fillRect(12 + (i % 2) * 3, 11 - i * 8, 3, 5);
  },
  banknote(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(-0.15);
    shape(c, "#9fd38a", () => c.roundRect(-18, -10, 36, 20, 3));
    c.strokeStyle = "#4f8a3a";
    c.lineWidth = 1.5;
    c.strokeRect(-14, -6, 28, 12);
    label(c, "€", 14, "#2f6a24", 1);
  },
  watch(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#c9a227", () => c.rect(-6, -18, 12, 36), 1.5);
    shape(c, "#ffd94a", () => c.arc(0, 0, 12, 0, Math.PI * 2));
    shape(c, "#fffbe8", () => c.arc(0, 0, 8.5, 0, Math.PI * 2), 1.2);
    c.strokeStyle = OUT;
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -6);
    c.moveTo(0, 0);
    c.lineTo(4, 2);
    c.stroke();
  },
  note(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.fillStyle = "#2a2a3a";
    c.strokeStyle = "#2a2a3a";
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(-6, 10);
    c.lineTo(-6, -14);
    c.lineTo(12, -18);
    c.lineTo(12, 6);
    c.stroke();
    c.beginPath();
    c.ellipse(-10, 11, 6, 4.5, -0.4, 0, Math.PI * 2);
    c.ellipse(8, 7, 6, 4.5, -0.4, 0, Math.PI * 2);
    c.fill();
  },
  toolbox(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "none", () => {
      c.moveTo(-7, -8);
      c.lineTo(-7, -14);
      c.lineTo(7, -14);
      c.lineTo(7, -8);
    }, 3);
    shape(c, "#d6402c", () => c.roundRect(-18, -8, 36, 22, 3));
    c.fillStyle = "#9a2a1a";
    c.fillRect(-18, -2, 36, 3);
    shape(c, "#e8c04a", () => c.rect(-4, -4, 8, 6), 1.2);
  },
  apple(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#d8282a", () => {
      c.moveTo(0, -8);
      c.bezierCurveTo(-24, -20, -22, 22, 0, 16);
      c.bezierCurveTo(22, 22, 24, -20, 0, -8);
    });
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.beginPath();
    c.ellipse(-8, -2, 3, 6, 0.3, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#5a3a1a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, -8);
    c.lineTo(2, -16);
    c.stroke();
    shape(c, "#3fa34a", () => c.ellipse(8, -15, 6, 3, -0.5, 0, Math.PI * 2), 1.2);
  },
  coin(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f2c230", () => c.arc(0, 0, 14, 0, Math.PI * 2));
    c.strokeStyle = "#b8871a";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 10, 0, Math.PI * 2);
    c.stroke();
    label(c, "1", 13, "#9a6a10", 1);
  },
  baguette(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(-0.5);
    shape(c, "#e0a85a", () => c.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2));
    c.strokeStyle = "#a86a2a";
    c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(i * 7 - 3, -3);
      c.lineTo(i * 7 + 3, 3);
      c.stroke();
    }
  },
  heart(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ff4f8a", () => {
      c.moveTo(0, 14);
      c.bezierCurveTo(-26, -4, -12, -24, 0, -8);
      c.bezierCurveTo(12, -24, 26, -4, 0, 14);
    });
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.ellipse(-8, -7, 3, 4, -0.5, 0, Math.PI * 2);
    c.fill();
  },
  newspaper(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(0.12);
    shape(c, "#f4f1e6", () => c.rect(-18, -14, 36, 28));
    c.fillStyle = OUT;
    c.fillRect(-14, -10, 28, 5);
    c.fillStyle = "#8a8a8a";
    for (let i = 0; i < 4; i++) c.fillRect(-14, -2 + i * 4, i === 3 ? 14 : 28, 2);
    c.fillStyle = "#c8102e";
    c.fillRect(4, 2, 10, 8);
  },
  rocket(c, s) {
    const u = s / 60;
    c.scale(u, u);
    c.rotate(Math.PI);
    shape(c, "#e8e8ee", () => {
      c.moveTo(0, -30);
      c.quadraticCurveTo(14, -14, 10, 18);
      c.lineTo(-10, 18);
      c.quadraticCurveTo(-14, -14, 0, -30);
    });
    shape(c, "#3a7bd5", () => c.arc(0, -6, 5, 0, Math.PI * 2), 1.5);
    shape(c, "#c8102e", () => {
      c.moveTo(-10, 8);
      c.lineTo(-18, 22);
      c.lineTo(-9, 18);
      c.closePath();
      c.moveTo(10, 8);
      c.lineTo(18, 22);
      c.lineTo(9, 18);
      c.closePath();
    }, 1.5);
    c.fillStyle = "#ffb02e";
    c.beginPath();
    c.moveTo(-7, 19);
    c.quadraticCurveTo(0, 40, 7, 19);
    c.fill();
  },
  pingpong(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ffffff", () => c.arc(0, 0, 12, 0, Math.PI * 2));
    c.fillStyle = "rgba(0,0,0,0.12)";
    c.beginPath();
    c.arc(3, 3, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ff8a2a";
    c.font = "9px Bungee, Impact";
    c.textAlign = "center";
    c.fillText("CN", 0, 3);
  },
  scales(c, s) {
    const u = s / 120;
    c.scale(u, u);
    shape(c, "#e3b23c", () => c.rect(-4, -50, 8, 90), 2.5);
    shape(c, "#e3b23c", () => c.rect(-46, -46, 92, 7), 2.5);
    shape(c, "#c9a227", () => c.rect(-26, 36, 52, 10), 2.5);
    for (const x of [-40, 40]) {
      c.strokeStyle = "#8a6a1a";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, -40);
      c.lineTo(x - 18, 0);
      c.moveTo(x, -40);
      c.lineTo(x + 18, 0);
      c.stroke();
      shape(c, "#ffd94a", () => {
        c.moveTo(x - 22, 0);
        c.quadraticCurveTo(x, 18, x + 22, 0);
        c.closePath();
      }, 2.5);
    }
  },
  train(c, s) {
    const u = s / 150;
    c.scale(u, u);
    shape(c, "#e9edf3", () => {
      c.moveTo(-70, 30);
      c.lineTo(-70, -30);
      c.lineTo(30, -30);
      c.quadraticCurveTo(75, -28, 75, 30);
      c.closePath();
    }, 3);
    c.fillStyle = "#d7262e";
    c.fillRect(-70, 8, 140, 8);
    c.fillStyle = "#1d3fa0";
    c.fillRect(-70, 16, 140, 6);
    c.fillStyle = "#2a3a55";
    for (let i = 0; i < 4; i++) c.fillRect(-62 + i * 24, -20, 18, 16);
    c.beginPath();
    c.moveTo(38, -24);
    c.quadraticCurveTo(64, -20, 66, -2);
    c.lineTo(38, -2);
    c.fill();
    c.fillStyle = OUT;
    for (const x of [-50, -20, 20, 50]) {
      c.beginPath();
      c.arc(x, 32, 8, 0, Math.PI * 2);
      c.fill();
    }
  },
  camera(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#2a2a33", () => c.roundRect(-16, -9, 32, 22, 4));
    shape(c, "#2a2a33", () => c.rect(-6, -14, 12, 6), 1.5);
    shape(c, "#6aa8e8", () => c.arc(0, 2, 7, 0, Math.PI * 2), 1.5);
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(-2, 0, 2, 0, Math.PI * 2);
    c.fill();
  },
  star(c, s) {
    shape(c, "#ffd94a", () => star(c, s * 0.45), 1.5);
  },
  sparkle(c, s) {
    c.fillStyle = "#fff6b0";
    c.beginPath();
    star(c, s * 0.45, 0.2, 4);
    c.fill();
  },
  leaf(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#d8382a", () => {
      const pts = [[0, -16], [5, -7], [13, -10], [10, 0], [16, 4], [6, 6], [4, 14], [0, 9], [-4, 14], [-6, 6], [-16, 4], [-10, 0], [-13, -10], [-5, -7]];
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
    }, 1.5);
    c.strokeStyle = "#8a1a10";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 9);
    c.lineTo(0, 20);
    c.stroke();
  },
  dragon(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#d7261e";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-18, 8);
    c.bezierCurveTo(-10, -10, 0, 16, 8, -2);
    c.stroke();
    shape(c, "#f2c230", () => c.ellipse(12, -6, 8, 6, -0.3, 0, Math.PI * 2), 1.5);
    c.fillStyle = OUT;
    c.beginPath();
    c.arc(14, -8, 1.5, 0, Math.PI * 2);
    c.fill();
  },
  dollar(c, s) {
    shape(c, "#3fae4a", () => c.arc(0, 0, s * 0.38, 0, Math.PI * 2), 1.5);
    label(c, "$", s * 0.5, "#fff", 1);
  },
  percent(c, s) {
    label(c, "%", s * 0.8, "#ffb02e");
  },
  scissors(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#cfd6de";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-14, -12);
    c.lineTo(10, 6);
    c.moveTo(-14, 12);
    c.lineTo(10, -6);
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = "#d7262e";
    for (const y of [-6, 6]) {
      c.beginPath();
      c.arc(14, y * 1.6, 5, 0, Math.PI * 2);
      c.stroke();
    }
  },
  cheese(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f6e7b8", () => {
      c.moveTo(-16, 10);
      c.lineTo(16, 10);
      c.lineTo(16, -2);
      c.lineTo(-16, -12);
      c.closePath();
    });
    c.fillStyle = "#d9c48a";
    for (const [x, y] of [[-6, 2], [6, 4], [10, -1]]) {
      c.beginPath();
      c.arc(x, y, 2.5, 0, Math.PI * 2);
      c.fill();
    }
  },
  golf(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#cfd6de";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-10, -18);
    c.lineTo(6, 12);
    c.stroke();
    shape(c, "#8a8f98", () => c.ellipse(9, 14, 7, 3.5, 0.3, 0, Math.PI * 2), 1.5);
    shape(c, "#fff", () => c.arc(-10, 14, 4, 0, Math.PI * 2), 1.2);
  },
  bear(c, s) {
    const u = s / 40;
    c.scale(u, u);
    for (const x of [-11, 11]) shape(c, "#7a4a2a", () => c.arc(x, -11, 6, 0, Math.PI * 2));
    shape(c, "#8a5a32", () => c.arc(0, 0, 15, 0, Math.PI * 2));
    shape(c, "#c9a07a", () => c.ellipse(0, 5, 7, 5, 0, 0, Math.PI * 2), 1.2);
    c.fillStyle = OUT;
    for (const x of [-6, 6]) {
      c.beginPath();
      c.arc(x, -3, 2, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 3, 2.5, 0, Math.PI * 2);
    c.fill();
  },
  heel(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#1a1a1a", () => {
      c.moveTo(-16, 2);
      c.quadraticCurveTo(-6, -2, 4, 6);
      c.lineTo(16, 6);
      c.lineTo(16, 12);
      c.lineTo(-10, 12);
      c.lineTo(-12, 22);
      c.lineTo(-16, 22);
      c.closePath();
    }, 1.5);
  },
  chart(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#fff", () => c.rect(-16, -14, 32, 28), 1.5);
    [6, 12, 20].forEach((h, i) => {
      c.fillStyle = ["#1d3fa0", "#5a7bd8", "#d7262e"][i];
      c.fillRect(-11 + i * 9, 10 - h, 6, h);
    });
  },
  puff(c, s) {
    c.fillStyle = "rgba(235,230,220,0.85)";
    for (const [x, y, r] of [[-0.25, 0.05, 0.28], [0.12, -0.1, 0.32], [0.3, 0.12, 0.22]]) {
      c.beginPath();
      c.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      c.fill();
    }
  },
  fist(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f1c6a0", () => c.roundRect(-12, -10, 24, 20, 7));
    c.strokeStyle = "rgba(90,50,30,0.6)";
    c.lineWidth = 1.5;
    for (const x of [-4, 3]) {
      c.beginPath();
      c.moveTo(x, -10);
      c.lineTo(x, -2);
      c.stroke();
    }
  },
  jelly(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f6c94a", () => {
      c.moveTo(-14, 10);
      c.lineTo(-10, -8);
      c.quadraticCurveTo(0, -14, 10, -8);
      c.lineTo(14, 10);
      c.closePath();
    });
    shape(c, "#8a4a1a", () => {
      c.moveTo(-10, -8);
      c.quadraticCurveTo(0, -16, 10, -8);
      c.quadraticCurveTo(0, -4, -10, -8);
    }, 0);
  },
  diamond(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#7ad0ff", () => {
      c.moveTo(0, -16);
      c.lineTo(14, 0);
      c.lineTo(0, 16);
      c.lineTo(-14, 0);
      c.closePath();
    });
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.beginPath();
    c.moveTo(0, -16);
    c.lineTo(-14, 0);
    c.lineTo(0, -2);
    c.fill();
  },
  muscle(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#efc3a3", () => {
      c.moveTo(-16, 10);
      c.quadraticCurveTo(-14, -6, -2, -6);
      c.quadraticCurveTo(4, -18, 12, -12);
      c.quadraticCurveTo(16, -4, 8, -2);
      c.quadraticCurveTo(14, 12, -16, 10);
    });
  },
  ribbon(c, s) {
    c.strokeStyle = "#d7261e";
    c.lineWidth = s * 0.15;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-s * 0.45, 0);
    c.bezierCurveTo(-s * 0.15, -s * 0.4, s * 0.15, s * 0.4, s * 0.45, 0);
    c.stroke();
  },
  lightning(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ffe14a", () => {
      c.moveTo(4, -18);
      c.lineTo(-10, 2);
      c.lineTo(-1, 2);
      c.lineTo(-6, 18);
      c.lineTo(10, -4);
      c.lineTo(1, -4);
      c.closePath();
    }, 1.5);
  },
  mic(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#3a3a44", () => c.roundRect(-6, -16, 12, 20, 6));
    c.strokeStyle = OUT;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, -2, 10, 0.2, Math.PI - 0.2);
    c.moveTo(0, 8);
    c.lineTo(0, 16);
    c.stroke();
  },
  bang(c, s) {
    shape(c, "#ffb02e", () => star(c, s * 0.48, 0.55, 10), 1.5);
    shape(c, "#ffe14a", () => star(c, s * 0.28, 0.55, 10), 0);
  },
  megaphone(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#d7262e", () => {
      c.moveTo(-12, -5);
      c.lineTo(10, -14);
      c.lineTo(10, 14);
      c.lineTo(-12, 5);
      c.closePath();
    });
    shape(c, "#2a2a33", () => c.rect(-17, -5, 6, 10), 1.5);
  },
  snail(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#9ad07a", () => c.roundRect(-16, 4, 32, 8, 4), 1.5);
    shape(c, "#c98a4a", () => c.arc(-2, -2, 11, 0, Math.PI * 2));
    c.strokeStyle = "#7a4a1a";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(-2, -2, 6, 0, Math.PI * 1.6);
    c.stroke();
  },
  swap(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#c9a0ff";
    c.lineWidth = 4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-14, -6);
    c.lineTo(12, -6);
    c.moveTo(14, 6);
    c.lineTo(-12, 6);
    c.stroke();
    c.fillStyle = "#c9a0ff";
    c.beginPath();
    c.moveTo(16, -6);
    c.lineTo(8, -12);
    c.lineTo(8, 0);
    c.moveTo(-16, 6);
    c.lineTo(-8, 0);
    c.lineTo(-8, 12);
    c.fill();
  },
  ice(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "rgba(170,225,255,0.9)", () => c.roundRect(-13, -13, 26, 26, 4));
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.fillRect(-9, -9, 6, 10);
  },
  guitar(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(-0.6);
    shape(c, "#5a3a22", () => c.rect(-3, -30, 6, 26), 1.5);
    shape(c, "#c98a4a", () => {
      c.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2);
      c.moveTo(13, 16);
      c.ellipse(0, 16, 13, 10, 0, 0, Math.PI * 2);
    });
    shape(c, "#2a1a10", () => c.arc(0, 8, 4, 0, Math.PI * 2), 0);
  },
  panda(c, s) {
    const u = s / 40;
    c.scale(u, u);
    for (const x of [-11, 11]) shape(c, "#111", () => c.arc(x, -11, 6, 0, Math.PI * 2), 0);
    shape(c, "#fafafa", () => c.arc(0, 0, 15, 0, Math.PI * 2));
    c.fillStyle = "#111";
    for (const x of [-6, 6]) {
      c.beginPath();
      c.ellipse(x, -1, 4, 5, x > 0 ? 0.4 : -0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 6, 2.5, 0, Math.PI * 2);
    c.fill();
  },
  scooter(c, s) {
    const u = s / 40;
    c.scale(u, u);
    for (const x of [-11, 11]) shape(c, "#111", () => c.arc(x, 8, 6, 0, Math.PI * 2), 0);
    shape(c, "#e8e8e8", () => {
      c.moveTo(-16, 2);
      c.lineTo(8, 2);
      c.lineTo(12, -14);
      c.lineTo(16, -14);
      c.lineTo(14, 6);
      c.lineTo(-16, 6);
      c.closePath();
    }, 1.5);
  },
  chainsaw(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f28c1a", () => c.roundRect(-18, -8, 16, 16, 3));
    shape(c, "#b8c0c8", () => c.roundRect(-2, -5, 22, 10, 5), 1.5);
    c.fillStyle = OUT;
    for (let x = 0; x < 20; x += 4) c.fillRect(x, -7, 2, 2);
  },
  form(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(0.2);
    shape(c, "#f4f4ef", () => c.rect(-12, -16, 24, 32), 1.5);
    c.fillStyle = "#1d3fa0";
    c.fillRect(-9, -13, 18, 4);
    c.fillStyle = "#aaa";
    for (let i = 0; i < 5; i++) c.fillRect(-9, -6 + i * 4, 18, 1.5);
    c.strokeStyle = "#d7262e";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-14, 14);
    c.lineTo(14, -14);
    c.stroke();
  },
  palm(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#e3b23c", () => {
      c.moveTo(0, 16);
      c.quadraticCurveTo(-4, 0, 0, -16);
      c.quadraticCurveTo(14, -4, 6, 10);
      c.quadraticCurveTo(10, 0, 2, -6);
      c.quadraticCurveTo(0, 4, 0, 16);
    }, 1.5);
  },
  bookHeavy(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(-0.2);
    shape(c, "#2a3a6a", () => c.rect(-15, -18, 30, 36));
    c.fillStyle = "#f4f1e6";
    c.fillRect(11, -16, 3, 32);
    c.fillStyle = "#e3b23c";
    c.fillRect(-11, -12, 20, 3);
    c.fillRect(-11, 8, 20, 3);
  },
  bicorne(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#1a1a22", () => {
      c.moveTo(-20, 6);
      c.quadraticCurveTo(0, -22, 20, 6);
      c.quadraticCurveTo(0, 0, -20, 6);
    });
    shape(c, "#d7262e", () => c.arc(0, -4, 4, 0, Math.PI * 2), 1);
  },
  chess(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#1a1a22", () => {
      c.moveTo(-10, 16);
      c.lineTo(10, 16);
      c.lineTo(8, 4);
      c.quadraticCurveTo(14, -6, 6, -14);
      c.quadraticCurveTo(-8, -16, -10, -2);
      c.lineTo(-2, -4);
      c.lineTo(-6, 4);
      c.closePath();
    });
  },
  rose(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#2e7d32";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 2);
    c.lineTo(0, 18);
    c.stroke();
    shape(c, "#e0245e", () => c.arc(0, -4, 10, 0, Math.PI * 2));
    c.strokeStyle = "#9a1040";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, -4, 5, 0.5, Math.PI * 1.8);
    c.stroke();
  },
  question(c, s) {
    shape(c, "#ffffff", () => c.arc(0, 0, s * 0.42, 0, Math.PI * 2), 1.5);
    label(c, "?", s * 0.55, "#d7262e", 2);
  },
  film(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#2a2a33", () => c.arc(0, 0, 15, 0, Math.PI * 2));
    c.fillStyle = "#cfd6de";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.beginPath();
      c.arc(Math.cos(a) * 8, Math.sin(a) * 8, 3, 0, Math.PI * 2);
      c.fill();
    }
  },
  tire(c, s) {
    shape(c, "#222", () => c.arc(0, 0, s * 0.42, 0, Math.PI * 2), 1.5);
    shape(c, "#666", () => c.arc(0, 0, s * 0.18, 0, Math.PI * 2), 0);
  },
  seed(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#8a5a32", () => c.ellipse(0, 4, 10, 8, 0, 0, Math.PI * 2));
    shape(c, "#4fb84a", () => {
      c.moveTo(0, -2);
      c.quadraticCurveTo(-12, -14, -2, -16);
      c.quadraticCurveTo(2, -8, 0, -2);
      c.moveTo(0, -2);
      c.quadraticCurveTo(12, -14, 4, -16);
      c.quadraticCurveTo(0, -8, 0, -2);
    }, 1.2);
  },
  windmill(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.fillStyle = "#f4f4f4";
    c.strokeStyle = OUT;
    c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      c.save();
      c.rotate((i / 3) * Math.PI * 2);
      c.beginPath();
      c.ellipse(0, -10, 3, 11, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
    shape(c, "#ccc", () => c.arc(0, 0, 3, 0, Math.PI * 2), 1);
  },
  container(c, s) {
    const u = s / 60;
    c.scale(u, u);
    shape(c, "#2a7ab8", () => c.rect(-28, -14, 56, 28), 2.5);
    c.strokeStyle = "rgba(0,0,0,0.35)";
    c.lineWidth = 2;
    for (let x = -22; x < 28; x += 8) {
      c.beginPath();
      c.moveTo(x, -12);
      c.lineTo(x, 12);
      c.stroke();
    }
  },
  gull(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ffffff", () => c.ellipse(0, 2, 10, 6, 0, 0, Math.PI * 2), 1.5);
    shape(c, "#dfe4ea", () => {
      c.moveTo(-2, 0);
      c.quadraticCurveTo(-10, -14, -20, -8);
      c.quadraticCurveTo(-10, -4, -2, 2);
      c.moveTo(2, 0);
      c.quadraticCurveTo(10, -14, 20, -8);
      c.quadraticCurveTo(10, -4, 2, 2);
    }, 1.5);
    shape(c, "#f2b632", () => {
      c.moveTo(9, 2);
      c.lineTo(16, 4);
      c.lineTo(9, 5);
      c.closePath();
    }, 1);
  },
  sign80(c, s) {
    shape(c, "#ffffff", () => c.arc(0, 0, s * 0.42, 0, Math.PI * 2), 1.5);
    c.lineWidth = s * 0.08;
    c.strokeStyle = "#d7262e";
    c.beginPath();
    c.arc(0, 0, s * 0.36, 0, Math.PI * 2);
    c.stroke();
    label(c, "80", s * 0.32, OUT, 1);
  },
  glove(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#d7262e", () => c.roundRect(-14, -12, 26, 22, 9));
    shape(c, "#b81a20", () => c.roundRect(-14, 6, 22, 9, 3), 1.5);
  },
  smile(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ffd94a", () => c.arc(0, 0, 15, 0, Math.PI * 2));
    c.fillStyle = OUT;
    for (const x of [-5, 5]) {
      c.beginPath();
      c.ellipse(x, -4, 2, 3, 0, 0, Math.PI * 2);
      c.fill();
    }
    shape(c, "#ffffff", () => {
      c.moveTo(-9, 3);
      c.quadraticCurveTo(0, 16, 9, 3);
      c.closePath();
    }, 1.5);
  },
  // Menu icons
  trophy(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#c9a227";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(-12, -8, 6, Math.PI * 0.5, Math.PI * 1.5);
    c.moveTo(12, -14);
    c.arc(12, -8, 6, -Math.PI * 0.5, Math.PI * 0.5);
    c.stroke();
    shape(c, "#f2c230", () => {
      c.moveTo(-12, -16);
      c.lineTo(12, -16);
      c.quadraticCurveTo(12, 4, 0, 6);
      c.quadraticCurveTo(-12, 4, -12, -16);
    });
    shape(c, "#f2c230", () => c.rect(-3, 6, 6, 6), 1.5);
    shape(c, "#8a5a32", () => c.rect(-10, 12, 20, 6), 1.5);
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillRect(-8, -13, 3, 10);
  },
  gamepad(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#3a3a48", () => {
      c.moveTo(-10, -9);
      c.lineTo(10, -9);
      c.quadraticCurveTo(20, -9, 20, 4);
      c.quadraticCurveTo(20, 14, 13, 12);
      c.lineTo(8, 6);
      c.lineTo(-8, 6);
      c.lineTo(-13, 12);
      c.quadraticCurveTo(-20, 14, -20, 4);
      c.quadraticCurveTo(-20, -9, -10, -9);
    });
    c.fillStyle = "#e8e8ee";
    c.fillRect(-14, -2, 9, 3);
    c.fillRect(-11, -5, 3, 9);
    for (const [x, y, col] of [[9, -4, "#d7262e"], [14, 0, "#2e7dd7"], [9, 3, "#3fae4a"]] as const) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(x, y, 2.4, 0, Math.PI * 2);
      c.fill();
    }
  },
  robot(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = OUT;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(0, -18);
    c.stroke();
    shape(c, "#d7262e", () => c.arc(0, -18, 3, 0, Math.PI * 2), 1.5);
    shape(c, "#b8c4d0", () => c.roundRect(-15, -12, 30, 26, 5));
    shape(c, "#8a96a4", () => c.rect(-19, -3, 4, 8), 1.5);
    shape(c, "#8a96a4", () => c.rect(15, -3, 4, 8), 1.5);
    c.fillStyle = "#7ad0ff";
    for (const x of [-6, 6]) {
      c.beginPath();
      c.arc(x, -2, 3.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = OUT;
    for (let i = 0; i < 4; i++) c.fillRect(-7 + i * 4, 7, 2, 3);
  },
  globe(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#3a8ad5", () => c.arc(0, 0, 16, 0, Math.PI * 2));
    c.strokeStyle = "rgba(255,255,255,0.75)";
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(0, 0, 7, 16, 0, 0, Math.PI * 2);
    c.moveTo(-16, 0);
    c.lineTo(16, 0);
    c.moveTo(-14, -8);
    c.lineTo(14, -8);
    c.moveTo(-14, 8);
    c.lineTo(14, 8);
    c.moveTo(0, -16);
    c.lineTo(0, 16);
    c.stroke();
  },
  scroll(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#f4e4b8", () => c.rect(-12, -14, 24, 28));
    shape(c, "#e3c98a", () => c.ellipse(0, -15, 15, 4, 0, 0, Math.PI * 2), 1.5);
    shape(c, "#e3c98a", () => c.ellipse(0, 15, 15, 4, 0, 0, Math.PI * 2), 1.5);
    c.fillStyle = "#8a6a3a";
    for (let i = 0; i < 4; i++) c.fillRect(-8, -7 + i * 5, i === 3 ? 10 : 16, 2);
  },
  joystick(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#2a2a33", () => c.roundRect(-18, 6, 36, 12, 3));
    c.strokeStyle = OUT;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-4, 8);
    c.lineTo(-2, -8);
    c.stroke();
    shape(c, "#d7262e", () => c.arc(-2, -11, 7, 0, Math.PI * 2));
    shape(c, "#f2c230", () => c.arc(10, 6, 3.5, 0, Math.PI * 2), 1.2);
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.beginPath();
    c.arc(-4, -13, 2, 0, Math.PI * 2);
    c.fill();
  },
  gear(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#9aa4b0", () => {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 12 : 17;
        c.lineTo(Math.cos(a - 0.15) * r, Math.sin(a - 0.15) * r);
        c.lineTo(Math.cos(a + 0.15) * r, Math.sin(a + 0.15) * r);
      }
      c.closePath();
    });
    shape(c, "#2a2a33", () => c.arc(0, 0, 5, 0, Math.PI * 2), 1.5);
  },
  info(c, s) {
    shape(c, "#2e7dd7", () => c.arc(0, 0, s * 0.42, 0, Math.PI * 2), 1.5);
    label(c, "i", s * 0.55, "#fff", 2);
  },
  back(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.strokeStyle = "#e8e8ee";
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-8, -6);
    c.lineTo(6, -6);
    c.quadraticCurveTo(16, -6, 16, 4);
    c.quadraticCurveTo(16, 14, 6, 14);
    c.lineTo(-4, 14);
    c.stroke();
    c.fillStyle = "#e8e8ee";
    c.beginPath();
    c.moveTo(-18, -6);
    c.lineTo(-6, -15);
    c.lineTo(-6, 3);
    c.closePath();
    c.fill();
  },
  temple(c, s) {
    const u = s / 40;
    c.scale(u, u);
    shape(c, "#ece6d6", () => {
      c.moveTo(-18, -8);
      c.lineTo(0, -18);
      c.lineTo(18, -8);
      c.closePath();
    });
    shape(c, "#ece6d6", () => c.rect(-17, 12, 34, 5), 1.5);
    c.fillStyle = "#ece6d6";
    c.strokeStyle = OUT;
    c.lineWidth = 1.5;
    for (const x of [-13, -5, 3, 11]) {
      c.fillRect(x - 1, -7, 4, 19);
      c.strokeRect(x - 1, -7, 4, 19);
    }
  },
  key(c, s) {
    const u = s / 40;
    c.scale(u, u);
    c.rotate(-0.6);
    shape(c, "#f2c230", () => {
      c.arc(-10, 0, 8, 0, Math.PI * 2);
      c.moveTo(-2, -3);
      c.rect(-3, -3, 22, 6);
      c.rect(12, 3, 4, 6);
      c.rect(6, 3, 3, 5);
    });
    shape(c, "#8a6a1a", () => c.arc(-10, 0, 3, 0, Math.PI * 2), 0);
  },
};

export const hasSprite = (key: string) => key in SPRITES;

export function drawSprite(c: Ctx, key: string, x: number, y: number, size: number, rot = 0, flip = false) {
  const fn = SPRITES[key];
  if (!fn) return;
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (flip) c.scale(-1, 1);
  c.lineJoin = "round";
  fn(c, size);
  c.restore();
}

/** Renders a sprite to an image URL, for the React menus. */
const urls = new Map<string, string>();
export function spriteUrl(key: string, size = 48): string {
  const k = key + size;
  let u = urls.get(k);
  if (!u) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    drawSprite(cv.getContext("2d")!, key, size / 2, size / 2, size * 0.9);
    u = cv.toDataURL();
    urls.set(k, u);
  }
  return u;
}
