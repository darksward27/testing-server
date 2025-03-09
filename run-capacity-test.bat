@echo off
setlocal

REM Configuration - replace with your Raspberry Pi's IP address
set RASPBERRY_PI_IP=your-raspberry-pi-ip

REM Set the API URL to point to the Kubernetes service
set API_URL=http://%RASPBERRY_PI_IP%:30080

echo ==================================
echo SERVER CAPACITY TEST
echo ==================================
echo Testing server at: %API_URL%
echo.

REM Run the capacity test with the remote server URL
set NODE_ENV=production
node capacity-test.js --server-url=%API_URL%

echo.
echo Test completed!
echo.

endlocal 