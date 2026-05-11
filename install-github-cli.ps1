# Quick GitHub CLI Installer
# Run this script to install GitHub CLI

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GitHub CLI Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as administrator" -ForegroundColor Yellow
    Write-Host "Some installation methods may require admin rights" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Choose installation method:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Download installer (MSI) - Recommended" -ForegroundColor White
Write-Host "2. Install via Chocolatey (if installed)" -ForegroundColor White
Write-Host "3. Install via Scoop (if installed)" -ForegroundColor White
Write-Host "4. Manual download instructions" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Downloading GitHub CLI installer..." -ForegroundColor Yellow

        $downloadUrl = "https://github.com/cli/cli/releases/latest/download/gh_windows_amd64.msi"
        $installerPath = "$env:TEMP\gh_installer.msi"

        try {
            Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
            Write-Host "[OK] Downloaded successfully" -ForegroundColor Green
            Write-Host ""
            Write-Host "Running installer..." -ForegroundColor Yellow
            Start-Process msiexec.exe -ArgumentList "/i `"$installerPath`" /qb" -Wait
            Write-Host "[OK] Installation complete" -ForegroundColor Green
            Write-Host ""
            Write-Host "Cleaning up..." -ForegroundColor Yellow
            Remove-Item $installerPath -Force

            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "GitHub CLI installed successfully!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "Please close this PowerShell window and open a new one" -ForegroundColor Yellow
            Write-Host "Then run: .\push-to-github.ps1" -ForegroundColor Cyan
        }
        catch {
            Write-Host "[ERROR] Failed to download or install" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            Write-Host ""
            Write-Host "Please download manually from:" -ForegroundColor Yellow
            Write-Host "https://cli.github.com/" -ForegroundColor White
        }
    }

    "2" {
        Write-Host ""
        Write-Host "Installing via Chocolatey..." -ForegroundColor Yellow

        if (Get-Command choco -ErrorAction SilentlyContinue) {
            choco install gh -y
            Write-Host "[OK] Installation complete" -ForegroundColor Green
            Write-Host ""
            Write-Host "Please close this PowerShell window and open a new one" -ForegroundColor Yellow
            Write-Host "Then run: .\push-to-github.ps1" -ForegroundColor Cyan
        }
        else {
            Write-Host "[ERROR] Chocolatey not installed" -ForegroundColor Red
            Write-Host "Install Chocolatey from: https://chocolatey.org/" -ForegroundColor Yellow
        }
    }

    "3" {
        Write-Host ""
        Write-Host "Installing via Scoop..." -ForegroundColor Yellow

        if (Get-Command scoop -ErrorAction SilentlyContinue) {
            scoop install gh
            Write-Host "[OK] Installation complete" -ForegroundColor Green
            Write-Host ""
            Write-Host "Please close this PowerShell window and open a new one" -ForegroundColor Yellow
            Write-Host "Then run: .\push-to-github.ps1" -ForegroundColor Cyan
        }
        else {
            Write-Host "[ERROR] Scoop not installed" -ForegroundColor Red
            Write-Host "Install Scoop from: https://scoop.sh/" -ForegroundColor Yellow
        }
    }

    "4" {
        Write-Host ""
        Write-Host "Manual installation instructions:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Open browser and go to:" -ForegroundColor White
        Write-Host "   https://cli.github.com/" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "2. Click 'Download for Windows'" -ForegroundColor White
        Write-Host ""
        Write-Host "3. Run the downloaded .msi installer" -ForegroundColor White
        Write-Host ""
        Write-Host "4. After installation, close PowerShell and open new window" -ForegroundColor White
        Write-Host ""
        Write-Host "5. Run: .\push-to-github.ps1" -ForegroundColor White
        Write-Host ""

        $openBrowser = Read-Host "Open download page in browser? (y/n)"
        if ($openBrowser -eq "y") {
            Start-Process "https://cli.github.com/"
        }
    }

    default {
        Write-Host "[ERROR] Invalid choice" -ForegroundColor Red
    }
}

Write-Host ""
pause
