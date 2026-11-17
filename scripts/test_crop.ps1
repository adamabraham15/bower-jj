Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\adama\.gemini\antigravity\scratch\bower-jj\public\assets\packs\standard_pack.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Output "Image size: $($bmp.Width) x $($bmp.Height)"

# Crop coordinates for BOWER JJ title
# In 896 x 1200:
# The gold crimp is at top (approx y=0..120)
# Top filigree: y=120..180
# BOWER JJ title: approx y=160..380
# Ribbon "COLLECTOR BOOSTER": approx y=380..460

$cropRect = New-Object System.Drawing.Rectangle(130, 150, 636, 230)
$cropped = $bmp.Clone($cropRect, $bmp.PixelFormat)
$outPath = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_crop_test.jpg"
$cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$cropped.Dispose()

# Also crop with collector booster ribbon
$cropRectWithRibbon = New-Object System.Drawing.Rectangle(130, 150, 636, 320)
$cropped2 = $bmp.Clone($cropRectWithRibbon, $bmp.PixelFormat)
$outPath2 = "C:\Users\adama\.gemini\antigravity\brain\76909efa-27fd-4033-b73a-a2e0aabc11ad\bower_jj_crop_ribbon_test.jpg"
$cropped2.Save($outPath2, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$cropped2.Dispose()

$bmp.Dispose()
Write-Output "Saved test crops successfully"
