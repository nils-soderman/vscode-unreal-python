import sys

import unreal


def is_debugpy_installed(extra_sys_path=""):
    try:
        import debugpy
        return True
    except:
        pass

    if extra_sys_path and extra_sys_path not in sys.path:
        sys.path.append(extra_sys_path)
        is_installed = False
        try:
            import debugpy
            is_installed = True
        except:
            pass

        sys.path.remove(extra_sys_path)
        return is_installed

    return False


def main():
    extra_sys_path = globals().get("extra_path")
    installed = is_debugpy_installed(extra_sys_path)

    # output is sent back to VS Code
    unreal.log(installed)

main()
