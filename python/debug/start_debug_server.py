import unreal

import debugpy
import os

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_port"


def start_debug_server(port: int):
    python_exe = unreal.get_interpreter_executable_path()
    if not python_exe:
        return False

    debugpy.configure(python=python_exe)
    debugpy.listen(port)

    os.environ[VSCODE_DEBUG_SERVER_ENV_VAR] = str(port)

    return True


def main():
    port = globals().get("debug_port")
    if not port:
        return False
    
    is_server_running = start_debug_server(port)
    
    return is_server_running

# output is read by the VSCode extension
unreal.log(main())
