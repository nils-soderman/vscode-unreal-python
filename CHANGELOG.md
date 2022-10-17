# Change Log

## v0.1.2
[2022-10-17]

### Added: 
- Added configuration `ue-python.strictPort` that prevents this extension from automatically finding a free port, and will strictly only use the ports assigned in the config.

### Fixed:
- Support for multiple VS Code instances connecting to the same Unreal Engine instance.

<br>

___

## v0.1.1
[2022-10-09]

### Added: 
- Added command `ue-python.setupCodeCompletion` that adds the '\<PROJECT\>/Intermediate/PythonStub/' path to `python.analysis.extraPaths`.

<br>

___

## v0.1.0
[2022-10-06]

### Added: 
- Added command `ue-python.attach` that attaches VS Code to Unreal Engine.
- Added configuration `ue-python.debug.port` to set which port to use for the python debugpy server.

### Changed:
- Removed the 'Settings' section from ReadMe.md

<br>

___

## v0.0.2
[2022-10-01]

### Added:

- Added configuration `ue-python.execute.name` that set's the python `__name__` variable while executing code, defaults to "\_\_main\_\_".
- Added configuration `ue-python.execute.enableShortcut` which can be used to disable the `ue-python.execute` shortcut in spesific workspaces
- Added a help button if it fails to connect with Unreal Engine, that will bring the user to a troubleshooting webpage

### Changed:

- The command `ue-python.execute` is now only enabled when a Python file is open
- Updated default value of `ue-python.remote.timeout` to be 3 seconds.

<br>

___


## v0.0.1
[2022-09-25]

- Initial pre-release
