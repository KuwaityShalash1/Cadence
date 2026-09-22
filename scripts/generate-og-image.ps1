# Cadence — social preview (Open Graph / Twitter card) generator.
#
# Renders public/og-image.png (1200x630) with GDI+ so the artwork can be
# regenerated on any Windows machine without adding an image dependency to the
# app. Run it from the repository root:  powershell -File scripts/generate-og-image.ps1
#
# Comments and copy are intentionally in English to match the project rules.

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $root "public\og-image.png"

$width = 1200
$height = 630

$canvas = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)

try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  # --- Background: dark brand shell with a soft indigo/cyan glow -----------
  $bounds = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $bounds,
    [System.Drawing.Color]::FromArgb(255, 12, 19, 34),
    [System.Drawing.Color]::FromArgb(255, 5, 8, 14),
    40
  )
  $graphics.FillRectangle($background, $bounds)

  $indigoGlow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 99, 102, 241))
  $graphics.FillEllipse($indigoGlow, -220, -260, 720, 720)
  $cyanGlow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 34, 211, 238))
  $graphics.FillEllipse($cyanGlow, 880, 300, 620, 620)

  # --- Helper: rounded rectangle path -------------------------------------
  function New-RoundedRectPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc(($x + $w - $d), $y, $d, $d, 270, 90)
    $path.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90)
    $path.AddArc($x, ($y + $h - $d), $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
  }

  # --- Logo mark (same waveform as src/components/ui/CadenceLogo.tsx) ------
  $markSize = 92
  $markX = 80
  $markY = 74
  $markPath = New-RoundedRectPath $markX $markY $markSize $markSize 22
  $markFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 15, 23, 42))
  $graphics.FillPath($markFill, $markPath)
  $markStroke = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 30, 41, 59), 2)
  $graphics.DrawPath($markStroke, $markPath)

  # The 32x32 viewBox of the logo scaled onto the 92px square.
  $scale = $markSize / 32.0
  $points = @(
    @(5, 16), @(9, 16), @(11.5, 10), @(16, 22), @(19, 14), @(26, 14)
  ) | ForEach-Object {
    New-Object System.Drawing.PointF(($markX + $_[0] * $scale), ($markY + $_[1] * $scale))
  }

  $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 34, 211, 238), 10)
  $glowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $glowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($glowPen, $points)

  $markPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 34, 211, 238), 6)
  $markPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $markPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $markPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($markPen, $points)


  # --- Wordmark ------------------------------------------------------------
  $wordmarkFont = New-Object System.Drawing.Font("Segoe UI", 46, [System.Drawing.FontStyle]::Bold)
  $wordmarkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
  $graphics.DrawString("Cadence", $wordmarkFont, $wordmarkBrush, 196, 90)

  $badgeFont = New-Object System.Drawing.Font("Segoe UI", 17, [System.Drawing.FontStyle]::Bold)
  $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 165, 180, 252))
  $graphics.DrawString("OFFLINE-FIRST PWA", $badgeFont, $badgeBrush, 200, 152)

  # --- Headline ------------------------------------------------------------
  $headlineFont = New-Object System.Drawing.Font("Segoe UI", 50, [System.Drawing.FontStyle]::Bold)
  $headlineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $graphics.DrawString("Free Offline Habit Tracker", $headlineFont, $headlineBrush, 78, 250)

  $subFont = New-Object System.Drawing.Font("Segoe UI", 27, [System.Drawing.FontStyle]::Regular)
  $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 203, 213, 225))
  $graphics.DrawString("Daily routine planner, moderation goals and streaks.", $subFont, $subBrush, 82, 336)
  $graphics.DrawString("Your data stays on your device — no ads, no tracking.", $subFont, $subBrush, 82, 380)

  # --- Feature chips -------------------------------------------------------
  $chipFont = New-Object System.Drawing.Font("Segoe UI", 19, [System.Drawing.FontStyle]::Bold)
  $chipTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
  $chipStroke = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 71, 85, 105), 2)
  $chipFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150, 15, 23, 42))

  $chips = @("100% Offline (IndexedDB)", "Installable PWA", "Free forever")
  $chipX = 80
  $chipY = 466
  foreach ($chip in $chips) {
    $textSize = $graphics.MeasureString($chip, $chipFont)
    $chipWidth = [int][Math]::Ceiling($textSize.Width) + 40
    $path = New-RoundedRectPath $chipX $chipY $chipWidth 54 27
    $graphics.FillPath($chipFill, $path)
    $graphics.DrawPath($chipStroke, $path)
    $graphics.DrawString($chip, $chipFont, $chipTextBrush, ($chipX + 20), ($chipY + 12))
    $chipX += $chipWidth + 16
  }

  # --- Footer --------------------------------------------------------------
  $footerFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
  $footerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 148, 163, 184))
  $graphics.DrawString("cadencepwa.vercel.app", $footerFont, $footerBrush, 82, 556)

  $canvas.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Wrote $outputPath ($width x $height)"
}
finally {
  $graphics.Dispose()
  $canvas.Dispose()
}
