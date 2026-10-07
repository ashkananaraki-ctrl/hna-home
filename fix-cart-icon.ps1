$ErrorActionPreference = "Stop"

# Run this file from the main lumio project folder.
$style = Join-Path (Get-Location) "style.css"

if (-not (Test-Path $style)) {
    Write-Host "ERROR: style.css was not found. Put this file inside the main lumio folder." -ForegroundColor Red
    exit 1
}

$backup = Join-Path (Get-Location) "style.css.backup-before-cart-fix"
Copy-Item $style $backup -Force

$css = @'

/* =========================================================
   H&A.HOME - CART ICON FIX
   Makes the same bag/cart icon appear on every page.
   Does not change cart logic or checkout.
   ========================================================= */

.cart {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    font-size: 0 !important;
}

.cart::before {
    content: "";
    display: block;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 8h12l1 12H5L6 8Z' fill='none' stroke='%2330251e' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M9 8V6a3 3 0 0 1 6 0v2' fill='none' stroke='%2330251e' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}

/* On the homepage the SVG already exists, so don't show a second icon. */
.cart:has(.cart-icon)::before {
    display: none;
}

.cart #cart-count {
    font-size: 11px !important;
}

'@

Add-Content -Path $style -Value $css -Encoding UTF8

Write-Host ""
Write-Host "DONE: cart icon CSS was added to style.css." -ForegroundColor Green
Write-Host "A backup was created as: style.css.backup-before-cart-fix"
Write-Host ""
Write-Host "Now restart the server and hard-refresh the pages (Ctrl+F5)."
