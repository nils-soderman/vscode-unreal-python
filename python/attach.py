from __future__ import annotations

import os

import unreal

VSCODE_DEBUG_SERVER_ENV_VAR = "vscode_debugpy_server_port"


def is_debugpy_installed() -> bool:
    """
    Tries to import debugpy to check if it is installed.
    """
    try:
        import debugpy
        return True
    except ModuleNotFoundError:
        return False


def install_debugpy() -> bool:
    """
    Installs debugpy using the current Unreal Python interpreter.
    """
    import subprocess

    python_exe = unreal.get_interpreter_executable_path()
    if not python_exe:
        return False

    debugpy_install_args = [python_exe, "-m", "pip", "install", "-q", "--no-warn-script-location", "debugpy"]

    try:
        result = subprocess.run(debugpy_install_args, capture_output=True, check=True, text=True)
        unreal.log(result.stdout)
        unreal.log(result.stderr)
    except subprocess.CalledProcessError as e:
        unreal.log_error(f"Failed to install debugpy: {e}")
        unreal.log_error(e.stdout)
        unreal.log_error(e.stderr)
    except Exception as e:
        unreal.log_error(f"Failed to install debugpy: {e}")

    # Make sure the installation was successful by trying to import debugpy
    import debugpy

    return True


def start_debugpy_server(port: int) -> bool:
    """ Starts a debugpy server on the specified port """
    import debugpy

    python_exe = unreal.get_interpreter_executable_path()
    if not python_exe:
        return False

    debugpy.configure(python=python_exe)
    debugpy.listen(port)

    os.environ[VSCODE_DEBUG_SERVER_ENV_VAR] = str(port)

    return True


def get_current_debugpy_port() -> int:
    """ Returns the current debugpy server port or -1 if it is not set """
    return int(os.environ.get(VSCODE_DEBUG_SERVER_ENV_VAR, -1))
