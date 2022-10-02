import debugpy
import socket
import sys
import os

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_enabled"

def get_unreal_python_executable():
    exe_path = sys.executable  # This will point to 'UnrealEditor.exe'
    for i in range(2):  # Go back two folders
        exe_path = os.path.dirname(exe_path)

    exe_path = os.path.join(exe_path, "ThirdParty", "Python3", "Win64", "python.exe")

    if os.path.isfile(exe_path):
        return exe_path


def is_port_available(port):
    """ Check if a port is avaliable """
    temp_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    temp_socket.settimeout(0.05)
    response = temp_socket.connect_ex(("127.0.0.1", port))
    temp_socket.close()
    return response != 0


def is_debug_server_running():
    """ Check if a debug server already has been started in this MB instance """
    return os.environ.get(VSCODE_DEBUG_SERVER_ENV_VAR, "") == str(True)


def start_debug_server(port = 6868):
    if is_debug_server_running():
        return True

    python_exe = get_unreal_python_executable()
    if not python_exe:
        return False
    
    if not is_port_available(port):
        return False

    debugpy.configure(python=python_exe)
    debugpy.listen(port)

    os.environ[VSCODE_DEBUG_SERVER_ENV_VAR] = str(True)

    return True


def main():
    port = globals().get("debug_port")
    if not port:
        return False
    
    is_server_running = start_debug_server()
    
    return is_server_running

# output is read by the VSCode extension
print(main())
