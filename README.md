# Unreal Engine Python (Visual Studio Code)

Editor features to assist when writing Python code for Unreal Engine.

<br>

## Features

### Execute Code

Run code in Unreal Engine directly from within the editor:

![execute code in unreal demo](https://github.com/nils-soderman/vscode-unreal-python/blob/main/media/demo/demo-exec.webp?raw=true)

Command: `Unreal Python: Execute` <br>
Keyboard Shortcut: <kbd>Ctrl</kbd> + <kbd>Enter</kbd>

The selected text will be executed, or if nothing is selected the entire document will be executed.

<br>

### Setup Code Completion
Setup code completion for the `unreal` module based on the current project.

![code completion demo](https://github.com/nils-soderman/vscode-unreal-python/blob/main/media/demo/demo-codecompletion.jpg?raw=true)

Command: `Unreal Python: Setup code completion`

<br>

### Debugging
Attach VS Code to Unreal Engine to debug your scripts, set breakpoints and step through the code.

![debug unreal python scripts demo](https://github.com/nils-soderman/vscode-unreal-python/blob/main/media/demo/demo-attach.webp?raw=true)

Command: `Unreal Python: Attach`

<br>


### Documentation
Browse the Unreal Engine Python documentation inside VS Code. This documentation is generated on the fly based on the currently opened Unreal Engine instance, therefore it will always be up to date & include any custom C++ functions/classes that you have exposed to Blueprint/Python.

![browse Unreal Engine's Python Documentation in VS Code demo](https://github.com/nils-soderman/vscode-unreal-python/blob/main/media/demo/demo-documentation.webp?raw=true)

Command: `Unreal Python: Open Documentation`

<br>

#### Notes:
* Commands can be run from VS Code's command palette, `Show All Commands` _(Default shortcut: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>)_
* Remote Execution must be enabled in Unreal Engine for this extension to work, [more details here](https://github.com/nils-soderman/vscode-unreal-python/wiki/Failed-to-connect-to-Unreal-Engine-%5BTroubleshooting%5D "Enable Unreal Engine Remote Execution - Wiki").

<br>

# Contact
If you have any questions, feature requests or run into any bugs, don't hesitate to get in contact with me:

[Report an issue](https://github.com/nils-soderman/vscode-unreal-python/issues "Report an issue on the GitHub repository")<br>
[Personal Website](https://nilssoderman.com)<br>

<br>

_* This is a third-party extension and is not associated with Unreal Engine or Epic Games in any way._
