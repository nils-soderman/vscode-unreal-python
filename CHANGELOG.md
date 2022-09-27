# Change Log

## v0.0.2
[2022-xx-xx]

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
