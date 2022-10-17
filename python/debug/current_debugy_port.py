""" 
Module to get the port of the current debugpy server
"""

import os

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_port"


def main():
    return os.environ.get(VSCODE_DEBUG_SERVER_ENV_VAR, None)


print(main())
