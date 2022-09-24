cd "%~dp0../"
rmdir /S /Q "./out/"

set OutDir="./builds/"

if not exist %OutDir% (
    mkdir %OutDir%
)

vsce package --out %OutDir%