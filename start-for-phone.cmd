@echo off
chcp 65001 >nul
title One - доступ с телефона

echo.
echo   One: раздача по локальной сети
echo   ==================================
echo.
echo   Телефон должен быть в той же сети Wi-Fi, что и компьютер.
echo   Открой на телефоне в браузере один из этих адресов:
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do echo        http://%%b:8934
)

echo.
echo   Пока это окно открыто - приложение доступно.
echo   Чтобы остановить: закрой окно или нажми Ctrl+C.
echo.
echo   Учти: по такому адресу приложение НЕ установится на домашний
echo   экран и не будет работать офлайн - для этого нужен https
echo   (см. раздел "Как открыть на телефоне" в README.md).
echo.

python -m http.server 8934 --bind 0.0.0.0
pause
