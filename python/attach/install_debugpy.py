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

    try:
        result = subprocess.run(args, capture_output=True, check=True, text=True)
        unreal.log(result.stdout)
        unreal.log(result.stderr)
    except subprocess.CalledProcessError as e:
        unreal.log_error(f"Failed to install debugpy: {e}")
        unreal.log_error(e.stdout)
        unreal.log_error(e.stderr)
    except Exception as e:
        unreal.log_error(f"Failed to install debugpy: {e}")

    # Check if installation was sucessfull by trying to import debugpy
    try:
        import debugpy
    except Exception as e:
        unreal.log_error(f"`import debugpy` -> {str(e)}")
        return

    return globals().get("success_id")  # The response the extension expects if the installation was successful


def main():
    install_dir = globals().get("install_dir")
    response = install_debugpy(install_dir)
    if response:
        # Output is read by the VS Code extension
        unreal.log(response)


main()
