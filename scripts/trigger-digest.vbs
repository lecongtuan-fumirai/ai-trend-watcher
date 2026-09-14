Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File ""C:\Users\tuanl\Documents\Devops\ai-trend-watcher\scripts\trigger-digest.ps1""", 0, False
