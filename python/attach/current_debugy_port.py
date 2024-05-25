""" Module to get the port of the current debugpy server """

import os

import unreal

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_port"


def main():
    return os.environ.get(VSCODE_DEBUG_SERVER_ENV_VAR, None)


unreal.log(main())
