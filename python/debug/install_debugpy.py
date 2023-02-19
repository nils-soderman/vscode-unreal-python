""" Moudle to install Debugpy """
import subprocess

import unreal


def install_debugpy(target=""):
    python_exe = unreal.get_interpreter_executable_path()
    if not python_exe:
        return False

    args = [python_exe, "-m", "pip", "install", "debugpy"]
    if target:
        args.append(f'--target="{target}"')

    subprocess.call(args)

    # Check if installation was sucessfull by trying to import debugpy
    try:
        import debugpy
    except ModuleNotFoundError:
        return False

    return True


def main():
    install_dir = globals().get("install_dir")
    success = install_debugpy(install_dir)

    # Output is read by the VS Code extension
    print(success)


main()
