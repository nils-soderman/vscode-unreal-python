""" 
This script checks if Developer Mode in Unreal is enabled, and prints the result (bool) to the console
"""
import configparser
import os

import unreal


CONFIG_SECTION = "/Script/PythonScriptPlugin.PythonScriptPluginUserSettings"
CONFIG_KEY = "bDeveloperMode"

CONFIG_FILENAME = "EditorPerProjectUserSettings.ini"


def get_devmode_enabled_key(config_filepath):
    config = configparser.ConfigParser(strict=False)
    config.read(config_filepath)
    return config.get(CONFIG_SECTION, CONFIG_KEY, fallback=None)


def is_devmode_enabled():
    # TODO: This would also need to check the Project settings, for "DevMode Enable (all users)"
    for root, directories, filenames in os.walk(unreal.Paths.generated_config_dir()):
        if CONFIG_FILENAME in filenames:
            value = get_devmode_enabled_key(os.path.join(root, CONFIG_FILENAME))
            if value is not None:
                return value

    return False


def main():
    unreal.log(is_devmode_enabled())


main()
