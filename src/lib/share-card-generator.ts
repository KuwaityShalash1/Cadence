/**
 * High-resolution HTML5 Canvas generator for social stories and milestone cards.
 * Produces crisp, standalone PNG graphics completely offline without external APIs.
 */

export interface ShareCardData {
  streak: number;
  longestStreak: number;
  weeklyRate: number;
  totalCompletions: number;
  level: {
    level: number;
    title: string;
  };
  userName: string;
  bestHabitName?: string;
  format: "story" | "square";
  labels: {
    milestoneBadge: string;
    dayStreak: string;
    daysStreak: string;
    weeklyConsistency: string;
    personalBest: string;
    totalCompleted: string;
    starHabit: string;
    motto: string;
    branding: string;
  };
}

export interface GeneratedCardResult {
  dataUrl: string;
  blob: Blob;
  file: File;
}

/**
 * Draws a stylized flame icon onto the 2D canvas context.
 */
function drawFlame(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  fillColor: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);

  ctx.beginPath();
  // Lucide-style flame path
  ctx.moveTo(8.5, 14.5);
  ctx.bezierCurveTo(9, 11, 10.5, 9.5, 12, 8);
  ctx.bezierCurveTo(13.5, 9.5, 15, 11, 15.5, 14.5);
  ctx.bezierCurveTo(16, 17, 14.5, 19, 12, 19);
  ctx.bezierCurveTo(9.5, 19, 8, 17, 8.5, 14.5);
  ctx.closePath();

  ctx.moveTo(12, 2);
  ctx.bezierCurveTo(10, 6, 6, 8, 6, 13.5);
  ctx.bezierCurveTo(6, 17.5, 8.5, 21, 12, 21);
  ctx.bezierCurveTo(15.5, 21, 18, 17.5, 18, 13.5);
  ctx.bezierCurveTo(18, 8, 14, 6, 12, 2);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

/**
 * Generates an ultra-crisp social story (9:16) or square (1:1) milestone image.
 */
export async function generateStreakMilestoneImage(
  data: ShareCardData,
): Promise<GeneratedCardResult> {
  const isStory = data.format === "story";
  const width = 1080;
  const height = isStory ? 1920 : 1080;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }

  // 1. Deep Aesthetic Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#080c16");
  bgGrad.addColorStop(0.4, "#0d1424");
  bgGrad.addColorStop(1, "#050811");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Background Glows
  const centerGlowY = isStory ? height * 0.44 : height * 0.46;
  const centerGlow = ctx.createRadialGradient(
    width / 2,
    centerGlowY,
    50,
    width / 2,
    centerGlowY,
    width * 0.48,
  );
  centerGlow.addColorStop(0, "rgba(245, 158, 11, 0.25)");
  centerGlow.addColorStop(0.4, "rgba(234, 88, 12, 0.12)");
  centerGlow.addColorStop(0.8, "rgba(168, 85, 247, 0.04)");
  centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, width, height);

  // Top cyan atmospheric aura
  const topGlow = ctx.createRadialGradient(width * 0.8, 150, 20, width * 0.8, 150, 400);
  topGlow.addColorStop(0, "rgba(6, 182, 212, 0.15)");
  topGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  // 3. Subtle Concentric Rhythm Rings behind hero emblem
  ctx.save();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.08)";
  ctx.lineWidth = 1.5;
  for (let r = 160; r <= 360; r += 50) {
    ctx.beginPath();
    ctx.arc(width / 2, centerGlowY, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Outer Aesthetic Frame
  const margin = 48;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 2;
  roundRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 40);
  ctx.stroke();

  // Inner card frosted container
  const innerMargin = 72;
  const innerW = width - innerMargin * 2;
  const innerH = height - innerMargin * 2;
  ctx.fillStyle = "rgba(15, 23, 42, 0.4)";
  roundRect(ctx, innerMargin, innerMargin, innerW, innerH, 32);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 5. Header: Cadence Brand Mark & User Identity
  const headerY = isStory ? 170 : 130;

  // Cadence Logo Sparkle & Brand Wordmark
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f59e0b";
  ctx.font = "900 24px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("CADENCE", width / 2, headerY);

  ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
  ctx.font = "600 14px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("HABIT RHYTHM", width / 2, headerY + 28);
  ctx.restore();

  // Milestone Pill
  const pillY = headerY + 74;
  ctx.save();
  ctx.textAlign = "center";
  const pillText = data.labels.milestoneBadge.toUpperCase();
  ctx.font = "700 13px system-ui, -apple-system, sans-serif";
  const pillWidth = ctx.measureText(pillText).width + 36;
  const pillHeight = 32;

  ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
  roundRect(ctx, width / 2 - pillWidth / 2, pillY - 20, pillWidth, pillHeight, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#fbbf24";
  ctx.fillText(pillText, width / 2, pillY);
  ctx.restore();

  // 6. User Display Name & Rank
  const userY = pillY + 48;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.userName, width / 2, userY);

  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.font = "500 14px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Level ${data.level.level} • ${data.level.title}`, width / 2, userY + 24);
  ctx.restore();

  // 7. Hero Streak Centerpiece
  const emblemCenterY = centerGlowY;

  // Outer decorative halo ring
  ctx.save();
  const ringGrad = ctx.createLinearGradient(
    width / 2 - 130,
    emblemCenterY - 130,
    width / 2 + 130,
    emblemCenterY + 130,
  );
  ringGrad.addColorStop(0, "#f59e0b");
  ringGrad.addColorStop(0.5, "#ef4444");
  ringGrad.addColorStop(1, "#a855f7");
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(width / 2, emblemCenterY, 130, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Inner halo background
  ctx.save();
  const innerCircleGrad = ctx.createRadialGradient(
    width / 2,
    emblemCenterY,
    10,
    width / 2,
    emblemCenterY,
    128,
  );
  innerCircleGrad.addColorStop(0, "rgba(245, 158, 11, 0.25)");
  innerCircleGrad.addColorStop(0.7, "rgba(15, 23, 42, 0.85)");
  innerCircleGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)");
  ctx.fillStyle = innerCircleGrad;
  ctx.beginPath();
  ctx.arc(width / 2, emblemCenterY, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flame Icon above streak number
  drawFlame(ctx, width / 2, emblemCenterY - 45, 52, "#f59e0b");

  // Streak Number
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 84px system-ui, -apple-system, sans-serif";
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 16;
  ctx.fillText(String(data.streak), width / 2, emblemCenterY + 42);

  // Subtitle (DAYS STREAK)
  const streakText = (
    data.streak === 1 ? data.labels.dayStreak : data.labels.daysStreak
  ).toUpperCase();
  ctx.fillStyle = "#fbbf24";
  ctx.font = "800 15px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.shadowBlur = 0;
  ctx.fillText(streakText, width / 2, emblemCenterY + 76);
  ctx.restore();

  // 8. Stats Highlights Grid (Weekly Consistency, Longest Streak, Total Completions)
  const statsStartY = isStory ? emblemCenterY + 230 : emblemCenterY + 175;
  const colWidth = (width - innerMargin * 2 - 48) / 3;
  const statBoxH = isStory ? 130 : 105;

  const statItems = [
    {
      val: `${data.weeklyRate}%`,
      label: data.labels.weeklyConsistency,
      color: "#10b981",
    },
    {
      val: `${data.longestStreak}d`,
      label: data.labels.personalBest,
      color: "#38bdf8",
    },
    {
      val: String(data.totalCompletions),
      label: data.labels.totalCompleted,
      color: "#a855f7",
    },
  ];

  statItems.forEach((item, idx) => {
    const boxX = innerMargin + 24 + idx * colWidth;
    ctx.save();
    // Glass card background
    ctx.fillStyle = "rgba(30, 41, 59, 0.45)";
    roundRect(ctx, boxX + 8, statsStartY, colWidth - 16, statBoxH, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Value
    ctx.textAlign = "center";
    ctx.fillStyle = item.color;
    ctx.font = "900 32px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.val, boxX + colWidth / 2, statsStartY + (isStory ? 56 : 46));

    // Label
    ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(item.label, boxX + colWidth / 2, statsStartY + (isStory ? 92 : 78));
    ctx.restore();
  });

  // 9. Best Habit Spotlight (Story format only, or if space permits)
  if (isStory && data.bestHabitName) {
    const habitY = statsStartY + statBoxH + 36;
    const bannerW = width - innerMargin * 2 - 48;
    const bannerH = 76;
    const bannerX = innerMargin + 24;

    ctx.save();
    ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
    roundRect(ctx, bannerX, habitY, bannerW, bannerH, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Small star or flame icon
    drawFlame(ctx, bannerX + 40, habitY + 38, 22, "#f59e0b");

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(203, 213, 225, 0.8)";
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.labels.starHabit.toUpperCase(), bannerX + 68, habitY + 30);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px system-ui, -apple-system, sans-serif";
    const habitNameText =
      data.bestHabitName.length > 28 ? `${data.bestHabitName.slice(0, 26)}…` : data.bestHabitName;
    ctx.fillText(habitNameText, bannerX + 68, habitY + 54);
    ctx.restore();
  }

  // 10. Footer Section: Motivational Motto & Cadence Branding
  const footerY = isStory ? height - 160 : height - 120;
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(203, 213, 225, 0.9)";
  ctx.font = "italic 500 16px system-ui, -apple-system, sans-serif";
  ctx.fillText(`“${data.labels.motto}”`, width / 2, footerY);

  ctx.fillStyle = "rgba(100, 116, 139, 0.8)";
  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(data.labels.branding.toUpperCase(), width / 2, footerY + 36);
  ctx.restore();

  // 11. Export to Blob and File
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to export canvas blob"));
      },
      "image/png",
      0.98,
    );
  });

  const dataUrl = canvas.toDataURL("image/png");
  const fileName = `cadence-streak-${data.streak}d-${data.format}.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  return { dataUrl, blob, file };
}
