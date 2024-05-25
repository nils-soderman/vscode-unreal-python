import unreal


def log():
    print('Hello World')

    unreal.log("Logging Info")
    unreal.log_warning("Logging Warning")
    unreal.log_error("Logging Error")


def error():
    print('Exception:')
    Test = 1/0


def non_ascii():
    print('你好世界')


def large_output():
    engine_content = unreal.EditorAssetLibrary.list_assets('/Engine')
    for item in engine_content[:1000]:
        print(item)
    print('Done.')


def message_box():
    result = unreal.EditorDialog().show_message("Title", "Hello World", unreal.AppMsgType.YES_NO_CANCEL, unreal.AppReturnType.YES)
    print(f"{result = }")


def workspace_import():
    import other_module
    other_module.hello_world()



log()
