import debugpy
import socket
import sys
import os

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_port"

def get_unreal_python_executable():
    exe_path = sys.executable  # This will point to 'UnrealEditor.exe'
    for i in range(2):  # Go back two folders
        exe_path = os.path.dirname(exe_path)

    exe_path = os.path.join(exe_path, "ThirdParty", "Python3", "Win64", "python.exe")

    if os.path.isfile(exe_path):
        return exe_path


def start_debug_server(port: int):
    python_exe = get_unreal_python_executable()
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
print(main())
