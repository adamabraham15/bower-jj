Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_logo_isolated_1794934726026.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $bmp.Width
$h = $bmp.Height

$cropX = 53
$cropY = 72
$cropW = 1273
$cropH = 532

$cleanBmp = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $cropH; $y++) {
    $srcY = $cropY + $y
    for ($x = 0; $x -lt $cropW; $x++) {
        $srcX = $cropX + $x
        $p = $bmp.GetPixel($srcX, $srcY)
        $r = [double]$p.R
        $g = [double]$p.G
        $b = [double]$p.B

        # Pure gold: High R & G, low B
        # Pure cyan gem: High G & B, low R
        # Dark black or dark halo: R, G, B are all low
        
        $maxC = [Math]::Max($r, [Math]::Max($g, $b))
        
        # If very dark (< 18), make completely transparent
        if ($maxC -lt 16) {
            $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            continue
        }

        # Check if it's the dark cyan halo around the top diamond or inside O
        # In the halo, maxC is between 16 and 50, but neither gold nor bright cyan
        if ($maxC -lt 45 -and ($r -lt 30 -or $g -lt 30)) {
            # This is background halo/smudge, eliminate it or fade it sharply
            $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            continue
        }

        # Alpha transition for edges
        if ($maxC -lt 55) {
            $alpha = ($maxC - 45.0) / 10.0
            if ($alpha -le 0.0) {
                $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
                continue
            }
        } else {
            $alpha = 1.0
        }

        # Color preservation
        $aByte = [byte]([Math]::Round([Math]::Min(1.0, [Math]::Max(0.0, $alpha)) * 255.0))
        $cleanBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($aByte, $p.R, $p.G, $p.B))
    }
}

$outPath = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_logo_clean.png"
$cleanBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Save to public assets
$pubLogo = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\bower_jj_pack_logo.png"
$pubLogo2 = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\bower_jj_logo.png"
$cleanBmp.Save($pubLogo, [System.Drawing.Imaging.ImageFormat]::Png)
$cleanBmp.Save($pubLogo2, [System.Drawing.Imaging.ImageFormat]::Png)

$cleanBmp.Dispose()
$bmp.Dispose()
Write-Output "Clean logo saved successfully"
