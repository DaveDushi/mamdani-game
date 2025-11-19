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
            shopOverlay.className = 'absolute inset-0 bg-black bg-opacity-80 hidden flex-col items-center justify-center z-50';
            shopOverlay.innerHTML = `
                <div class="bg-white p-8 rounded-lg max-w-2xl w-full">
                    <h2 class="text-3xl font-bold mb-6 text-center">Shop</h2>
                    <div id="shop-items" class="grid grid-cols-2 gap-4 mb-6">
                        <!-- Items will be injected here -->
                    </div>
                    <div class="text-center">
                        <button id="close-shop-btn" class="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 font-bold">Close</button>
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
            itemEl.className = 'skin-item border-2 border-gray-300 p-4 rounded cursor-pointer hover:border-blue-500 transition-colors flex flex-col items-center';
            itemEl.dataset.id = skin.id;

            // Preview Box
            const previewColor = '#' + skin.suitColor.toString(16).padStart(6, '0');

            itemEl.innerHTML = `
                <div class="w-16 h-16 mb-2 rounded-full border-2 border-black" style="background-color: ${previewColor};"></div>
                <h3 class="font-bold text-lg">${skin.name}</h3>
                <p class="text-gray-600">${skin.cost === 0 ? 'Free' : skin.cost + ' Stamps'}</p>
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
                skinItems.forEach(i => i.classList.remove('border-green-500', 'bg-green-50'));
                item.classList.add('border-green-500', 'bg-green-50');
            });
        });
    }

    show() {
        this.shopEl.classList.remove('hidden');
        this.shopEl.classList.add('flex');
    }

    hide() {
        this.shopEl.classList.add('hidden');
        this.shopEl.classList.remove('flex');
    }

    equipSkin(id) {
        const skin = this.skins.find(s => s.id === id);
        if (skin) {
            this.player.setSkin(skin);
        }
    }
}
