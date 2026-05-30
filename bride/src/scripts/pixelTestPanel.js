// Pixel Character Test Panel - Development Only
class PixelTestPanel {
    constructor() {
        this.isVisible = false;
        this.panel = null;
    }

    init() {
        this.createPanel();
        this.setupToggle();
    }

    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'pixel-test-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 80vh;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            overflow-y: auto;
            transform: translateX(320px);
            transition: transform 0.3s ease;
            backdrop-filter: blur(10px);
        `;

        panel.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ff6b35;">🎮 Pixel Character Test</h3>

            <div style="margin-bottom: 15px;">
                <button id="toggle-main" style="background: #4CAF50; border: none; color: white; padding: 5px 10px; margin-right: 5px; border-radius: 3px; cursor: pointer;">Toggle Main</button>
                <button id="toggle-gallery" style="background: #ff6b35; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Toggle Gallery</button>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Scale:</label>
                <input type="range" id="scale-slider" min="1" max="8" value="3" style="width: 100%;">
                <span id="scale-value">3x</span>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Position X:</label>
                <input type="range" id="pos-x-slider" min="0" max="100" value="50" style="width: 100%;">
                <span id="pos-x-value">50%</span>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Position Y:</label>
                <input type="range" id="pos-y-slider" min="0" max="100" value="50" style="width: 100%;">
                <span id="pos-y-value">50%</span>
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">Scroll Trigger:</label>
                <input type="range" id="scroll-trigger" min="0" max="100" value="10" style="width: 100%;">
                <span id="scroll-trigger-value">10%</span>
            </div>

            <div style="margin-bottom: 15px;">
                <button id="add-random" style="background: #9C27B0; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%;">Add Random Character</button>
            </div>

            <div style="margin-bottom: 15px;">
                <button id="clear-all" style="background: #f44336; border: none; color: white; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%;">Clear All</button>
            </div>

            <div id="character-list" style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">
                <h4 style="margin: 0 0 5px 0;">Active Characters:</h4>
                <div id="character-count">0 characters</div>
            </div>
        `;

        document.body.appendChild(panel);
        this.panel = panel;

        this.setupPanelEvents();
    }

    setupToggle() {
        // Toggle with keyboard shortcut (Ctrl+P)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Add floating toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.innerHTML = '🎮';
        toggleBtn.style.cssText = `
            position: fixed;
            top: 70px;
            right: 10px;
            width: 40px;
            height: 40px;
            background: #ff6b35;
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 9998;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        toggleBtn.onclick = () => this.toggle();
        document.body.appendChild(toggleBtn);
    }

    setupPanelEvents() {
        const manager = window.pixelCharacterManager;
        if (!manager) return;

        // Toggle buttons
        document.getElementById('toggle-main').onclick = () => {
            const char = manager.characters.get('main');
            if (char) {
                manager.triggerCharacter('main', !char.isActive);
            }
        };

        document.getElementById('toggle-gallery').onclick = () => {
            const char = manager.characters.get('gallery');
            if (char) {
                manager.triggerCharacter('gallery', !char.isActive);
            }
        };

        // Scale slider
        const scaleSlider = document.getElementById('scale-slider');
        const scaleValue = document.getElementById('scale-value');
        scaleSlider.oninput = () => {
            const scale = scaleSlider.value;
            scaleValue.textContent = scale + 'x';
            manager.updateCharacter('main', { scale: parseInt(scale) });
        };

        // Position sliders
        const posXSlider = document.getElementById('pos-x-slider');
        const posXValue = document.getElementById('pos-x-value');
        posXSlider.oninput = () => {
            const x = posXSlider.value + '%';
            posXValue.textContent = x;
            manager.updateCharacter('main', { x });
        };

        const posYSlider = document.getElementById('pos-y-slider');
        const posYValue = document.getElementById('pos-y-value');
        posYSlider.oninput = () => {
            const y = posYSlider.value + '%';
            posYValue.textContent = y;
            manager.updateCharacter('main', { y });
        };

        // Scroll trigger slider
        const scrollTrigger = document.getElementById('scroll-trigger');
        const scrollTriggerValue = document.getElementById('scroll-trigger-value');
        scrollTrigger.oninput = () => {
            const value = scrollTrigger.value;
            scrollTriggerValue.textContent = value + '%';
            manager.updateCharacter('main', { triggerValue: parseInt(value) });
        };

        // Add random character
        document.getElementById('add-random').onclick = () => {
            const id = 'random-' + Math.random().toString(36).substr(2, 9);
            manager.addCharacter(id, {
                src: '/animation/section1.gif',
                scale: Math.floor(Math.random() * 4) + 1,
                x: Math.floor(Math.random() * 100) + '%',
                y: Math.floor(Math.random() * 100) + '%',
                trigger: 'custom'
            });
            manager.triggerCharacter(id, true);
            this.updateCharacterList();
        };

        // Clear all
        document.getElementById('clear-all').onclick = () => {
            manager.characters.clear();
            manager.container.innerHTML = '';
            this.updateCharacterList();

            // Re-add default characters
            setTimeout(() => {
                window.initPixelCharacters();
                this.updateCharacterList();
            }, 100);
        };

        // Update character list periodically
        setInterval(() => this.updateCharacterList(), 1000);
    }

    updateCharacterList() {
        const manager = window.pixelCharacterManager;
        if (!manager) return;

        const countEl = document.getElementById('character-count');
        const count = manager.characters.size;
        countEl.textContent = `${count} character${count !== 1 ? 's' : ''}`;

        // Show active characters
        let listHtml = '';
        manager.characters.forEach((char, id) => {
            const status = char.isActive ? '✅' : '⭕';
            listHtml += `<div style="font-size: 10px; margin: 2px 0;">${status} ${id} (${char.scale}x)</div>`;
        });

        const existingList = document.querySelector('#character-list .character-details');
        if (existingList) {
            existingList.innerHTML = listHtml;
        } else {
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'character-details';
            detailsDiv.innerHTML = listHtml;
            document.getElementById('character-list').appendChild(detailsDiv);
        }
    }

    toggle() {
        this.isVisible = !this.isVisible;
        if (this.panel) {
            this.panel.style.transform = this.isVisible ? 'translateX(0)' : 'translateX(320px)';
        }
    }

    destroy() {
        if (this.panel) {
            this.panel.remove();
        }
    }
}

// Initialize test panel in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.pixelTestPanel = new PixelTestPanel();

    // Wait for pixel character manager to be ready
    const initTestPanel = () => {
        if (window.pixelCharacterManager) {
            window.pixelTestPanel.init();
            console.log('🎮 Pixel Test Panel initialized (Ctrl+P to toggle)');
        } else {
            setTimeout(initTestPanel, 100);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initTestPanel, 1000);
    });
}

export default PixelTestPanel;