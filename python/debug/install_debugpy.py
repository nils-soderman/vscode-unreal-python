""" 
Moudle to install Debugpy
"""

import subprocess
import sys
import os


def get_unreal_python_executable():
    exe_path = sys.executable  # This will point to 'UnrealEditor.exe'
    for i in range(2):  # Go back two folders
        exe_path = os.path.dirname(exe_path)

    exe_path = os.path.join(exe_path, "ThirdParty", "Python3", "Win64", "python.exe")

    if os.path.isfile(exe_path):
        return exe_path


def install_debugpy(target=""):
    python_exe = get_unreal_python_executable()
    if not python_exe:
        return False
    
    args = [python_exe, "-m", "pip", "install", "debugpy"]   
    if target:
        args.append(f'--target="{target}"')

    subprocess.call(args)

    # Check if installation was sucessfull by trying to import debugpy
    try:
        import debugpy
    except:
        return False

    return True


def main():
    install_dir = globals().get("install_dir")
    success = install_debugpy(install_dir)

    # Output is read by the VS Code extension
    print(success)


main()
