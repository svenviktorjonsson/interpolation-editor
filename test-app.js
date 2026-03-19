import InterpolationEditor from './interpolation-editor.js';

document.addEventListener('DOMContentLoaded', () => {
    const openEditorButton = document.getElementById('open-editor-button');
    const outputDisplayWrapper = document.getElementById('output-display-wrapper');
    const outputDisplay = document.getElementById('output-display');
    
    let currentInterpolationStyle = null;

    async function ensureWasmBridge() {
        if (globalThis.vektorWasm && typeof globalThis.vektorWasm.compute_interpolation === 'function') {
            return;
        }

        const candidates = ['./vektor_wasm/vektor.js'];

        let lastError = null;
        for (const modulePath of candidates) {
            try {
                const wasmModule = await import(modulePath);
                if (typeof wasmModule.default !== 'function' || typeof wasmModule.compute_interpolation !== 'function') {
                    throw new Error(`Module does not expose expected wasm API: ${modulePath}`);
                }
                await wasmModule.default();
                globalThis.vektorWasm = {
                    compute_interpolation(payload) {
                        return wasmModule.compute_interpolation(payload);
                    }
                };
                console.info(`Loaded real vektor WASM bridge from ${modulePath}`);
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw new Error(`Failed to load real vektor WASM bridge. Last error: ${lastError?.message || lastError}`);
    }

    async function setup() {
        await ensureWasmBridge();
        const editor = new InterpolationEditor({
            container: document.body,
            engineWasmApi: globalThis.vektorWasm,
            onSelect: (style) => {
                console.log('Style saved:', style);
                currentInterpolationStyle = style;
                displayStyleObject(currentInterpolationStyle);
            }
        });
        editor.initialize();

        openEditorButton.addEventListener('click', () => {
            editor.show();
        });

        outputDisplayWrapper.addEventListener('dblclick', () => {
            editor.show(currentInterpolationStyle);
        });
    }

    setup().catch((error) => {
        console.error('Failed to initialize interpolation editor wasm dependency', error);
        outputDisplay.textContent = `WASM init failed: ${error?.message || error}`;
        openEditorButton.disabled = true;
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