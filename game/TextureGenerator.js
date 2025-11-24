import * as BABYLON from '@babylonjs/core';

export class TextureGenerator {
    constructor(scene) {
        this.scene = scene;
    }

    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    getTexture(type) {
        let canvas;
        switch (type) {
            case 'mamdani': canvas = this.drawMamdani(); break;
            case 'trump': canvas = this.drawTrump(); break;
            case 'bus': canvas = this.drawBus(); break;
            case 'barrier': canvas = this.drawBarrier(); break;
            case 'scaffold': canvas = this.drawScaffold(); break;
            case 'coin': canvas = this.drawCoin(); break;
            case 'kafiyeh': canvas = this.drawKafiyeh(); break;
            case 'rainbow': canvas = this.drawRainbow(); break;
            case 'covidMask': canvas = this.drawCovidMask(); break;
            case 'building': canvas = this.drawBuilding(); break;
            case 'halal': canvas = this.drawHalalCart(); break;
            case 'taxi': canvas = this.drawTaxi(); break;
            case 'person': canvas = this.drawPerson(); break;
            case 'billboard_commie': canvas = this.drawBillboard('COMMIE'); break;
            case 'billboard_palestinian': canvas = this.drawBillboard('FREE PALESTINE'); break;
            case 'alcohol': canvas = this.drawAlcohol(); break;
            case 'pothole': canvas = this.drawPothole(); break;
            default: canvas = this.createCanvas(64, 64);
        }

        // Create DynamicTexture
        // We use the canvas data to create a texture
        const texture = new BABYLON.DynamicTexture(type, { width: canvas.width, height: canvas.height }, this.scene, false);
        const ctx = texture.getContext();
        ctx.drawImage(canvas, 0, 0);
        texture.update();

        // Pixel art look (Nearest Neighbor)
        texture.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);

        // Fix mirroring
        texture.uScale = -1;
        texture.uOffset = 1;

        return texture;
    }

    getSignTexture(text) {
        const canvas = this.drawProtestSign(text);
        const texture = new BABYLON.DynamicTexture("sign_" + text, { width: canvas.width, height: canvas.height }, this.scene, false);
        const ctx = texture.getContext();
        ctx.drawImage(canvas, 0, 0);
        texture.update();

        // Linear filter for text
        texture.updateSamplingMode(BABYLON.Texture.BILINEAR_SAMPLINGMODE);

        // Fix mirroring
        texture.uScale = -1;
        texture.uOffset = 1;

        return texture;
    }

    drawBuilding() {
        const c = this.createCanvas(128, 256);
        const ctx = c.getContext('2d');

        // Base Color (Grayscale for tinting)
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, 128, 256);

        // Windows
        ctx.fillStyle = '#87CEEB'; // Sky blue windows
        const rows = 8;
        const cols = 4;
        const winW = 16;
        const winH = 20;
        const gapX = 12;
        const gapY = 10;
        const startX = 10;
        const startY = 10;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Randomly light up windows
                ctx.fillStyle = Math.random() > 0.3 ? '#87CEEB' : '#111';
                ctx.fillRect(startX + c * (winW + gapX), startY + r * (winH + gapY), winW, winH);
            }
        }

        // Door
        ctx.fillStyle = '#444';
        ctx.fillRect(44, 210, 40, 46);

        // Door Frame
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.strokeRect(44, 210, 40, 46);

        return c;
    }

    drawMamdani() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Background (Transparent)
        ctx.clearRect(0, 0, 64, 64);

        // Suit (Dark Blue)
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(16, 20, 32, 44);

        // Head (Skin tone)
        ctx.fillStyle = '#d2a679';
        ctx.fillRect(20, 4, 24, 16);

        // Hair (Black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(20, 0, 24, 6);
        ctx.fillRect(18, 4, 4, 8); // Sideburns

        // Red Tie
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(30, 20, 4, 20);

        return c;
    }

    drawTrump() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Suit (Navy Blue)
        ctx.fillStyle = '#000080';
        ctx.fillRect(12, 20, 40, 44); // Wider

        // Head (Orange-ish)
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(20, 4, 24, 16);

        // Hair (Yellow/Blond)
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(18, 0, 28, 6);
        ctx.fillRect(40, 2, 8, 4); // Swoop

        // Long Red Tie
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(30, 20, 4, 30);

        return c;
    }

    drawBus() {
        const c = this.createCanvas(128, 64);
        const ctx = c.getContext('2d');

        // Body (Yellow)
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(0, 10, 128, 54);

        // Windows (Black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(10, 20, 20, 20);
        ctx.fillRect(40, 20, 20, 20);
        ctx.fillRect(70, 20, 20, 20);
        ctx.fillRect(100, 20, 20, 20);

        // Wheels (Black)
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(30, 64, 10, 0, Math.PI * 2);
        ctx.arc(100, 64, 10, 0, Math.PI * 2);
        ctx.fill();

        return c;
    }

    drawBarrier() {
        const c = this.createCanvas(64, 32);
        const ctx = c.getContext('2d');

        // Wood/Blue
        ctx.fillStyle = '#0000ff';
        ctx.fillRect(0, 10, 64, 12);

        // Legs
        ctx.fillStyle = '#888';
        ctx.fillRect(10, 22, 4, 10);
        ctx.fillRect(50, 22, 4, 10);

        // Text lines
        ctx.fillStyle = '#fff';
        ctx.fillRect(5, 14, 54, 4);

        return c;
    }

    drawScaffold() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Metal bars
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.strokeRect(4, 4, 56, 56);

        // Cross
        ctx.beginPath();
        ctx.moveTo(4, 4);
        ctx.lineTo(60, 60);
        ctx.moveTo(60, 4);
        ctx.lineTo(4, 60);
        ctx.stroke();

        return c;
    }

    drawCoin() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Gold Circle
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#daa520';
        ctx.lineWidth = 4;
        ctx.stroke();

        // $ Sign
        ctx.fillStyle = '#daa520';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 32, 34);

        return c;
    }

    drawKafiyeh() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // White Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 64, 64);

        // Red Checkered Pattern (Keffiyeh style)
        ctx.fillStyle = '#cc0000';
        const size = 8;
        for (let y = 0; y < 64; y += size) {
            for (let x = 0; x < 64; x += size) {
                if ((x / size + y / size) % 2 === 0) {
                    // Draw a pattern block
                    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
                }
            }
        }
        return c;
    }

    drawRainbow() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');
        // Vibrant Gradient Ring
        const grad = ctx.createRadialGradient(32, 32, 10, 32, 32, 30);
        grad.addColorStop(0, '#ff0000'); // Red
        grad.addColorStop(0.2, '#ff7f00'); // Orange
        grad.addColorStop(0.4, '#ffff00'); // Yellow
        grad.addColorStop(0.6, '#00ff00'); // Green
        grad.addColorStop(0.8, '#0000ff'); // Blue
        grad.addColorStop(1, '#8b00ff'); // Violet

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(32, 32, 30, 0, Math.PI * 2);
        ctx.fill();

        // Hole
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(32, 32, 20, 0, Math.PI * 2);
        ctx.fill();

        return c;
    }

    drawCovidMask() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Surgical Blue Background
        ctx.fillStyle = '#44aadd';
        ctx.fillRect(0, 0, 64, 64);

        // Pleats (Darker Blue Lines)
        ctx.strokeStyle = '#3388bb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 20); ctx.lineTo(64, 20);
        ctx.moveTo(0, 32); ctx.lineTo(64, 32);
        ctx.moveTo(0, 44); ctx.lineTo(64, 44);
        ctx.stroke();

        // White Straps (on sides)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 8, 64);
        ctx.fillRect(56, 0, 8, 64);

        return c;
    }

    drawHalalCart() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');
        // Silver/Metal body
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(0, 20, 64, 44);
        // Umbrella (Red/Yellow)
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.moveTo(32, 0);
        ctx.lineTo(64, 20);
        ctx.lineTo(0, 20);
        ctx.fill();
        // Food items
        ctx.fillStyle = '#8B4513'; // Meat
        ctx.fillRect(10, 25, 10, 10);
        ctx.fillStyle = '#FFFF00'; // Rice
        ctx.fillRect(25, 25, 10, 10);
        return c;
    }

    drawTaxi() {
        const c = this.createCanvas(128, 64);
        const ctx = c.getContext('2d');
        // Yellow Body
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(0, 20, 128, 30);
        // Checkers
        ctx.fillStyle = '#000';
        for (let i = 0; i < 128; i += 16) {
            ctx.fillRect(i, 35, 8, 4);
            ctx.fillRect(i + 8, 39, 8, 4);
        }
        // Windows
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(20, 5, 30, 15);
        ctx.fillRect(70, 5, 30, 15);
        // Wheels
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(30, 50, 10, 0, Math.PI * 2);
        ctx.arc(100, 50, 10, 0, Math.PI * 2);
        ctx.fill();
        return c;
    }

    drawPerson() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');
        // Random shirt color
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(16, 20, 32, 44);
        // Skin
        ctx.fillStyle = '#d2a679';
        ctx.fillRect(20, 4, 24, 16);
        return c;
    }

    drawPothole() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Transparent background
        ctx.clearRect(0, 0, 64, 64);

        // Dark irregular circle
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.ellipse(32, 32, 28, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner depth/noise
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(32, 32, 20, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        return c;
    }

    drawAlcohol() {
        const c = this.createCanvas(64, 64);
        const ctx = c.getContext('2d');

        // Bottle Body (Green glass)
        ctx.fillStyle = '#006400';
        ctx.fillRect(24, 20, 16, 36);

        // Bottle Neck
        ctx.fillRect(28, 4, 8, 16);

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(24, 30, 16, 16);

        // Text (Blurry)
        ctx.fillStyle = '#000000';
        ctx.fillRect(26, 34, 12, 2);
        ctx.fillRect(26, 38, 12, 2);

        return c;
    }

    drawBillboard(text) {
        const c = this.createCanvas(256, 128);
        const ctx = c.getContext('2d');

        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 256, 128);

        // Border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 256, 128);

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);

        return c;
    }

    drawProtestSign(text) {
        const c = this.createCanvas(256, 128); // Higher res for text
        const ctx = c.getContext('2d');

        // Cardboard Background
        ctx.fillStyle = '#d2b48c'; // Tan/Cardboard
        ctx.fillRect(0, 0, 256, 128);

        // Grain/Noise
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let i = 0; i < 100; i++) {
            ctx.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
        }

        // Text
        ctx.fillStyle = '#000000'; // Marker black
        // Randomize color slightly for variety? No, stick to black/red marker.
        if (Math.random() < 0.3) ctx.fillStyle = '#cc0000'; // Red marker sometimes

        ctx.font = 'bold 24px Arial'; // Simple font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Word wrap logic (simple)
        const words = text.split(' ');
        let line = '';
        let lines = [];

        // Very basic wrapping
        if (words.length > 2) {
            // Split into two lines roughly
            const mid = Math.floor(words.length / 2);
            lines.push(words.slice(0, mid).join(' '));
            lines.push(words.slice(mid).join(' '));
        } else {
            lines.push(text);
        }

        const lineHeight = 30;
        const startY = 64 - ((lines.length - 1) * lineHeight) / 2;

        lines.forEach((l, i) => {
            ctx.fillText(l, 128, startY + (i * lineHeight));
        });

        // Border/Edge
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 256, 128);

        return c;
    }
}
