# Windows Desktop UI Automation Helper
param (
    [Parameter(Mandatory=$true)]
    [string]$Action,
    [int]$X = -1,
    [int]$Y = -1,
    [string]$Button = "left",
    [int]$Amount = 0,
    [string]$Text = "",
    [string]$Key = "",
    [string]$OutputPath = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# P/Invoke for mouse_event
if (-not ([System.Management.Automation.PSTypeName]'WinAutoMouse').Type) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class WinAutoMouse {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;
}
'@
}

switch ($Action.ToLower()) {
    "get-screen-size" {
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        Write-Output "$($screen.Width)x$($screen.Height)"
    }

    "mouse-move" {
        if ($X -ge 0 -and $Y -ge 0) {
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
            Write-Output "OK"
        } else {
            Write-Error "Invalid coordinates"
        }
    }

    "mouse-click" {
        if ($X -ge 0 -and $Y -ge 0) {
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
            Start-Sleep -Milliseconds 50
        }
        switch ($Button.ToLower()) {
            "right" {
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 30
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
            }
            "middle" {
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 30
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_MIDDLEUP, 0, 0, 0, 0)
            }
            default {
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
                Start-Sleep -Milliseconds 30
                [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
            }
        }
        Write-Output "OK"
    }

    "mouse-double-click" {
        if ($X -ge 0 -and $Y -ge 0) {
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($X, $Y)
            Start-Sleep -Milliseconds 50
        }
        [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        Start-Sleep -Milliseconds 80
        [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
        [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        Write-Output "OK"
    }

    "mouse-scroll" {
        $data = [BitConverter]::ToUInt32([BitConverter]::GetBytes([int32]$Amount), 0)
        [WinAutoMouse]::mouse_event([WinAutoMouse]::MOUSEEVENTF_WHEEL, 0, 0, $data, 0)
        Write-Output "OK"
    }

    "keyboard-type" {
        if ($Text) {
            $wsh = New-Object -ComObject WScript.Shell
            $wsh.SendKeys($Text)
            Write-Output "OK"
        } else {
            Write-Output "OK"
        }
    }

    "keyboard-press" {
        if ($Key) {
            $wsh = New-Object -ComObject WScript.Shell
            $mapped = switch ($Key.ToUpper()) {
                "ENTER" { "{ENTER}" }
                "RETURN" { "{ENTER}" }
                "TAB" { "{TAB}" }
                "ESCAPE" { "{ESC}" }
                "ESC" { "{ESC}" }
                "BACKSPACE" { "{BS}" }
                "DELETE" { "{DEL}" }
                "SPACE" { " " }
                "UP" { "{UP}" }
                "DOWN" { "{DOWN}" }
                "LEFT" { "{LEFT}" }
                "RIGHT" { "{RIGHT}" }
                "HOME" { "{HOME}" }
                "END" { "{END}" }
                "PAGEUP" { "{PGUP}" }
                "PAGEDOWN" { "{PGDN}" }
                default { $Key }
            }
            $wsh.SendKeys($mapped)
            Write-Output "OK"
        } else {
            Write-Output "OK"
        }
    }

    "capture-screen" {
        try {
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
            $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bmp)
            $graphics.CopyFromScreen(0, 0, 0, 0, $screen.Size)

            if ($OutputPath) {
                $bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
                Write-Output "FILE:$OutputPath"
            } else {
                $ms = New-Object System.IO.MemoryStream
                $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
                $bytes = $ms.ToArray()
                $base64 = [Convert]::ToBase64String($bytes)
                Write-Output "BASE64:$($screen.Width)x$($screen.Height):$base64"
                $ms.Dispose()
            }
            $graphics.Dispose()
            $bmp.Dispose()
        } catch {
            $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
            Write-Output "INTERFACE_READY:$($screen.Width)x$($screen.Height)"
        }
    }

    default {
        Write-Error "Unknown action: $Action"
    }
}
