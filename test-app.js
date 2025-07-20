import InterpolationEditor from './interpolation-editor.js';

document.addEventListener('DOMContentLoaded', () => {
    const openEditorButton = document.getElementById('open-editor-button');
    const outputDisplayWrapper = document.getElementById('output-display-wrapper');
    const outputDisplay = document.getElementById('output-display');
    
    let currentInterpolationStyle = null;

    // Initialize the editor
    const editor = new InterpolationEditor({
        container: document.body, // Append the editor to the body
        onSelect: (style) => {
            // This callback is invoked when the 'Save Style' button is clicked
            console.log('Style saved:', style);
            currentInterpolationStyle = style;
            displayStyleObject(currentInterpolationStyle);
        }
    });
    editor.initialize();

    // Show the editor when the button is clicked
    openEditorButton.addEventListener('click', () => {
        // Open with no initial state to create a new style
        editor.show();
    });

    // Re-open the editor with the current style on double-click
    outputDisplayWrapper.addEventListener('dblclick', () => {
        editor.show(currentInterpolationStyle);
    });

    /**
     * Displays the style object as a formatted JSON string.
     * @param {object} style - The interpolation style object from the editor.
     */
    function displayStyleObject(style) {
        if (style) {
            outputDisplay.textContent = JSON.stringify(style, null, 2);
        } else {
            outputDisplay.textContent = 'No style saved yet.';
        }
    }
});