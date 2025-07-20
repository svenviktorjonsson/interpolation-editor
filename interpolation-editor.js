// interpolation-editor.js
import * as C from './constants.js';
import * as U from './utils.js';

export default class InterpolationEditor {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.currentStyle = JSON.parse(JSON.stringify(C.DEFAULT_STYLE));
        
        this.element = null;
        this.previewCanvas = null;
        this.previewCtx = null;

        // Placeholder for event emitting
        this.onSelect = options.onSelect || (() => {});
    }

    initialize() {
        if (this.element) return;
        this._createDOM();
        this._addEventListeners();
        this._updateUIFromState();
        this.drawPreview();
    }

    _createDOM() {
        this.element = document.createElement('div');
        this.element.className = 'interpolation-editor-container';
        this.element.style.display = 'none'; // Initially hidden

        // Left Side: Preview Panel
        const previewPanel = document.createElement('div');
        previewPanel.className = 'preview-panel';
        this.previewCanvas = document.createElement('canvas');
        this.previewCanvas.id = 'preview-canvas';
        this.previewCanvas.width = C.PREVIEW_CANVAS_WIDTH;
        this.previewCanvas.height = C.PREVIEW_CANVAS_HEIGHT;
        this.previewCtx = this.previewCanvas.getContext('2d');
        previewPanel.appendChild(this.previewCanvas);
        
        // Right Side: Controls Panel
        const controlsPanel = document.createElement('div');
        controlsPanel.className = 'controls-panel';
        
        // --- Name Input ---
        controlsPanel.innerHTML += `
            <div class="parameter-group">
                <div class="parameter-group-header">Style Name</div>
                <input type="text" id="style-name-input" value="${this.currentStyle.name}" class="value-input" style="text-align: left; padding: 4px 8px;">
            </div>
        `;
        
        // --- Corner Handling ---
        controlsPanel.innerHTML += `
            <div class="parameter-group">
                <div class="parameter-group-header">Corner Handling</div>
                <div class="radio-button-group">
                    <input type="radio" id="ch-pass" name="cornerHandling" value="${C.CORNER_HANDLING.PASS_THROUGH}" checked>
                    <label for="ch-pass">Pass Through</label>
                    <input type="radio" id="ch-cut" name="cornerHandling" value="${C.CORNER_HANDLING.CUT_ALL}">
                    <label for="ch-cut">Cut All</label>
                    <input type="radio" id="ch-mixed" name="cornerHandling" value="${C.CORNER_HANDLING.MIXED}">
                    <label for="ch-mixed">Mixed</label>
                </div>
            </div>
        `;
        
        // --- Tension Slider (for Spline) ---
        controlsPanel.innerHTML += `
             <div class="parameter-group">
                <div class="parameter-group-header">Tension</div>
                <div class="slider-container">
                    <input type="range" id="tension-slider" min="0" max="1" step="0.01" value="${this.currentStyle.tension}">
                    <input type="number" id="tension-input" min="0" max="1" step="0.01" value="${this.currentStyle.tension}">
                </div>
            </div>
        `;

        // --- Buttons ---
        const buttonRow = document.createElement('div');
        buttonRow.className = 'button-row';
        buttonRow.innerHTML = `
            <button class="editor-button secondary" id="cancel-button">Cancel</button>
            <button class="editor-button primary" id="save-button">Save Style</button>
        `;
        controlsPanel.appendChild(buttonRow);
        
        this.element.appendChild(previewPanel);
        this.element.appendChild(controlsPanel);
        this.container.appendChild(this.element);
    }

    _addEventListeners() {
        // TODO: Add listeners for all controls to update state and redraw preview
        const tensionSlider = this.element.querySelector('#tension-slider');
        const tensionInput = this.element.querySelector('#tension-input');

        const syncTension = (value) => {
            this.currentStyle.tension = parseFloat(value);
            tensionSlider.value = this.currentStyle.tension;
            tensionInput.value = this.currentStyle.tension;
            this.drawPreview();
        };

        tensionSlider.addEventListener('input', (e) => syncTension(e.target.value));
        tensionInput.addEventListener('change', (e) => syncTension(e.target.value));
        
        this.element.querySelector('#save-button').addEventListener('click', () => {
            this.onSelect(this.currentStyle);
            this.hide();
        });
        
        this.element.querySelector('#cancel-button').addEventListener('click', () => {
            this.hide();
        });
    }
    
    _updateUIFromState() {
        // TODO: Sync all UI elements with this.currentStyle
        this.element.querySelector(`#style-name-input`).value = this.currentStyle.name;
        this.element.querySelector(`input[name="cornerHandling"][value="${this.currentStyle.cornerHandling}"]`).checked = true;
    }

    drawPreview() {
        if (!this.previewCtx) return;

        const ctx = this.previewCtx;
        const w = C.PREVIEW_CANVAS_WIDTH;
        const h = C.PREVIEW_CANVAS_HEIGHT;

        // Clear canvas
        ctx.fillStyle = C.PREVIEW_BACKGROUND_COLOR;
        ctx.fillRect(0, 0, w, h);

        // Draw sample path (e.g., a simple 'S' curve)
        const samplePoints = [
            { x: w * 0.1, y: h * 0.2 },
            { x: w * 0.4, y: h * 0.8 },
            { x: w * 0.6, y: h * 0.2 },
            { x: w * 0.9, y: h * 0.8 },
        ];
        
        // Draw the interpolated curve
        const curvePoints = U.calculateCubicSpline(samplePoints, this.currentStyle.tension, false);
        
        ctx.strokeStyle = C.PREVIEW_CURVE_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath();
        curvePoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Draw original points
        ctx.fillStyle = C.PREVIEW_PATH_COLOR;
        samplePoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, C.PREVIEW_POINT_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    show(styleToEdit = null) {
        if (styleToEdit) {
            this.currentStyle = JSON.parse(JSON.stringify(styleToEdit));
        } else {
            this.currentStyle = JSON.parse(JSON.stringify(C.DEFAULT_STYLE));
            this.currentStyle.id = `style_${Date.now()}`;
        }
        this.element.style.display = 'grid';
        this._updateUIFromState();
        this.drawPreview();
    }

    hide() {
        this.element.style.display = 'none';
    }
}