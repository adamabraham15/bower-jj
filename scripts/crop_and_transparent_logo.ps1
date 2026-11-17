Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_logo_isolated_1794934726026.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $bmp.Width
$h = $bmp.Height

Write-Output "Source Dimensions: $w x $h"

# 1. Scan for bounding box of non-black pixels (luminance > 12)
$minX = $w; $maxX = 0; $minY = $h; $maxY = 0

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $bmp.GetPixel($x, $y)
        $lum = [Math]::Max($p.R, [Math]::Max($p.G, $p.B))
        if ($lum -gt 15) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Output "Bounding Box: X=[$minX, $maxX], Y=[$minY, $maxY], Width=$($maxX - $minX + 1), Height=$($maxY - $minY + 1)"

# Add padding
$pad = 12
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX + 1) + 2 * $pad)
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY + 1) + 2 * $pad)

Write-Output "Cropped Region: X=$cropX, Y=$cropY, W=$cropW, H=$cropH"

# Create tight transparent PNG
$transparentBmp = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    $srcY = $cropY + $y
    for ($x = 0; $x -lt $cropW; $x++) {
        $srcX = $cropX + $x
        $p = $bmp.GetPixel($srcX, $srcY)
        $r = [double]$p.R
        $g = [double]$p.G
        $b = [double]$p.B

        # Max RGB component as luminance proxy
        $maxC = [Math]::Max($r, [Math]::Max($g, $b))

        # Alpha calculation:
        # If maxC <= 4: completely transparent (0)
        # If maxC >= 35: completely opaque (255)
        # Between 4 and 35: smooth linear ramp with color un-blackening
        if ($maxC -le 4) {
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $alpha = [Math]::Min(1.0, ($maxC - 4.0) / 36.0)
            # Un-blacken color (pre-multiplied black removal)
            $unR = [Math]::Min(255.0, $r / [Math]::Max(0.2, $alpha))
            $unG = [Math]::Min(255.0, $g / [Math]::Max(0.2, $alpha))
            $unB = [Math]::Min(255.0, $b / [Math]::Max(0.2, $alpha))
            
            $aByte = [byte]([Math]::Round($alpha * 255.0))
            $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($aByte, [int]$unR, [int]$unG, [int]$unB))
        }
    }
}

$outTransparent = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_logo_transparent.png"
$transparentBmp.Save($outTransparent, [System.Drawing.Imaging.ImageFormat]::Png)

# Save into public/assets/ for production use in web app
$targetPath = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\bower_jj_logo.png"
$transparentBmp.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Also save a WebP or optimized PNG copy
$targetLogoPack = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\bower_jj_pack_logo.png"
$transparentBmp.Save($targetLogoPack, [System.Drawing.Imaging.ImageFormat]::Png)

$transparentBmp.Dispose()
$bmp.Dispose()
Write-Output "Transparent logo created successfully"
