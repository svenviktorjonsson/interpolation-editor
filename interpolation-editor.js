// interpolation-editor.js
import * as C from './constants.js';
import * as U from './utils.js';

export default class InterpolationEditor {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onSelect = options.onSelect || (() => {});

        this.state = {
            style: JSON.parse(JSON.stringify(C.DEFAULT_STYLE)),
            // Future-proofing
            isDirty: false,
            undoStack: [],
            redoStack: [],
        };

        this.wrapper = null; // Will be the main container element
        this.elements = {}; // Will hold references to key DOM elements
        this.previewCtx = null;
    }

    initialize() {
        if (this.wrapper) return;
        this._initializeDOM();
        this._setupEventListeners();
        this._updateUIFromState();
        this.drawPreview();
    }

    _initializeDOM() {
        this.elements = {};

        const createEl = (tag, options = {}) => {
            const el = document.createElement(tag);
            if (options.id) {
                el.id = options.id;
                const camelCaseId = options.id.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
                this.elements[camelCaseId] = el;
            }
            if (options.className) el.className = options.className;
            if (options.text) el.textContent = options.text;
            if (options.value) el.value = options.value;
            if (options.type) el.type = options.type;
            if (options.name) el.name = options.name;
            for (const key in options.attrs) {
                el.setAttribute(key, options.attrs[key]);
            }
            return el;
        };

        this.wrapper = createEl('div', { id: 'interpolation-editor-wrapper', className: 'interpolation-editor-container' });
        this.wrapper.style.display = 'none';

        // --- Preview Panel (Left, 2x2) ---
        const previewPanel = createEl('div', { className: 'editor-panel preview-panel' });
        const previewHeader = createEl('div', { className: 'panel-header', text: 'Preview' });
        const previewCanvasContainer = createEl('div', { className: 'preview-canvas-container' });

        this.elements.previewCanvas = createEl('canvas', { id: 'preview-canvas' });
        this.elements.previewCanvas.width = C.PREVIEW_CANVAS_WIDTH;
        this.elements.previewCanvas.height = C.PREVIEW_CANVAS_HEIGHT;
        this.previewCtx = this.elements.previewCanvas.getContext('2d');
        
        previewCanvasContainer.append(this.elements.previewCanvas);
        previewPanel.append(previewHeader, previewCanvasContainer);

        // --- Style Panel (Top Right, 2x1) ---
        const stylePanel = createEl('div', { className: 'editor-panel style-panel' });
        const styleHeader = createEl('div', { className: 'panel-header', text: 'Style' });
        
        const nameGroup = createEl('div', { className: 'parameter-group' });
        nameGroup.append(
            createEl('div', { className: 'parameter-group-header', text: 'Style Name' }),
            createEl('input', { type: 'text', id: 'style-name-input', className: 'value-input', attrs: { style: 'text-align: left; padding: 4px 8px;' }})
        );
        stylePanel.append(styleHeader, nameGroup);

        // --- Options Panel (Bottom Right, 2x1) ---
        const optionsPanel = createEl('div', { className: 'editor-panel options-panel' });
        const optionsHeader = createEl('div', { className: 'panel-header', text: 'Options' });

        // Corner Handling
        const cornerGroup = createEl('div', { className: 'parameter-group' });
        const cornerRadioGroup = createEl('div', { className: 'radio-button-group' });
        cornerRadioGroup.append(
            createEl('input', { type: 'radio', id: 'ch-pass', name: 'cornerHandling', value: C.CORNER_HANDLING.PASS_THROUGH }),
            createEl('label', { text: 'Pass Through', attrs: { for: 'ch-pass' } }),
            createEl('input', { type: 'radio', id: 'ch-cut', name: 'cornerHandling', value: C.CORNER_HANDLING.CUT_ALL }),
            createEl('label', { text: 'Cut All', attrs: { for: 'ch-cut' } }),
            createEl('input', { type: 'radio', id: 'ch-mixed', name: 'cornerHandling', value: C.CORNER_HANDLING.MIXED }),
            createEl('label', { text: 'Mixed', attrs: { for: 'ch-mixed' } })
        );
        cornerGroup.append(
            createEl('div', { className: 'parameter-group-header', text: 'Corner Handling' }),
            cornerRadioGroup
        );

        // Tension Slider
        const tensionGroup = createEl('div', { className: 'parameter-group' });
        const tensionSliderContainer = createEl('div', { className: 'slider-container' });
        tensionSliderContainer.append(
            createEl('input', { type: 'range', id: 'tension-slider', attrs: { min: '0', max: '1', step: '0.01' } }),
            createEl('input', { type: 'number', id: 'tension-input', attrs: { min: '0', max: '1', step: '0.01' } })
        );
        tensionGroup.append(
            createEl('div', { className: 'parameter-group-header', text: 'Tension' }),
            tensionSliderContainer
        );
        
        const buttonRow = createEl('div', { className: 'button-container' });
        buttonRow.append(
            createEl('button', { id: 'close-button', className: 'close-button', text: 'Close' }),
            createEl('button', { id: 'select-button', className: 'select-button', text: 'Select' })
        );

        optionsPanel.append(optionsHeader, cornerGroup, tensionGroup, buttonRow);

        this.wrapper.append(previewPanel, stylePanel, optionsPanel);
        this.container.appendChild(this.wrapper);
    }

    _setupEventListeners() {
        const { tensionSlider, tensionInput, styleNameInput } = this.elements;

        styleNameInput.addEventListener('change', (e) => {
            this.state.style.name = e.target.value;
        });
        
        this.wrapper.querySelectorAll('input[name="cornerHandling"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.state.style.cornerHandling = e.target.value;
                    this.drawPreview();
                }
            });
        });

        const syncTension = (value) => {
            this.state.style.tension = parseFloat(value);
            tensionSlider.value = this.state.style.tension;
            tensionInput.value = this.state.style.tension;
            this.drawPreview();
        };

        tensionSlider.addEventListener('input', (e) => syncTension(e.target.value));
        tensionInput.addEventListener('change', (e) => syncTension(e.target.value));
        
        this.elements.selectButton.addEventListener('click', () => {
            this.state.style.name = this.elements.styleNameInput.value;
            this.onSelect(this.state.style);
            this.hide();
        });

        this.elements.closeButton.addEventListener('click', () => {
            this.hide();
        });
    }
    
    _updateUIFromState() {
        const { style } = this.state;
        const { styleNameInput, tensionSlider, tensionInput } = this.elements;
        
        styleNameInput.value = style.name;
        this.wrapper.querySelector(`input[name="cornerHandling"][value="${style.cornerHandling}"]`).checked = true;
        tensionSlider.value = style.tension;
        tensionInput.value = style.tension;
    }

    _drawCheckerboard(ctx, x, y, width, height) {
        const size = C.CHECKERBOARD_SIZE;
        const dark = C.COLOR_CHECKER_DARK;
        const light = C.COLOR_CHECKER_LIGHT;
        const cols = Math.ceil(width / size) + 1;
        const rows = Math.ceil(height / size) + 1;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? dark : light;
                ctx.fillRect(x + col * size, y + row * size, size, size);
            }
        }
    }

    drawPreview() {
        if (!this.previewCtx) return;

        const ctx = this.previewCtx;
        const w = this.elements.previewCanvas.width;
        const h = this.elements.previewCanvas.height;

        ctx.clearRect(0, 0, w, h);
        this._drawCheckerboard(ctx, 0, 0, w, h);

        // Draw sample path (e.g., a simple 'S' curve)
        const samplePoints = [
            { x: w * 0.1, y: h * 0.2 },
            { x: w * 0.4, y: h * 0.8 },
            { x: w * 0.6, y: h * 0.2 },
            { x: w * 0.9, y: h * 0.8 },
        ];
        
        // Draw the interpolated curve
        const curvePoints = U.calculateCubicSpline(samplePoints, this.state.style.tension, false);
        
        ctx.strokeStyle = C.PREVIEW_CURVE_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        curvePoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        ctx.fillStyle = C.PREVIEW_PATH_COLOR;
        samplePoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, C.PREVIEW_POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    show(styleToEdit = null) {
        if (styleToEdit) {
            this.state.style = JSON.parse(JSON.stringify(styleToEdit));
        } else {
            this.state.style = JSON.parse(JSON.stringify(C.DEFAULT_STYLE));
            this.state.style.id = `style_${Date.now()}`;
        }
        this.wrapper.style.display = 'grid';
        this._updateUIFromState();
        this.drawPreview();
    }

    hide() {
        this.wrapper.style.display = 'none';
    }
}