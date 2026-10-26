@echo off
setlocal
title LSP Live - servidor local
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias, espera un momento...
  call npm install
  if errorlevel 1 goto error
)

echo.
echo   LSP Live  ->  http://127.0.0.1:5180
echo   Permite el acceso a la camara cuando el navegador lo pida.
echo   Cierra esta ventana para detener el servidor.
echo.

node node_modules\vite\bin\vite.js --port 5180 --strictPort --open
goto end

:error
echo.
echo No se pudieron instalar las dependencias. Revisa que Node.js este instalado.
pause

:end
endlocal
