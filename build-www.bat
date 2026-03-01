@echo off
echo Building www folder...

if exist www rmdir /s /q www

mkdir www
mkdir www\css
mkdir www\js
mkdir www\icons

copy index.html www\index.html
copy manifest.json www\manifest.json
copy sw.js www\sw.js

xcopy css www\css /E /I /Y
xcopy js www\js /E /I /Y
xcopy icons www\icons /E /I /Y

echo Done! www folder is ready.