import unreal

def Log():
    print('Hello World')

    unreal.log("Logging Info")
    unreal.log_warning("Logging Warning")
    unreal.log_error("Logging Error")


def Error():
    print('Exception:')
    Test = 1/0

