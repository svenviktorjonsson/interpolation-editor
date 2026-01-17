// interpolation-editor.js
import * as U from './utils.js?v=dev';
import * as C from './constants.js';

const DEBUG_INTERPOLATION = true;

const DEFAULT_STYLE = {
    id: null,
    preset: 'closed',
    type: 'linear',
    mode: 'piecewise',
    order: 1,
    tension: 0.5,
    radiusMode: 'absolute',
    radiusValue: 24,
    linearStyle: 'lines',
    nurbsDegree: 3,
    pointHandling: 'anchor'
};

const PRESET_DEFS = [
    { id: 'closed', label: 'Closed' },
    { id: 'open', label: 'Open' },
    { id: 'branching', label: 'Branching' },
    { id: 'branching4', label: 'Branching (4)' },
    { id: 'branching5', label: 'Branching (5)' }
];

const ORDER_OPTIONS = [
    { value: 1, label: 'Linear', note: 'C0' },
    { value: 3, label: 'Cubic', note: 'C2' }
];

const TYPE_OPTIONS = [
    { id: 'linear', label: 'Linear' },
    { id: 'catmull', label: 'Catmull-Rom' },
    { id: 'rel_radius', label: 'Rel Radius' },
    { id: 'abs_radius', label: 'Abs Radius' },
    { id: 'spline', label: 'Spline' },
    { id: 'nurbs', label: 'NURBS' }
];

export default class InterpolationEditor {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onSelect = options.onSelect || (() => {});
        this.state = {
            style: this._createStyle(),
            previewPoints: this._createDefaultPresetPoints()
        };

        this.wrapper = null;
        this.elements = {};
        this.previewCards = new Map();
        this.dragState = { presetId: null, pathIndex: null, pointIndex: null };
    }

    initialize() {
        if (this.wrapper) return;
        this._initializeDOM();
        this._setupEventListeners();
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    show(styleToEdit = null) {
        this.state.style = this._normalizeStyle(styleToEdit);
        this._updateUIFromState();
        this.wrapper.style.display = 'block';
        requestAnimationFrame(() => {
            this._renderAllPreviews();
        });
    }

    hide() {
        if (this.wrapper) {
            this.wrapper.style.display = 'none';
        }
    }

    _createStyle() {
        return {
            ...DEFAULT_STYLE,
            id: `style_${Date.now()}`
        };
    }

    _normalizeStyle(style) {
        const base = this._createStyle();
        if (!style) return base;
        const requestedOrder = Number(style.order);
        const order = requestedOrder === 3 ? 3 : 1;
        let inferredType = style.type === 'px_radius' ? 'abs_radius' : style.type;
        const normalizedRadiusMode = style.radiusMode === 'fixed' ? 'absolute' : style.radiusMode;
        if (!inferredType) {
            if (style.mode === 'radius') {
                inferredType = normalizedRadiusMode === 'relative' ? 'rel_radius' : 'abs_radius';
            } else if (order === 3 && style.tension !== undefined) {
                inferredType = 'catmull';
            } else if (order === 3) {
                inferredType = 'spline';
            } else {
                inferredType = 'linear';
            }
        }
        return {
            ...base,
            ...style,
            id: style.id || base.id,
            preset: style.preset || base.preset,
            order,
            type: inferredType || base.type,
            radiusMode: normalizedRadiusMode || base.radiusMode,
            linearStyle: style.linearStyle || base.linearStyle,
            nurbsDegree: style.nurbsDegree || base.nurbsDegree,
            pointHandling: style.pointHandling || base.pointHandling
        };
    }

    _createDefaultPresetPoints() {
        const branchJunction = { x: 0.6, y: 0.25 };
        const branch4Junction = { x: 0.55, y: 0.45 };
        const branch5Junction = { x: 0.55, y: 0.5 };
        return {
            closed: [
                [
                    { x: 0.2, y: 0.2 },
                    { x: 0.8, y: 0.25 },
                    { x: 0.7, y: 0.6 },
                    { x: 0.5, y: 0.45 },
                    { x: 0.3, y: 0.75 }
                ]
            ],
            open: [
                [
                    { x: 0.05, y: 0.8 },
                    { x: 0.25, y: 0.4 },
                    { x: 0.45, y: 0.7 },
                    { x: 0.65, y: 0.2 },
                    { x: 0.85, y: 0.55 }
                ]
            ],
            branching: [
                [
                    { x: 0.1, y: 0.85 },
                    { x: 0.3, y: 0.6 },
                    { x: 0.5, y: 0.4 },
                    branchJunction
                ],
                [
                    branchJunction,
                    { x: 0.75, y: 0.15 },
                    { x: 0.9, y: 0.1 }
                ],
                [
                    branchJunction,
                    { x: 0.75, y: 0.35 },
                    { x: 0.9, y: 0.45 }
                ]
            ],
            branching4: {
                in: [
                    [
                        { x: 0.12, y: 0.15 },
                        { x: 0.32, y: 0.3 },
                        branch4Junction
                    ],
                    [
                        { x: 0.18, y: 0.75 },
                        { x: 0.35, y: 0.58 },
                        branch4Junction
                    ]
                ],
                out: [
                    [
                        branch4Junction,
                        { x: 0.75, y: 0.25 },
                        { x: 0.92, y: 0.2 }
                    ],
                    [
                        branch4Junction,
                        { x: 0.75, y: 0.6 },
                        { x: 0.9, y: 0.72 }
                    ]
                ]
            },
            branching5: {
                in: [
                    [
                        { x: 0.1, y: 0.25 },
                        { x: 0.32, y: 0.38 },
                        branch5Junction
                    ],
                    [
                        { x: 0.18, y: 0.8 },
                        { x: 0.35, y: 0.64 },
                        branch5Junction
                    ]
                ],
                out: [
                    [
                        branch5Junction,
                        { x: 0.78, y: 0.25 },
                        { x: 0.92, y: 0.2 }
                    ],
                    [
                        branch5Junction,
                        { x: 0.78, y: 0.5 },
                        { x: 0.92, y: 0.52 }
                    ],
                    [
                        branch5Junction,
                        { x: 0.78, y: 0.78 },
                        { x: 0.9, y: 0.85 }
                    ]
                ]
            }
        };
    }

    _initializeDOM() {
        const createEl = (tag, options = {}) => {
            const el = document.createElement(tag);
            if (options.id) {
                el.id = options.id;
                const camelCaseId = options.id.replace(/-(\w)/g, (_, letter) => letter.toUpperCase());
                this.elements[camelCaseId] = el;
            }
            if (options.className) el.className = options.className;
            if (options.text) el.textContent = options.text;
            if (options.type) el.type = options.type;
            if (options.value !== undefined) el.value = options.value;
            if (options.attrs) {
                Object.entries(options.attrs).forEach(([key, value]) => el.setAttribute(key, value));
            }
            return el;
        };

        this.wrapper = createEl('div', { id: 'interpolation-editor-wrapper', className: 'interpolation-editor-container' });
        this.wrapper.style.display = 'none';

        const layout = createEl('div', { className: 'interpolation-editor-layout' });

        const previewPanel = createEl('div', { className: 'editor-panel preview-panel' });
        previewPanel.append(createEl('div', { className: 'panel-header', text: 'Preview Presets' }));
        const previewList = createEl('div', { className: 'preview-list' });

        PRESET_DEFS.forEach(preset => {
            const card = createEl('button', { className: 'preview-card', attrs: { 'data-preset': preset.id, type: 'button' } });
            const label = createEl('div', { className: 'preview-card-label', text: preset.label });
            const canvas = createEl('canvas', { className: 'preview-card-canvas' });
            card.append(canvas, label);
            previewList.append(card);
            this.previewCards.set(preset.id, { card, canvas });
        });
        previewPanel.append(previewList);

        const typePanel = createEl('div', { className: 'editor-panel type-panel' });
        typePanel.append(createEl('div', { className: 'panel-header', text: 'Interpolation Type' }));
        const typeList = createEl('div', { className: 'toggle-stack', id: 'type-list' });
        TYPE_OPTIONS.forEach(option => {
            const button = createEl('button', {
                className: 'toggle-row',
                text: option.label,
                attrs: { 'data-type': option.id, type: 'button' }
            });
            typeList.append(button);
        });
        typePanel.append(typeList);

        const paramsPanel = createEl('div', { className: 'editor-panel params-panel' });
        paramsPanel.append(createEl('div', { className: 'panel-header', text: 'Parameters' }));

        const tensionSection = createEl('div', { className: 'param-section', id: 'tension-section' });
        tensionSection.append(createEl('div', { className: 'section-caption', text: 'Catmull-Rom tension.' }));
        const tensionRow = createEl('div', { className: 'param-row' });
        this.elements.tensionSlider = createEl('input', { id: 'tension-slider', type: 'range', attrs: { min: '0', max: '1', step: '0.01' } });
        this.elements.tensionInput = createEl('input', { id: 'tension-input', type: 'number', attrs: { min: '0', max: '1', step: '0.01' } });
        tensionRow.append(this.elements.tensionSlider, this.elements.tensionInput);
        tensionSection.append(tensionRow);

        const linearSection = createEl('div', { className: 'param-section', id: 'linear-section' });
        linearSection.append(createEl('div', { className: 'section-caption', text: 'Linear marker style.' }));
        const linearRow = createEl('div', { className: 'param-row' });
        const linearToggle = createEl('div', { className: 'toggle-group', id: 'linear-style-toggle' });
        linearToggle.append(
            createEl('button', { className: 'toggle-button', text: 'Lines', attrs: { 'data-linear-style': 'lines', type: 'button' } }),
            createEl('button', { className: 'toggle-button', text: 'Arrows', attrs: { 'data-linear-style': 'arrows', type: 'button' } })
        );
        linearRow.append(linearToggle);
        linearSection.append(linearRow);

        const handlingSection = createEl('div', { className: 'param-section', id: 'handling-section' });
        handlingSection.append(createEl('div', { className: 'section-caption', text: 'Point handling.' }));
        const handlingRow = createEl('div', { className: 'param-row' });
        const handlingToggle = createEl('div', { className: 'toggle-group', id: 'point-handling-toggle' });
        handlingToggle.append(
            createEl('button', { className: 'toggle-button', text: 'Control', attrs: { 'data-point-handling': 'control', type: 'button' } }),
            createEl('button', { className: 'toggle-button', text: 'Anchor', attrs: { 'data-point-handling': 'anchor', type: 'button' } }),
            createEl('button', { className: 'toggle-button', text: 'Mixed', attrs: { 'data-point-handling': 'mixed', type: 'button' } })
        );
        handlingRow.append(handlingToggle);
        handlingSection.append(handlingRow);

        const radiusSection = createEl('div', { className: 'param-section', id: 'radius-section' });
        radiusSection.append(createEl('div', { className: 'section-caption', text: 'Clamped to half each adjacent edge.' }));
        const radiusRow = createEl('div', { className: 'param-row' });
        this.elements.radiusSlider = createEl('input', { id: 'radius-slider', type: 'range', attrs: { min: '0', max: '1', step: '0.01' } });
        this.elements.radiusInput = createEl('input', { id: 'radius-input', type: 'number', attrs: { min: '0', max: '1', step: '0.01' } });
        radiusRow.append(this.elements.radiusSlider, this.elements.radiusInput);
        radiusSection.append(radiusRow);

        const splineSection = createEl('div', { className: 'param-section', id: 'spline-section' });
        splineSection.append(createEl('div', { className: 'section-caption', text: 'Spline order.' }));
        const splineRow = createEl('div', { className: 'param-row' });
        const splineToggle = createEl('div', { className: 'toggle-group', id: 'spline-order-toggle' });
        splineToggle.append(
            createEl('button', { className: 'toggle-button', text: '1 (Linear)', attrs: { 'data-spline-order': '1', type: 'button' } }),
            createEl('button', { className: 'toggle-button', text: '3 (Cubic)', attrs: { 'data-spline-order': '3', type: 'button' } })
        );
        splineRow.append(splineToggle);
        splineSection.append(splineRow);

        const nurbsSection = createEl('div', { className: 'param-section', id: 'nurbs-section' });
        nurbsSection.append(createEl('div', { className: 'section-caption', text: 'NURBS degree.' }));
        const nurbsRow = createEl('div', { className: 'param-row' });
        this.elements.nurbsDegreeSlider = createEl('input', { id: 'nurbs-degree-slider', type: 'range', attrs: { min: '2', max: '5', step: '1' } });
        this.elements.nurbsDegreeInput = createEl('input', { id: 'nurbs-degree-input', type: 'number', attrs: { min: '2', max: '5', step: '1' } });
        nurbsRow.append(this.elements.nurbsDegreeSlider, this.elements.nurbsDegreeInput);
        nurbsSection.append(nurbsRow);

        paramsPanel.append(linearSection, handlingSection, tensionSection, radiusSection, splineSection, nurbsSection);

        const actionsPanel = createEl('div', { className: 'editor-panel actions-panel' });
        actionsPanel.append(createEl('div', { className: 'panel-header', text: 'Actions' }));
        const buttonRow = createEl('div', { className: 'button-row' });
        this.elements.closeButton = createEl('button', { id: 'close-button', className: 'editor-button secondary', text: 'Close', attrs: { type: 'button' } });
        this.elements.selectButton = createEl('button', { id: 'select-button', className: 'editor-button primary', text: 'Select', attrs: { type: 'button' } });
        buttonRow.append(this.elements.closeButton, this.elements.selectButton);
        actionsPanel.append(buttonRow);

        layout.append(previewPanel, typePanel, paramsPanel, actionsPanel);
        this.wrapper.append(layout);
        this.container.appendChild(this.wrapper);
    }

    _setupEventListeners() {
        window.addEventListener('resize', () => {
            if (this.wrapper && this.wrapper.style.display !== 'none') {
                this._renderAllPreviews();
            }
        });

        this.previewCards.forEach((cardInfo, preset) => {
            cardInfo.card.addEventListener('click', () => {
                this._setStyle({ preset });
            });
            cardInfo.canvas.addEventListener('mousedown', (event) => {
                this._handlePreviewMouseDown(event, preset);
            });
        });

        const typeList = this.wrapper.querySelector('#type-list');
        typeList.querySelectorAll('.toggle-row').forEach(button => {
            button.addEventListener('click', () => {
                this._applyTypeSelection(button.dataset.type);
            });
        });

        const linearStyleToggle = this.wrapper.querySelector('#linear-style-toggle');
        linearStyleToggle.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('click', () => {
                this._setStyle({ linearStyle: button.dataset.linearStyle });
            });
        });

        const handlingToggle = this.wrapper.querySelector('#point-handling-toggle');
        handlingToggle.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('click', () => {
                this._setStyle({ pointHandling: button.dataset.pointHandling });
            });
        });

        this.elements.radiusSlider.addEventListener('input', (event) => {
            const value = Number(event.target.value);
            this._applyRadiusValue(value, true);
        });

        this.elements.radiusInput.addEventListener('change', (event) => {
            const value = Number(event.target.value);
            this._applyRadiusValue(value, false);
        });

        this.elements.tensionSlider.addEventListener('input', (event) => {
            const value = Number(event.target.value);
            this._applyTensionValue(value, true);
        });

        this.elements.tensionInput.addEventListener('change', (event) => {
            const value = Number(event.target.value);
            this._applyTensionValue(value, false);
        });

        const splineOrderToggle = this.wrapper.querySelector('#spline-order-toggle');
        splineOrderToggle.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('click', () => {
                this._applySplineOrderValue(Number(button.dataset.splineOrder));
            });
        });

        this.elements.nurbsDegreeSlider.addEventListener('input', (event) => {
            const value = Number(event.target.value);
            this._applyNurbsDegreeValue(value, true);
        });

        this.elements.nurbsDegreeInput.addEventListener('change', (event) => {
            const value = Number(event.target.value);
            this._applyNurbsDegreeValue(value, false);
        });

        this.elements.closeButton.addEventListener('click', () => {
            this.hide();
        });

        this.elements.selectButton.addEventListener('click', () => {
            this.onSelect({ ...this.state.style, previewPoints: this.state.previewPoints });
            this.hide();
        });

        window.addEventListener('mousemove', (event) => {
            this._handlePreviewMouseMove(event);
        });
        window.addEventListener('mouseup', () => {
            this._handlePreviewMouseUp();
        });
    }

    _setStyle(next) {
        this.state.style = { ...this.state.style, ...next };
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    _applyRadiusValue(value, fromSlider) {
        if (Number.isNaN(value)) return;
        const nextStyle = { ...this.state.style };
        nextStyle.radiusValue = Math.max(0, Math.min(1, value));
        this.state.style = nextStyle;
        if (fromSlider) {
            this.elements.radiusInput.value = nextStyle.radiusValue.toFixed(2);
        } else {
            this.elements.radiusSlider.value = nextStyle.radiusValue;
        }
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    _applyTensionValue(value, fromSlider) {
        if (Number.isNaN(value)) return;
        const nextStyle = { ...this.state.style };
        nextStyle.tension = Math.max(0, Math.min(1, value));
        this.state.style = nextStyle;
        if (fromSlider) {
            this.elements.tensionInput.value = nextStyle.tension.toFixed(2);
        } else {
            this.elements.tensionSlider.value = nextStyle.tension;
        }
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    _applySplineOrderValue(value) {
        if (Number.isNaN(value)) return;
        const nextStyle = { ...this.state.style };
        nextStyle.order = value >= 2 ? 3 : 1;
        this.state.style = nextStyle;
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    _applyNurbsDegreeValue(value, fromSlider) {
        if (Number.isNaN(value)) return;
        const nextStyle = { ...this.state.style };
        nextStyle.nurbsDegree = Math.max(2, Math.min(5, Math.round(value)));
        this.state.style = nextStyle;
        if (fromSlider) {
            this.elements.nurbsDegreeInput.value = nextStyle.nurbsDegree;
        } else {
            this.elements.nurbsDegreeSlider.value = nextStyle.nurbsDegree;
        }
        this._updateUIFromState();
    }

    _applyTypeSelection(type) {
        const nextStyle = { ...this.state.style, type };
        switch (type) {
            case 'linear':
                nextStyle.mode = 'piecewise';
                nextStyle.order = 1;
                nextStyle.pointHandling = 'anchor';
                break;
            case 'catmull':
                nextStyle.mode = 'piecewise';
                nextStyle.order = 3;
                nextStyle.pointHandling = 'anchor';
                break;
            case 'rel_radius':
                nextStyle.mode = 'radius';
                nextStyle.radiusMode = 'relative';
                nextStyle.pointHandling = nextStyle.pointHandling === 'mixed' ? 'mixed' : 'control';
                break;
            case 'abs_radius':
                nextStyle.mode = 'radius';
                nextStyle.radiusMode = 'absolute';
                nextStyle.pointHandling = nextStyle.pointHandling === 'mixed' ? 'mixed' : 'control';
                break;
            case 'spline':
                nextStyle.mode = 'piecewise';
                nextStyle.order = nextStyle.order === 3 ? 3 : 1;
                nextStyle.pointHandling = 'control';
                break;
            case 'nurbs':
                nextStyle.mode = 'piecewise';
                nextStyle.order = 3;
                nextStyle.pointHandling = 'control';
                break;
            default:
                break;
        }
        this.state.style = nextStyle;
        this._updateUIFromState();
        this._renderAllPreviews();
    }

    _updateUIFromState() {
        const { preset, mode, order, radiusMode, radiusValue, tension, type, linearStyle, nurbsDegree, pointHandling } = this.state.style;

        this.previewCards.forEach((cardInfo, cardPreset) => {
            cardInfo.card.classList.toggle('is-active', cardPreset === preset);
        });

        this.wrapper.querySelectorAll('#type-list .toggle-row').forEach(button => {
            button.classList.toggle('is-active', button.dataset.type === type);
        });

        this.wrapper.querySelectorAll('#linear-style-toggle .toggle-button').forEach(button => {
            button.classList.toggle('is-active', button.dataset.linearStyle === linearStyle);
        });

        this.wrapper.querySelectorAll('#point-handling-toggle .toggle-button').forEach(button => {
            button.classList.toggle('is-active', button.dataset.pointHandling === pointHandling);
        });

        this.wrapper.querySelectorAll('#spline-order-toggle .toggle-button').forEach(button => {
            button.classList.toggle('is-active', Number(button.dataset.splineOrder) === order);
        });

        const linearSection = this.wrapper.querySelector('#linear-section');
        const handlingSection = this.wrapper.querySelector('#handling-section');
        const tensionSection = this.wrapper.querySelector('#tension-section');
        const radiusSection = this.wrapper.querySelector('#radius-section');
        const splineSection = this.wrapper.querySelector('#spline-section');
        const nurbsSection = this.wrapper.querySelector('#nurbs-section');

        linearSection.classList.toggle('is-hidden', type !== 'linear');
        handlingSection.classList.toggle('is-hidden', !(type === 'catmull' || type === 'spline' || type === 'nurbs' || type === 'rel_radius' || type === 'abs_radius'));
        tensionSection.classList.toggle('is-hidden', type !== 'catmull');
        radiusSection.classList.toggle('is-hidden', !(type === 'rel_radius' || type === 'abs_radius'));
        splineSection.classList.toggle('is-hidden', type !== 'spline');
        nurbsSection.classList.toggle('is-hidden', type !== 'nurbs');

        this.elements.radiusSlider.value = Math.max(0, Math.min(1, radiusValue));
        this.elements.radiusInput.value = Number(this.elements.radiusSlider.value).toFixed(2);

        this.elements.tensionSlider.value = Math.max(0, Math.min(1, tension));
        this.elements.tensionInput.value = Number(tension).toFixed(2);
        this.elements.nurbsDegreeSlider.value = nurbsDegree;
        this.elements.nurbsDegreeInput.value = nurbsDegree;
    }

    _renderAllPreviews() {
        PRESET_DEFS.forEach(preset => {
            const card = this.previewCards.get(preset.id);
            if (!card) return;
            this._renderPreviewCard(card.canvas, preset.id, preset.id === this.state.style.preset);
        });
    }

    _renderPreviewCard(canvas, presetId, isActive) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, rect.width, rect.height);
        this._drawPreset(ctx, rect.width, rect.height, presetId, isActive);
        ctx.restore();
    }

    _drawPreset(ctx, width, height, presetId, isActive) {
        const padding = 16;
        const usableW = width - padding * 2;
        const usableH = height - padding * 2;

        const toCanvas = (pt) => ({
            x: padding + pt.x * usableW,
            y: padding + pt.y * usableH
        });

        const preset = this._getPresetPoints(presetId);
        const strokeColor = isActive ? '#3b82f6' : '#6b7280';
        const pointColor = isActive ? '#60a5fa' : '#94a3b8';

        ctx.lineWidth = this._getStrokeWidth();
        ctx.lineJoin = this.state.style.mode === 'radius' ? 'round' : 'miter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = strokeColor;

        const uniqueNormalized = [];
        const seenNormalized = new Set();
        const seenSegments = new Set();
        const trackPoint = (pt) => {
            if (seenNormalized.has(pt)) return;
            seenNormalized.add(pt);
            uniqueNormalized.push(pt);
        };

        const isBranchingRadius = this.state.style.mode === 'radius' && presetId === 'branching';
        const distanceToLine = (point, lineStart, lineEnd) => {
            const vx = lineEnd.x - lineStart.x;
            const vy = lineEnd.y - lineStart.y;
            const wx = point.x - lineStart.x;
            const wy = point.y - lineStart.y;
            const len = Math.hypot(vx, vy);
            if (len < 1e-6) return Math.hypot(wx, wy);
            return Math.abs(vx * wy - vy * wx) / len;
        };
        const projectT = (point, lineStart, lineEnd) => {
            const vx = lineEnd.x - lineStart.x;
            const vy = lineEnd.y - lineStart.y;
            const wx = point.x - lineStart.x;
            const wy = point.y - lineStart.y;
            const denom = vx * vx + vy * vy;
            if (denom < 1e-6) return 0;
            return (wx * vx + wy * vy) / denom;
        };
        const trimHalfLinear = (points, line, trimStartHalf, trimEndHalf) => {
            if (!line || points.length < 3) return points;
            const eps = 0.25;
            const dir = {
                x: line.b.x - line.a.x,
                y: line.b.y - line.a.y
            };
            const dirLen = Math.hypot(dir.x, dir.y) || 1;
            const filtered = points.filter((pt, index) => {
                const distance = distanceToLine(pt, line.a, line.b);
                if (distance > eps) return true;
                const t = projectT(pt, line.a, line.b);
                const prev = points[Math.max(0, index - 1)];
                const next = points[Math.min(points.length - 1, index + 1)];
                const sx = next.x - prev.x;
                const sy = next.y - prev.y;
                const segLen = Math.hypot(sx, sy) || 1;
                const cross = dir.x * sy - dir.y * sx;
                const dot = dir.x * sx + dir.y * sy;
                const aligned = Math.abs(cross) <= 0.01 * dirLen * segLen && dot >= 0;
                if (!aligned) return true;
                if (trimStartHalf && t <= 0.5) return false;
                if (trimEndHalf && t >= 0.5) return false;
                return true;
            });
            return filtered.length >= 2 ? filtered : filtered;
        };
        const keepLinearBetweenArcAndMid = (points, line, arcFraction) => {
            if (!line || points.length < 3) return points;
            const eps = 0.25;
            const dir = {
                x: line.b.x - line.a.x,
                y: line.b.y - line.a.y
            };
            const dirLen = Math.hypot(dir.x, dir.y) || 1;
            const tMin = Math.max(0, Math.min(0.5, arcFraction));
            const tMax = 0.5;
            const filtered = points.filter((pt, index) => {
                const distance = distanceToLine(pt, line.a, line.b);
                if (distance > eps) return true;
                const prev = points[Math.max(0, index - 1)];
                const next = points[Math.min(points.length - 1, index + 1)];
                const sx = next.x - prev.x;
                const sy = next.y - prev.y;
                const segLen = Math.hypot(sx, sy) || 1;
                const cross = dir.x * sy - dir.y * sx;
                const dot = dir.x * sx + dir.y * sy;
                const aligned = Math.abs(cross) <= 0.005 * dirLen * segLen && dot >= 0;
                if (!aligned) return true;
                const t = projectT(pt, line.a, line.b);
                return t >= tMin && t <= tMax;
            });
            return filtered.length >= 2 ? filtered : filtered;
        };

        preset.paths.forEach((path, pathIndex) => {
            const normalizedPoints = path.points;
            const points = normalizedPoints.map(toCanvas);
            normalizedPoints.forEach(trackPoint);
            if (points.length >= 2) {
                ctx.save();
                ctx.lineWidth = Math.max(1, this._getStrokeWidth() * 0.6);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.setLineDash(C.PREVIEW_DASH_PATTERN);
                const segments = [];
                for (let i = 0; i < points.length - 1; i++) {
                    segments.push([points[i], points[i + 1]]);
                }
                if (path.closed) {
                    segments.push([points[points.length - 1], points[0]]);
                }
                segments.forEach(([a, b]) => {
                    const ax = Math.round(a.x);
                    const ay = Math.round(a.y);
                    const bx = Math.round(b.x);
                    const by = Math.round(b.y);
                    const keyA = `${ax}:${ay}`;
                    const keyB = `${bx}:${by}`;
                    const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
                    if (seenSegments.has(key)) return;
                    seenSegments.add(key);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                });
                ctx.restore();
            }
            const referenceScale = Math.hypot(usableW, usableH);
            let drawPoints = this._getInterpolatedPoints(points, path.closed, referenceScale);
            if (drawPoints.length < 2) return;
            if (isBranchingRadius) {
                const edgeLen = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
                const arcFraction = this.state.style.radiusMode === 'relative'
                    ? this.state.style.radiusValue * 0.5
                    : (edgeLen > 1e-6 ? this.state.style.radiusValue / edgeLen : 0);
                if (pathIndex === 0) {
                    const endLine = points.length >= 2 ? { a: points[points.length - 2], b: points[points.length - 1] } : null;
                    drawPoints = keepLinearBetweenArcAndMid(drawPoints, endLine, arcFraction);
                } else {
                    const startLine = points.length >= 2 ? { a: points[0], b: points[1] } : null;
                    drawPoints = keepLinearBetweenArcAndMid(drawPoints, startLine, arcFraction);
                }
                if (drawPoints.length < 2) return;
            }
            if (path.trimFromPoint && this.state.style.mode !== 'radius') {
                const trimTarget = toCanvas(path.trimFromPoint);
                let closestIndex = 0;
                let closestDistance = Infinity;
                drawPoints.forEach((pt, index) => {
                    const distance = Math.hypot(pt.x - trimTarget.x, pt.y - trimTarget.y);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestIndex = index;
                    }
                });
                drawPoints = drawPoints.slice(closestIndex);
                if (!drawPoints.length || Math.hypot(drawPoints[0].x - trimTarget.x, drawPoints[0].y - trimTarget.y) > 1e-6) {
                    drawPoints.unshift(trimTarget);
                } else {
                    drawPoints[0] = trimTarget;
                }
            }
            if (drawPoints.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
            drawPoints.slice(1).forEach(pt => ctx.lineTo(pt.x, pt.y));
            if (path.closed && (this.state.style.mode !== 'radius' || this.state.style.radiusValue <= 1e-6)) {
                ctx.closePath();
            }
            ctx.stroke();

            if (this.state.style.type === 'linear' && this.state.style.linearStyle === 'arrows') {
                this._drawEdgeArrows(ctx, points, path.closed);
            }

            if (DEBUG_INTERPOLATION && this.state.style.mode === 'piecewise' && this.state.style.order === 3) {
                this._drawSegmentPoints(ctx, normalizedPoints, path.closed, toCanvas);
            }
        });

        ctx.fillStyle = pointColor;
        uniqueNormalized.map(toCanvas).forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    _getStrokeWidth() {
        return 2;
    }

    _drawEdgeArrows(ctx, points, closed) {
        if (points.length < 2) return;
        const arrowLength = 10;
        const arrowWidth = 6;
        const count = points.length;
        const last = closed ? count : count - 1;

        ctx.save();
        ctx.fillStyle = ctx.strokeStyle;
        for (let i = 0; i < last; i++) {
            const start = points[i];
            const end = points[(i + 1) % count];
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 1e-3) continue;
            const ux = dx / len;
            const uy = dy / len;
            const tip = end;
            const base = {
                x: tip.x - ux * arrowLength,
                y: tip.y - uy * arrowLength
            };
            const left = {
                x: base.x + -uy * (arrowWidth / 2),
                y: base.y + ux * (arrowWidth / 2)
            };
            const right = {
                x: base.x + uy * (arrowWidth / 2),
                y: base.y - ux * (arrowWidth / 2)
            };
            ctx.beginPath();
            ctx.moveTo(tip.x, tip.y);
            ctx.lineTo(left.x, left.y);
            ctx.lineTo(right.x, right.y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    _getInterpolatedPoints(points, closed, referenceScale = 1) {
        const { mode, order, type, pointHandling, nurbsDegree, radiusMode, radiusValue } = this.state.style;
        if (mode === 'radius' || points.length < 2) {
            if (mode === 'radius') {
                const segments = 6 + order * 4;
                const resolvedRadius = radiusMode === 'absolute'
                    ? radiusValue * referenceScale
                    : radiusValue;
                if (resolvedRadius <= 1e-6) {
                    return points;
                }
                return U.calculateAffineCornerRadiusPath(points, closed, radiusMode, resolvedRadius, segments);
            }
            return points;
        }
        const segments = 4 + order * 4;
        if (type === 'linear' || order === 1) {
            return U.calculateLinearSpline(points, closed, segments);
        }
        if (points.length < 3) {
            return points;
        }
        const degree = type === 'nurbs' ? nurbsDegree : 3;
        if (pointHandling === 'control') {
            return U.calculateUniformBSpline(points, closed, degree, segments);
        }
        if (pointHandling === 'mixed') {
            const mixedPoints = this._buildMixedControlPoints(points, closed, degree);
            return U.calculateUniformBSpline(mixedPoints, closed, degree, segments);
        }
        const tension = type === 'catmull' ? this.state.style.tension ?? 0.5 : 0.5;
        return U.calculateCubicSpline(points, tension, closed, segments, {
            logSegments: DEBUG_INTERPOLATION,
            label: `Catmull-Rom (${closed ? 'closed' : 'open'})`
        });
    }

    _buildMixedControlPoints(points, closed, degree) {
        if (points.length < 3) return points;
        const orientation = this._getPathOrientation(points, closed);
        const extraCount = Math.max(0, degree - 1);
        const result = [];
        const last = closed ? points.length : points.length - 1;
        for (let i = 0; i < points.length; i++) {
            const prevIndex = (i - 1 + points.length) % points.length;
            const nextIndex = (i + 1) % points.length;
            const prev = points[prevIndex];
            const current = points[i];
            const next = points[nextIndex];
            const cross = (current.x - prev.x) * (next.y - current.y) - (current.y - prev.y) * (next.x - current.x);
            const isEndpoint = !closed && (i === 0 || i === points.length - 1);
            const isConvex = isEndpoint || (orientation >= 0 ? cross >= 0 : cross <= 0);
            result.push(current);
            if (isConvex) {
                for (let j = 0; j < extraCount; j++) {
                    result.push({ x: current.x, y: current.y });
                }
            }
        }
        return result;
    }

    _getPathOrientation(points, closed) {
        if (!closed) return 1;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const next = points[(i + 1) % points.length];
            area += points[i].x * next.y - next.x * points[i].y;
        }
        return area;
    }

    _drawSegmentPoints(ctx, points, closed, toCanvas) {
        if (points.length < 3) return;
        const segments = U.getCatmullRomSegments(points, closed);
        const colors = {
            p0: '#f87171',
            p1: '#34d399',
            p2: '#60a5fa',
            p3: '#fbbf24'
        };

        ctx.save();
        ctx.globalAlpha = 0.7;
        segments.forEach(segment => {
            const p0 = toCanvas(segment.p0);
            const p1 = toCanvas(segment.p1);
            const p2 = toCanvas(segment.p2);
            const p3 = toCanvas(segment.p3);
            const drawPoint = (pt, color) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
                ctx.fill();
            };
            drawPoint(p0, colors.p0);
            drawPoint(p1, colors.p1);
            drawPoint(p2, colors.p2);
            // P3 intentionally hidden to reduce clutter.
        });
        ctx.restore();
    }

    _getPresetPoints(presetId) {
        if (presetId === 'open') {
            return {
                paths: this.state.previewPoints.open.map(points => ({
                    closed: false,
                    points
                }))
            };
        }

        if (presetId === 'branching') {
            const stem = this.state.previewPoints.branching[0] || [];
            const leadCount = this.state.style.order === 3 ? 3 : 1;
            const stemRoot = stem.length >= 1 ? stem[stem.length - 1] : null;
            const leadStart = Math.max(0, stem.length - (leadCount + 1));
            const stemLeadPoints = stem.slice(leadStart);
            return {
                paths: this.state.previewPoints.branching.map((points, index) => {
                    if (index === 0) {
                        return { closed: false, points };
                    }
                    const branchPoints = [...stemLeadPoints];
                    const branchHead = points[0];
                    const shouldSkipHead = stemRoot
                        && branchHead
                        && Math.abs(branchHead.x - stemRoot.x) < 1e-6
                        && Math.abs(branchHead.y - stemRoot.y) < 1e-6;
                    const branchTail = shouldSkipHead ? points.slice(1) : points;
                    branchPoints.push(...branchTail);
                    return {
                        closed: false,
                        points: branchPoints,
                        trimFromPoint: stemRoot
                    };
                })
            };
        }

        if (presetId === 'branching4') {
            const data = this.state.previewPoints.branching4;
            if (!data) return { paths: [] };
            const incoming = data.in || [];
            const outgoing = data.out || [];
            const normalizeDir = (v) => {
                const len = Math.hypot(v.x, v.y);
                return len > 1e-6 ? { x: v.x / len, y: v.y / len } : { x: 0, y: 0 };
            };
            const inDirs = incoming.map(path => {
                if (path.length < 2) return null;
                const junction = path[path.length - 1];
                const prev = path[path.length - 2];
                return normalizeDir({ x: junction.x - prev.x, y: junction.y - prev.y });
            });
            const outDirs = outgoing.map(path => {
                if (path.length < 2) return null;
                const junction = path[0];
                const next = path[1];
                return normalizeDir({ x: next.x - junction.x, y: next.y - junction.y });
            });
            if (incoming.length !== 1 && outgoing.length !== 1) {
                const paths = [
                    ...incoming.map(points => ({ closed: false, points })),
                    ...outgoing.map(points => ({ closed: false, points }))
                ];
                return { paths };
            }
            const paths = [];
            if (incoming.length === 1) {
                outgoing.forEach(outPath => {
                    const inPath = incoming[0];
                    const tail = outPath[0] === inPath[inPath.length - 1] ? outPath.slice(1) : outPath;
                    paths.push({ closed: false, points: [...inPath, ...tail] });
                });
            } else {
                incoming.forEach(inPath => {
                    const outPath = outgoing[0];
                    const tail = outPath[0] === inPath[inPath.length - 1] ? outPath.slice(1) : outPath;
                    paths.push({ closed: false, points: [...inPath, ...tail] });
                });
            }
            return { paths };
        }

        if (presetId === 'branching5') {
            const data = this.state.previewPoints.branching5;
            if (!data) return { paths: [] };
            const incoming = data.in || [];
            const outgoing = data.out || [];
            const paths = [
                ...incoming.map(points => ({ closed: false, points })),
                ...outgoing.map(points => ({ closed: false, points }))
            ];
            return { paths };
        }

        return {
            paths: [
                {
                    closed: true,
                    points: this.state.previewPoints.closed[0]
                }
            ]
        };
    }

    _handlePreviewMouseDown(event, presetId) {
        const hit = this._findHitPoint(event, presetId);
        if (!hit) return;
        this.dragState = hit;
        event.preventDefault();
    }

    _handlePreviewMouseMove(event) {
        const { presetId, pathIndex, pointIndex } = this.dragState;
        if (presetId === null) return;
        const card = this.previewCards.get(presetId);
        if (!card) return;
        const { x, y } = this._getNormalizedPoint(event, card.canvas);
        const clamped = {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
        const paths = (presetId === 'branching4' || presetId === 'branching5')
            ? this._getPresetPoints(presetId).paths.map(path => path.points)
            : this.state.previewPoints[presetId];
        const targetPath = paths?.[pathIndex];
        if (!targetPath) return;

        if (presetId === 'branching') {
            const stem = paths[0] || [];
            const stemRootIndex = Math.max(0, stem.length - 1);
            const isStemRoot = pathIndex === 0 && pointIndex === stemRootIndex;
            const isBranchRoot = pathIndex > 0 && pointIndex === 0;

            if (isStemRoot || isBranchRoot) {
                const stemRoot = stem[stemRootIndex];
                if (stemRoot) {
                    stemRoot.x = clamped.x;
                    stemRoot.y = clamped.y;
                }
                for (let i = 1; i < paths.length; i++) {
                    const branchRoot = paths[i]?.[0];
                    if (branchRoot) {
                        branchRoot.x = clamped.x;
                        branchRoot.y = clamped.y;
                    }
                }
            } else {
                const targetPoint = targetPath[pointIndex];
                if (targetPoint) {
                    targetPoint.x = clamped.x;
                    targetPoint.y = clamped.y;
                } else {
                    targetPath[pointIndex] = clamped;
                }
            }
        } else {
            const targetPoint = targetPath[pointIndex];
            if (targetPoint) {
                targetPoint.x = clamped.x;
                targetPoint.y = clamped.y;
            } else {
                targetPath[pointIndex] = clamped;
            }
        }
        this._renderAllPreviews();
    }

    _handlePreviewMouseUp() {
        this.dragState = { presetId: null, pathIndex: null, pointIndex: null };
    }

    _findHitPoint(event, presetId) {
        const card = this.previewCards.get(presetId);
        if (!card) return null;
        const canvas = card.canvas;
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const padding = 16;
        const usableW = rect.width - padding * 2;
        const usableH = rect.height - padding * 2;
        const hitRadius = 8;

        const paths = (presetId === 'branching4' || presetId === 'branching5')
            ? this._getPresetPoints(presetId).paths.map(path => path.points)
            : this.state.previewPoints[presetId];
        for (let p = 0; p < paths.length; p++) {
            const points = paths[p];
            for (let i = 0; i < points.length; i++) {
                const px = padding + points[i].x * usableW;
                const py = padding + points[i].y * usableH;
                if (Math.hypot(mouseX - px, mouseY - py) <= hitRadius) {
                    return { presetId, pathIndex: p, pointIndex: i };
                }
            }
        }
        return null;
    }

    _getNormalizedPoint(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        const padding = 16;
        const usableW = rect.width - padding * 2;
        const usableH = rect.height - padding * 2;
        const x = (event.clientX - rect.left - padding) / usableW;
        const y = (event.clientY - rect.top - padding) / usableH;
        return { x, y };
    }
}
