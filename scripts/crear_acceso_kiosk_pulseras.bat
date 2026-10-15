@echo off
chcp 65001 > nul
echo =====================================================================
echo  MedCRM - Creador de Acceso Directo de Impresion Silenciosa (Kiosk)
echo  Impresora: TSC TDP-225 ^| Pulsera: ArgusID ProBand (240x25 mm)
echo =====================================================================
echo.

set "TARGET_URL=https://crm-agentico-nube.vercel.app/asesoramiento-recepcion"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "SHORTCUT_NAME=MedCRM - Recepcion Quirofano.lnk"
set "USER_DATA_DIR=%LOCALAPPDATA%\MedCRM_Kiosk"

:: Buscar ejecutable de Google Chrome o Microsoft Edge
set "BROWSER_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) else if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if "%BROWSER_EXE%"=="" (
    echo [ERROR] No se encontro Google Chrome ni Microsoft Edge instalado en las rutas habituales.
    pause
    exit /b 1
)

echo Navegador detectado: %BROWSER_EXE%
echo Destino: %TARGET_URL%
echo.

:: Crear el acceso directo en el escritorio mediante PowerShell
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%DESKTOP_DIR%\%SHORTCUT_NAME%'); " ^
  "$s.TargetPath = '%BROWSER_EXE%'; " ^
  "$s.Arguments = '--app=\"%TARGET_URL%\" --kiosk-printing --user-data-dir=\"%USER_DATA_DIR%\"'; " ^
  "$s.Description = 'Acceso MedCRM Recepcion con Impresion Silenciosa Directa'; " ^
  "$s.Save()"

if %ERRORLEVEL% equ 0 (
    echo [EXITO] Acceso directo creado exitosamente en su Escritorio:
    echo "%DESKTOP_DIR%\%SHORTCUT_NAME%"
    echo.
    echo INSTRUCCIONES DE USO:
    echo 1. Asegurese de que la TSC TDP-225 este encendida y conectada por USB.
    echo 2. Abra el CRM desde este nuevo acceso directo del escritorio.
    echo 3. En el primer uso, presione Imprimir Pulsera y confirme que la impresora predeterminada sea TSC TDP-225 con papel 240x25 mm.
    echo 4. A partir de alli, cada vez que pulse 'Imprimir Pulsera Termica', saldra instantaneamente sin ningun dialogo.
) else (
    echo [ERROR] Ocurrio un error al crear el acceso directo.
)

echo.
pause
