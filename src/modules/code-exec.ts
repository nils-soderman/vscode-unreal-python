/**
 * Module for retriving an executable python file based on the current file/selection in Visual Studio Code
 */

import * as vscode from 'vscode';
import * as fs from 'fs';


/**
 * Get the user selection from VS Code as a python executable string
 */
export function getSelectedTextAsExecutableString() {
    if (!vscode.window.activeTextEditor) {
        return;
    }

    const activeDocumenet = vscode.window.activeTextEditor.document;
    let executableCodeString = "";

    let selections: Array<vscode.Selection> = [vscode.window.activeTextEditor.selection];

    // Sort the selections them by their start line number
    if (vscode.window.activeTextEditor.selections.length > 1) {
        // Add selections into an array that we can run the sort function on
        selections = [];
        for (const selection of vscode.window.activeTextEditor.selections) {
            selections.push(selection);
        }

        selections = selections.sort(function (a: any, b: any) {
            return a.start.line - b.start.line;
        });
    }

    // Combine all selections into a single string
    for (const selection of selections) {
        if (!selection.isEmpty) {

            // Get the character index of the first character that's not whitespace (on the first line that's not whitespace)
            let firstCharIndex = -1;
            for (let i = 0; i <= (selection.end.line - selection.start.line); i++) {
                const line = activeDocumenet.lineAt(selection.start.line + i);
                if (!line.isEmptyOrWhitespace) {
                    firstCharIndex = line.firstNonWhitespaceCharacterIndex;
                    break;
                }
            }

            // Add empty lines to match line numbers with the actual source file.
            // This is to make sure you get correct line numbers for error messages & to make sure
            // breakpoints work correctly.
            const numberOfLines = executableCodeString.split("\n").length - 1;
            const additionalEmptyLines = "\n".repeat(selection.start.line - numberOfLines);

            executableCodeString += additionalEmptyLines + formatSelectedText(activeDocumenet.getText(selection), firstCharIndex);
        }
    }

    return executableCodeString;
}


/**
 * Try to make sure the text is runnable
 * This includes e.g. making sure that the code is correctly indented
 * @param text The text to format
 * @param firstCharIndex Index of the first character (how far it's indented)
 */
function formatSelectedText(text: string, firstCharIndex: number) {
    if (firstCharIndex <= 0) {
        return text;
    }

    let formattedText = "";
    let numCharactersToRemove = firstCharIndex;
    let i = 0;
    for (let line of text.split("\n")) {
        if (numCharactersToRemove) {
            if (i === 0) {
                line = line.trimStart();
            }
            else {
                const trimmedLine = line.trimStart();

                // Check if it's just an empty line or a comment
                if (!trimmedLine || trimmedLine[0] === "#") {
                    continue;
                }

                const numberOfWhitespaceCharacters = line.length - trimmedLine.length;
                if (numberOfWhitespaceCharacters < numCharactersToRemove) {
                    numCharactersToRemove = numberOfWhitespaceCharacters;
                }
                line = line.slice(numCharactersToRemove);
            }
        }

        formattedText += line + "\n";
        i++;
    }

    return formattedText;
}


/**
 * Save a file
 * @param filepath The absolute filepath
 * @param text Text to write to the file
 * @returns the absolute filepath of the file
 */
function saveFile(filepath: string, text: string) {
    fs.writeFileSync(filepath, text);
    return filepath;
}


/**
 * @param tempFilepath If a temp file needs to be saved, this path will be used
 * @returns The filepath to a executable python file based on the curerrent file/selection in VS Code
 */
export function getFileToExecute(tempFilepath: string) {
    if (!vscode.window.activeTextEditor) {
        return;
    }

    const activeDocuemt = vscode.window.activeTextEditor.document;
    const selectedCode = getSelectedTextAsExecutableString();

    // If user has any selected text, save the selection as a temp file
    if (selectedCode) {
        return saveFile(tempFilepath, selectedCode);
    }

    // If file is dirty, save a copy of the file
    else if (activeDocuemt.isDirty) {
        return saveFile(tempFilepath, activeDocuemt.getText());
    }

    // No selection and everything is saved, return the current file
    return activeDocuemt.uri.fsPath;
}