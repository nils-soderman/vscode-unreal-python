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


log()
