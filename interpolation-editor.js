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
        
        const buttonRow = createEl('div', { className: 'button-row' });
        buttonRow.append(
            createEl('button', { id: 'cancel-button', className: 'editor-button secondary', text: 'Cancel' }),
            createEl('button', { id: 'save-button', className: 'editor-button primary', text: 'Save Style' })
        );

        optionsPanel.append(optionsHeader, cornerGroup, tensionGroup, buttonRow);

        this.wrapper.append(previewPanel, stylePanel, optionsPanel);
        this.container.appendChild(this.wrapper);
    }

    _setupEventListeners() {
        const { tensionSlider, tensionInput, saveButton, cancelButton, styleNameInput } = this.elements;

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
        
        saveButton.addEventListener('click', () => {
            this.state.style.name = this.elements.styleNameInput.value;
            this.onSelect(this.state.style);
            this.hide();
        });
        
        cancelButton.addEventListener('click', () => {
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

    drawPreview() {
        if (!this.previewCtx) return;

        const ctx = this.previewCtx;
        const w = this.elements.previewCanvas.width;
        const h = this.elements.previewCanvas.height;

        // Clear canvas
        ctx.fillStyle = C.PREVIEW_BACKGROUND_COLOR;
        ctx.fillRect(0, 0, w, h);

        // Grid split for 2x2 preview cells
        ctx.strokeStyle = C.PREVIEW_GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        const drawScenario = ({ cell, points, edges, curves, closed = false }) => {
            const toCell = (pt) => ({
                x: cell.x + pt.x * cell.w,
                y: cell.y + pt.y * cell.h
            });

            const resolvedPoints = points.map(toCell);

            ctx.save();
            ctx.strokeStyle = C.PREVIEW_PATH_COLOR;
            ctx.lineWidth = 1.5;
            ctx.setLineDash(C.PREVIEW_DASH_PATTERN);
            edges.forEach(([a, b]) => {
                const p1 = resolvedPoints[a];
                const p2 = resolvedPoints[b];
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            });
            ctx.setLineDash([]);

            ctx.strokeStyle = C.PREVIEW_CURVE_COLOR;
            ctx.lineWidth = 2;
            curves.forEach((path) => {
                const pathPoints = path.map(index => resolvedPoints[index]);
                const curvePoints = U.calculateCubicSpline(pathPoints, this.state.style.tension, closed);
                ctx.beginPath();
                curvePoints.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            });

            ctx.fillStyle = C.PREVIEW_PATH_COLOR;
            resolvedPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, C.PREVIEW_POINT_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        };

        const halfW = w / 2;
        const halfH = h / 2;

        const scenarios = [
            {
                cell: { x: 0, y: 0, w: halfW, h: halfH },
                points: [
                    { x: 0.1, y: 0.75 },
                    { x: 0.25, y: 0.3 },
                    { x: 0.4, y: 0.65 },
                    { x: 0.6, y: 0.35 },
                    { x: 0.75, y: 0.7 },
                    { x: 0.9, y: 0.25 }
                ],
                edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
                curves: [[0, 1, 2, 3, 4, 5]],
                closed: false
            },
            {
                cell: { x: halfW, y: 0, w: halfW, h: halfH },
                points: [
                    { x: 0.1, y: 0.2 },
                    { x: 0.3, y: 0.75 },
                    { x: 0.45, y: 0.25 },
                    { x: 0.6, y: 0.8 },
                    { x: 0.75, y: 0.35 },
                    { x: 0.9, y: 0.7 }
                ],
                edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
                curves: [[0, 1, 2, 3, 4, 5]],
                closed: false
            },
            {
                cell: { x: 0, y: halfH, w: halfW, h: halfH },
                points: [
                    { x: 0.2, y: 0.2 },
                    { x: 0.4, y: 0.1 },
                    { x: 0.65, y: 0.2 },
                    { x: 0.8, y: 0.5 },
                    { x: 0.6, y: 0.75 },
                    { x: 0.3, y: 0.7 }
                ],
                edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
                curves: [[0, 1, 2, 3, 4, 5, 0]],
                closed: true
            },
            {
                cell: { x: halfW, y: halfH, w: halfW, h: halfH },
                points: [
                    { x: 0.1, y: 0.5 }, // incoming
                    { x: 0.45, y: 0.5 }, // center
                    { x: 0.85, y: 0.2 }, // outgoing 1
                    { x: 0.85, y: 0.8 }, // outgoing 2
                    { x: 0.6, y: 0.1 }, // outgoing 3
                    { x: 0.6, y: 0.9 }  // outgoing 4
                ],
                edges: [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
                curves: [
                    [0, 1, 2],
                    [0, 1, 3],
                    [0, 1, 4],
                    [0, 1, 5]
                ],
                closed: false
            }
        ];

        scenarios.forEach(drawScenario);
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