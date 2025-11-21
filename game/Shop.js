export class Shop {
    constructor(player, scoreManager) {
        this.player = player;
        this.scoreManager = scoreManager;
        this.skins = [
            { id: 'default', name: 'Civilian', cost: 0, color: 0xd2a679, suitColor: 0x1a1a2e },
            { id: 'rebel', name: 'Rebel', cost: 0, color: 0x8d5524, suitColor: 0x556b2f }, // Olive Green Suit
            { id: 'activist', name: 'Activist', cost: 0, color: 0xf0c75e, suitColor: 0xff69b4 }, // Hot Pink Suit
            { id: 'worker', name: 'Worker', cost: 0, color: 0xe0ac69, suitColor: 0x4682b4 } // Steel Blue Suit
        ];

        this.shopEl = document.getElementById('shop-screen');
        if (!this.shopEl) {
            this.createShopStructure();
        }

        this.createUI();
        this.bindEvents();
    }

    createShopStructure() {
        let shopOverlay = document.getElementById('shop-screen');
        if (!shopOverlay) {
            shopOverlay = document.createElement('div');
            shopOverlay.id = 'shop-screen';
            shopOverlay.className = 'hidden'; // Controlled by CSS class
            shopOverlay.innerHTML = `
                <div class="shop-content">
                    <h2 class="shop-title">Shop</h2>
                    <div id="shop-items" class="skins-container">
                        <!-- Items will be injected here -->
                    </div>
                    <div class="text-center">
                        <button id="close-shop-btn" class="close-shop-btn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(shopOverlay);
            this.shopEl = shopOverlay;
        }
    }

    createUI() {
        const itemsContainer = this.shopEl.querySelector('#shop-items');
        itemsContainer.innerHTML = '';

        this.skins.forEach(skin => {
            const itemEl = document.createElement('div');
            itemEl.className = 'skin-item';
            itemEl.dataset.id = skin.id;

            // Preview Box
            const previewColor = '#' + skin.suitColor.toString(16).padStart(6, '0');

            itemEl.innerHTML = `
                <div class="skin-preview" style="background-color: ${previewColor};"></div>
                <h3>${skin.name}</h3>
                <p>${skin.cost === 0 ? 'Free' : skin.cost + ' Stamps'}</p>
            `;

            itemsContainer.appendChild(itemEl);
        });
    }

    bindEvents() {
        const closeBtn = this.shopEl.querySelector('#close-shop-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        const skinItems = this.shopEl.querySelectorAll('.skin-item');
        skinItems.forEach(item => {
            item.addEventListener('click', () => {
                const skinId = item.dataset.id;
                this.equipSkin(skinId);

                // Visual feedback
                skinItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });
    }

    show() {
        this.shopEl.classList.remove('hidden');
        // Flex is handled by CSS when not hidden
    }

    hide() {
        this.shopEl.classList.add('hidden');
    }

    equipSkin(id) {
        const skin = this.skins.find(s => s.id === id);
        if (skin) {
            this.player.setSkin(skin);
        }
    }
}
