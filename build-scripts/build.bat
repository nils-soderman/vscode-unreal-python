@REM Build the webview
cd "%~dp0../webview-ui"
call build.bat

@REM Clear extension output
cd "%~dp0../"
rmdir /S /Q "./out/"

@REM Make sure the output directory exists
set OutDir="./builds/"
if not exist %OutDir% (
    mkdir %OutDir%
)

@REM Build the extension
vsce package --out %OutDir%