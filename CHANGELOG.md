# Change Log

## [1.8.0] - UNRELEASED

- Added command `Unreal Python: Reload Modules` that reloads all modules within the current workspace folder(s)

## [1.7.1] - 2025-04-06

- Fixed executing code not working with Python versions below 3.8 [#46](https://github.com/nils-soderman/vscode-unreal-python/issues/46)

## [1.7.0] - 2025-03-16

- Printing the last expression is now the default behavior, and setting `ue-python.experimental.printLastExpression` has been removed [#38](https://github.com/nils-soderman/vscode-unreal-python/issues/38)
- The 'UE Python Log' output channel is now of type `LogOutputChannel`, leading to improved readability
- Suppress deprecation warnings when opening the documentation
- Fixed user `SyntaxError` not formatted correctly when executing unsaved files


## [1.6.3] - 2025-01-15

- Fixed user exceptions not being formatted correctly

## [1.6.2] - 2025-01-11

- Fixed formatting user exceptions not working in Python versions below 3.11


## [1.6.1] - 2025-01-06

- Fixed some documentation pages not working due to data not being parsed correctly

## [1.6.0] - 2025-01-06

- Code is no longer parsed twice when using `ue-python.experimental.printLastExpression`
- Changed how the extension communicates with Unreal, removing some unwanted prints to stdout
- Improved how user tracebacks are handled
- Documentation data is no longer written to a file, all data is now sent over the socket [#40](https://github.com/nils-soderman/vscode-unreal-python/issues/40)

## [1.5.0] - 2024-11-17

- Added experimental setting `ue-python.experimental.printLastExpression` that wraps the last expression in a `print()` statement when executing code, mimicking the behavior of the Python REPL [#38](https://github.com/nils-soderman/vscode-unreal-python/issues/38)

## [1.4.1] - 2024-08-25

- Fixed stepping over indented code not always working correctly
- Show an error message if [ms-python.vscode-pylance](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance) is not installed and _"Setup Code Completion"_ is run
- Fixed error if trying to attach to the same Unreal Engine instance multiple times
- Use VS Code's API for opening external URLs

## [1.4.0] - 2024-05-26

- Added Support for relative import _(if the script is within sys.path's scope)_
- The VS Code workspace folders are now added to the Python path when connecting to Unreal. Set `ue-python.environment.addWorkspaceToPath` to `false` to disable this behaviour [#28](https://github.com/nils-soderman/vscode-unreal-python/issues/28)
- `ue-python.setupCodeCompletion` will now correctly insert the path in the correct setting scope _(user/workspace/folder)_
- Fixed traceback messages potentially having the wrong line number in the clickable URL

## [1.3.0] - 2024-04-13

- **Breaking change!** Renamed setting `ue-python.debug.port` to `ue-python.attach.port`. `ue-python.debug.port` has been deprecated and will be removed in a future release _(Contributed by [@F-Dudley](https://github.com/F-Dudley))_
- Added setting `ue-python.attach.justMyCode` to allow debugging of standard library modules. [#23](https://github.com/nils-soderman/vscode-unreal-python/issues/23) _(Contributed by [@F-Dudley](https://github.com/F-Dudley))_


## [1.2.1] - 2024-02-24

- Added new output channel _"UE Python Log"_ where extension logs are written to.
- Fixed folder settings being ignored when a workspace is opened.


## [1.2.0] - 2024-01-29

## Breaking changes:
- `ue-python.remote.multicastBindAddress` now defaults to "127.0.0.1" to match the new default value in Unreal Engine 5.3
- Renamed config `ue-python.remote.multicastBindAdress` to `ue-python.remote.multicastBindAddress` to fix spelling error.

### Changes:
- Fixed config `ue-python.remote.multicastBindAddress` not read correctly, always defaulting to "0.0.0.0".
- Fixed failed connection blocking new connections until user had interacted with the error message box.


## [1.1.1] - 2024-01-06

- Added regex validation for `ue-python.remote` settings that takes strings.
- Changes to the `ue-python.remote` settings no longer requires a restart of VS Code to take effect [#20](https://github.com/nils-soderman/vscode-unreal-python/issues/20)


## [1.1.0] - 2023-09-30

- Added setting `ue-python.execute.unattended` that allows the user to execute code with the `-unattended` flag [#14](https://github.com/nils-soderman/vscode-unreal-python/issues/14)
- Code is no longer executed with the `-unattended` flag by default [#14](https://github.com/nils-soderman/vscode-unreal-python/issues/14)
- Fixed functions/methods not displaying properly in the documentation
- Removed setting `ue-python.execute.enableShortcut`


## [1.0.0] - 2023-09-09

- Added command `ue-python.selectInstance` that allows the user to select which Unreal Engine instance to connect to. [#3](https://github.com/nils-soderman/vscode-unreal-python/issues/3)
- Added status bar item that shows the currently connected Unreal Engine instance
- Added success/error messages when setting up code completion
- `ue-python.remote.timeout` config is now in milliseconds instead of seconds. To be consistent with other VS Code timeout configs
- Output is no longer written to a file, it's instead transferred through the `unreal-remote-exectution` socket
    - [unreal-remote-exectution](https://www.npmjs.com/package/unreal-remote-execution) is now a standalone NodeJS package
- Catch any errors that occurs during the installation of debugpy and log them to the output
- The ReadMe now uses WebP animations instead of GIFs
- esbuild is now used for building the extension. Resulting in a smaller extension size and faster activation time


## [0.2.3] - 2023-06-21

- Fixed unreal functions `log`, `log_warning` & `log_error` not showing up in the VS Code output. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)
- Fixed output not showing up if it's too large. Issue [#8](https://github.com/nils-soderman/vscode-unreal-python/issues/8)


## [0.2.2] - 2023-03-26

- Documentation now caches the open states of the dropdowns
- Improved filtering for the Documentation
- Having a word selected will auto insert it into the searchbar when opening the documentation

- Fixed bug where selecting a single indented line of code would fail to execute.
- Documentation now remembers the applied filter when going back to the index page
- Fixed broken UI styling for the documentation
- Fixed not being able to open functions in the documentation


## [0.2.1] - 2023-03-13

- Added command "Unreal Python: Open Documentation" _(`ue-python.openDocumentation`)_ that opens the UE python documentation in a new tab.
- Removed documentation panel from the sidebar.
- Fixed Output not showing up in Unreal Engine's "Output Log" if not attached.
- Use UTF-8 to decode the files in Python


## [0.2.0] - 2023-02-18

- Added documentation sidebar
- Updated README.md to clarify that commands can be executed through the command palette. Closes [#2](https://github.com/nils-soderman/vscode-unreal-python/issues/2)
- Fixed settings not read correctly from the folder settings
- Fixed bug that would cause `Setup Code Completion` to continue asking the user to enable Developer Mode even if it was already enabled


## [0.1.2] - 2022-10-17

- Added configuration `ue-python.strictPort` that prevents this extension from automatically finding a free port, and will strictly only use the ports assigned in the config.
- Support for multiple VS Code instances connecting to the same Unreal Engine instance.

## [0.1.1] - 2022-10-09

- Added command `ue-python.setupCodeCompletion` that adds the '\<PROJECT\>/Intermediate/PythonStub/' path to `python.analysis.extraPaths`.

## [0.1.0] - 2022-10-06

- Added command `ue-python.attach` that attaches VS Code to Unreal Engine.
- Added configuration `ue-python.debug.port` to set which port to use for the python debugpy server.
- Removed the 'Settings' section from ReadMe.md


## [0.0.2] - 2022-10-01

- Added configuration `ue-python.execute.name` that set's the python `__name__` variable while executing code, defaults to "\_\_main\_\_".
- Added configuration `ue-python.execute.enableShortcut` which can be used to disable the `ue-python.execute` shortcut in specific workspaces
- Added a help button if it fails to connect with Unreal Engine, that will bring the user to a troubleshooting webpage
- The command `ue-python.execute` is now only enabled when a Python file is open
- Updated default value of `ue-python.remote.timeout` to be 3 seconds.


## [0.0.1] - 2022-09-25

- Initial pre-release
