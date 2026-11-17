Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\packs\standard_pack.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Perfectly bounded crop:
# Let's inspect where BOWER JJ starts and ends horizontally and vertically
# In 896 width:
# The inner frame starts around x = 140, ends around x = 756
# The letters BOWER JJ start around x = 175, end around x = 720
# The top diamond starts around y = 135
# The bottom of BOWER JJ letters ends around y = 370
# Let's crop x=150, y=130, w=596, h=245

$cropX = 150
$cropY = 130
$cropW = 596
$cropH = 245

$cropped = $bmp.Clone((New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Let's create an alpha-extracted version:
# Background is dark navy/blue/black: R < 45, G < 55, B < 80.
# The gold is R > 100, G > 70.
# Cyan gems are R < 100, G > 180, B > 180.
# For each pixel, we can compute an alpha based on distance from dark navy background.
$alphaBmp = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    for ($x = 0; $x -lt $cropW; $x++) {
        $pixel = $cropped.GetPixel($x, $y)
        $r = [double]$pixel.R
        $g = [double]$pixel.G
        $b = [double]$pixel.B

        # Background color estimate in this dark region:
        # Deep blue-black around rgb(10, 20, 42)
        # Gold is high R, high G, lower B
        # Cyan is high G, high B
        
        # Max brightness
        $maxC = [Math]::Max($r, [Math]::Max($g, $b))
        # Gold intensity: 1.2*R + 0.8*G - 0.5*B
        # Cyan intensity: 0.8*G + 1.2*B - 0.5*R
        
        # Color difference from dark background (around 12, 22, 45)
        $bgDist = [Math]::Sqrt([Math]::Pow($r - 12, 2) + [Math]::Pow($g - 22, 2) + [Math]::Pow($b - 45, 2))
        
        # If very close to background, alpha -> 0
        # If far, alpha -> 255
        # Threshold: smoothstep between 35 and 90
        $t = ($bgDist - 35.0) / 55.0
        if ($t -lt 0.0) { $t = 0.0 }
        if ($t -gt 1.0) { $t = 1.0 }
        
        # Smoothstep
        $alpha = $t * $t * (3.0 - 2.0 * $t)
        
        # Extra boost for gold (R > 130 and G > 90)
        if ($r -gt 120 -and $g -gt 80) {
            $alpha = [Math]::Max($alpha, 0.95)
        }
        # Extra boost for cyan (G > 140 and B > 140)
        if ($g -gt 140 -and $b -gt 140) {
            $alpha = [Math]::Max($alpha, 0.95)
        }

        $aByte = [byte]([Math]::Round($alpha * 255.0))
        if ($aByte -eq 0) {
            $alphaBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $alphaBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($aByte, $pixel.R, $pixel.G, $pixel.B))
        }
    }
}

$outAlpha = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_pack_extracted.png"
$alphaBmp.Save($outAlpha, [System.Drawing.Imaging.ImageFormat]::Png)

# Also save to public/assets/
$alphaBmp.Save("C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\bower_jj_pack_logo.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Also create an exact crop with dark border vignette
$cropped.Save("C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_pack_crop_exact.png", [System.Drawing.Imaging.ImageFormat]::Png)

$cropped.Dispose()
$alphaBmp.Dispose()
$bmp.Dispose()
Write-Output "Extracted logo saved successfully"
