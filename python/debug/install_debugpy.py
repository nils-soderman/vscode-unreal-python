""" Moudle to install Debugpy """
import subprocess

import unreal
from io import StringIO

def install_debugpy(target=""):
    python_exe = unreal.get_interpreter_executable_path()
    if not python_exe:
        return False

    args = [python_exe, "-m", "pip", "install", "debugpy"]
    if target:
        args.append(f'--target="{target}"')


    try:
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        with process.stdout:
            for line in iter(process.stdout.readline, b""):
                unreal.log_warning(line.decode("utf-8").strip())
    except Exception as e:
        unreal.log_error(f"Failed to install debugpy: {e}")

    # Check if installation was sucessfull by trying to import debugpy
    try:
        import debugpy
    except Exception as e:
        unreal.log_warning(str(e))
        return False

    return True


def main():
    install_dir = globals().get("install_dir")
    success = install_debugpy(install_dir)

    # Output is read by the VS Code extension
    print(success)


main()
