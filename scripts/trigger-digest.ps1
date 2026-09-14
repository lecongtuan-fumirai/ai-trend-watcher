# trigger-digest.ps1 - Kích hoạt AI Trend Watcher từ Windows Task Scheduler
# Hỗ trợ tự động wake máy từ sleep và chạy bù nếu máy tắt vào 9h sáng

$logPath = "C:\Users\tuanl\Documents\Devops\ai-trend-watcher\cache\task-scheduler.log"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logPath -Value "[$timestamp] [TRIGGER] Bắt đầu kích hoạt AI Trend Watcher từ Task Scheduler..."

try {
    # 1. Đảm bảo WSL Ubuntu-24.04 đang chạy
    wsl.exe -d Ubuntu-24.04 -e true

    # 2. Đảm bảo docker service trong WSL đang chạy
    wsl.exe -d Ubuntu-24.04 -u root -e /usr/sbin/service docker status | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Add-Content -Path $logPath -Value "[$timestamp] [INFO] Khởi động docker daemon trong WSL..."
        wsl.exe -d Ubuntu-24.04 -u root -e /usr/sbin/service docker start
    }

    # 3. Đảm bảo containers đang up
    wsl.exe -d Ubuntu-24.04 -e bash -c "cd /mnt/c/Users/tuanl/Documents/Devops/ai-trend-watcher && docker compose up -d"

    # 4. Kích hoạt chạy pipeline
    Add-Content -Path $logPath -Value "[$timestamp] [INFO] Đang gọi container ai_trend_watcher thực thi pipeline..."
    wsl.exe -d Ubuntu-24.04 -e docker exec ai_trend_watcher node src/main.js *>> $logPath
    Add-Content -Path $logPath -Value "[$timestamp] [SUCCESS] Pipeline hoàn tất."
} catch {
    Add-Content -Path $logPath -Value "[$timestamp] [ERROR] Lỗi khi kích hoạt: $_"
}
