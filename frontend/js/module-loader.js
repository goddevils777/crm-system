// Ленивая загрузка модулей - только при необходимости
class ModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingModules = new Map();
        this.moduleAssets = new Map();
    }
    async loadModule(moduleName) {
        console.log('=== LOADING MODULE:', moduleName, '===');

        // Если модуль уже загружен
        if (this.loadedModules.has(moduleName)) {
            console.log('Module already loaded, reinitializing...');
            return this.reinitModule(moduleName);
        }

        // Если модуль уже загружается
        if (this.loadingModules.has(moduleName)) {
            console.log('Module already loading, waiting...');
            return this.loadingModules.get(moduleName);
        }

        // Показываем лоадер
        this.showLoader();

        // Создаем промис загрузки
        const loadingPromise = this.loadAndInitModule(moduleName);
        this.loadingModules.set(moduleName, loadingPromise);

        return loadingPromise;
    }
    async reinitModule(moduleName) {
        console.log('Reinitializing module:', moduleName);

        const contentArea = document.getElementById('content-area');
        if (!contentArea) {
            throw new Error('Content area not found');
        }

        // Получаем сохраненный HTML
        const moduleAssets = this.moduleAssets.get(moduleName);
        if (moduleAssets && moduleAssets.html) {
            contentArea.innerHTML = moduleAssets.html;
        } else {
            // Если HTML потерялся, перезагружаем модуль полностью
            this.loadedModules.delete(moduleName);
            return this.loadModule(moduleName);
        }

        // Даем время DOM обновиться
        await new Promise(resolve => setTimeout(resolve, 100));

        // НЕ ЗАГРУЖАЕМ JS ПОВТОРНО - просто создаем новый экземпляр
        if (moduleName === 'cards' && window.CardsModule) {
            const instance = new window.CardsModule();
            window.cardsModule = instance;
            return instance;
        } else if (moduleName === 'expenses' && window.ExpensesModule) {
            const instance = new window.ExpensesModule();
            window.expensesModule = instance;
            return instance;
        }

        return true;
    }

    // Метод для получения сохраненных ресурсов модуля
    getModuleAssets(moduleName) {
        return this.moduleAssets.get(moduleName) || null;
    }

    async loadAndInitModule(moduleName) {
        try {
            console.log('=== STARTING loadAndInitModule for:', moduleName, '===');

            // Загружаем ресурсы
            const moduleAssets = await this.loadModuleAssets(moduleName);
            console.log('Assets loaded:', moduleAssets);

            // Вставляем HTML
            const contentArea = document.getElementById('content-area');
            if (contentArea && moduleAssets.html) {
                console.log('Inserting HTML into content area...');
                contentArea.innerHTML = moduleAssets.html;
                console.log('HTML inserted successfully');

                // ДОБАВЬ ПРОВЕРКУ ПОСЛЕ ВСТАВКИ:
                setTimeout(() => {
                    const viewBtnsAfterInsert = document.querySelectorAll('.view-btn');
                    const containerAfterInsert = document.getElementById('cards-container');
                    const tableContainerAfterInsert = document.getElementById('cards-table-container');
                    console.log('After HTML insert - view buttons:', viewBtnsAfterInsert.length);
                    console.log('After HTML insert - cards container exists:', !!containerAfterInsert);
                    console.log('After HTML insert - table container exists:', !!tableContainerAfterInsert);

                    if (viewBtnsAfterInsert.length > 0) {
                        console.log('View buttons found in DOM after insert!');
                    } else {
                        console.error('View buttons STILL not found after HTML insert!');
                        console.log('Current content area HTML:', contentArea.innerHTML.substring(0, 500));
                    }
                }, 50);
            } else {
                throw new Error('Content area not found or HTML not loaded');
            }

            // Даем время DOM обновиться
            console.log('Waiting for DOM to update...');
            await new Promise(resolve => setTimeout(resolve, 200));

            // Проверяем элементы
            const viewBtns = document.querySelectorAll('.view-btn');
            const cardsContainer = document.getElementById('cards-container');
            const tableContainer = document.getElementById('cards-table-container');

            console.log('Final DOM check:');
            console.log('- View buttons:', viewBtns.length);
            console.log('- Cards container:', !!cardsContainer);
            console.log('- Table container:', !!tableContainer);

            // Инициализируем модуль и сохраняем экземпляр
            let moduleInstance = null;
            if (moduleName === 'cards' && window.CardsModule) {
                console.log('Creating CardsModule instance...');
                moduleInstance = new window.CardsModule();
                window.cardsModule = moduleInstance;
                console.log('CardsModule instance created and saved globally');
            } else if (moduleName === 'expenses' && window.ExpensesModule) {
                console.log('Creating ExpensesModule instance...');
                moduleInstance = new window.ExpensesModule();
                window.expensesModule = moduleInstance;
                console.log('ExpensesModule instance created and saved globally');
            }

            // На эту с проверкой:
            if (this.moduleAssets) {
                this.moduleAssets.set(moduleName, moduleAssets);
            } else {
                console.error('moduleAssets Map not initialized!');
                this.moduleAssets = new Map();
                this.moduleAssets.set(moduleName, moduleAssets);
            }
            this.loadedModules.add(moduleName);
            this.loadingModules.delete(moduleName);
            this.hideLoader();



            console.log('=== loadAndInitModule COMPLETED for:', moduleName, '===');
            return moduleInstance;
        } catch (error) {
            console.error('=== ERROR in loadAndInitModule:', error, '===');
            this.loadingModules.delete(moduleName);
            this.hideLoader();
            const contentArea = document.getElementById('content-area');
            if (contentArea) {
                contentArea.classList.add('loaded');
            }

            throw error;
        }
    }
    async loadModuleAssets(moduleName) {
        console.log('Starting to load assets for:', moduleName);

        try {
            // Загружаем CSS первым
            console.log('Loading CSS...');
            const cssLoaded = await this.loadCSS(moduleName);
            console.log('CSS loaded:', cssLoaded);

            // Затем HTML
            console.log('Loading HTML...');
            const htmlContent = await this.loadHTML(moduleName);
            console.log('HTML loaded, length:', htmlContent ? htmlContent.length : 'null');

            // JS последним
            console.log('Loading JS...');
            const jsLoaded = await this.loadJS(moduleName);
            console.log('JS loaded:', jsLoaded);

            const result = { css: cssLoaded, html: htmlContent, js: jsLoaded };
            console.log('All assets loaded for', moduleName, result);

            return result;
        } catch (error) {
            console.error('Error loading assets for', moduleName, error);
            throw error;
        }
    }

    loadCSS(moduleName) {
        return new Promise((resolve, reject) => {
            const existingLink = document.querySelector(`link[href*="${moduleName}.css"]`);
            if (existingLink) {
                resolve(true);
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = `modules/${moduleName}/${moduleName}.css?v=${Date.now()}`;
            link.onload = () => resolve(true);
            link.onerror = () => reject(new Error(`Failed to load CSS for ${moduleName}`));
            document.head.appendChild(link);
        });
    }

    async loadHTML(moduleName) {
        try {
            const response = await fetch(`modules/${moduleName}/${moduleName}.html?v=${Date.now()}`);
            if (!response.ok) throw new Error(`Failed to load HTML for ${moduleName}: ${response.status}`);
            const html = await response.text();
            console.log('HTML loaded for module:', moduleName, 'length:', html.length);

            // ДОБАВЬ ОТЛАДКУ СОДЕРЖИМОГО HTML:
            console.log('HTML content preview:', html.substring(0, 500));

            // Проверяем есть ли нужные элементы в HTML
            const hasViewBtns = html.includes('view-btn');
            const hasCardsContainer = html.includes('cards-container');
            console.log('HTML contains view-btn:', hasViewBtns);
            console.log('HTML contains cards-container:', hasCardsContainer);

            return html;
        } catch (error) {
            console.error('Error loading HTML:', error);
            throw error;
        }
    }
    loadJS(moduleName) {
        return new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src*="${moduleName}.js"]`);
            if (existingScript) {
                console.log('JS already loaded for', moduleName);
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = `modules/${moduleName}/${moduleName}.js?v=${Date.now()}`;
            script.setAttribute('data-module', moduleName); // Добавляем метку
            script.onload = () => {
                console.log('JS loaded for', moduleName);
                resolve(true);
            };
            script.onerror = () => reject(new Error(`Failed to load JS for ${moduleName}`));
            document.head.appendChild(script);
        });
    }

    showLoader() {
        const contentArea = document.getElementById('content-area');
        contentArea.innerHTML = `
      <div class="module-loader">
        <div class="loader-spinner"></div>
        <p>Загрузка модуля...</p>
      </div>
    `;
    }

    hideLoader() {
        // Лоадер скроется когда загрузится контент
    }

    async initModule(moduleName) {
        try {
            // Получаем загруженные ресурсы
            const moduleAssets = await this.loadingModules.get(moduleName);

            // ВАЖНО: сначала вставляем HTML
            if (moduleAssets && moduleAssets.html) {
                const contentArea = document.getElementById('content-area');
                if (contentArea) {
                    contentArea.innerHTML = moduleAssets.html;
                    console.log('HTML inserted for module:', moduleName);
                } else {
                    throw new Error('Content area not found');
                }
            } else {
                throw new Error('HTML not loaded for module: ' + moduleName);
            }

            // Ждем чтобы DOM обновился
            await new Promise(resolve => setTimeout(resolve, 100));

            // Проверяем что элементы появились
            const viewBtns = document.querySelectorAll('.view-btn');
            console.log('View buttons found after HTML insert:', viewBtns.length);

            // Инициализируем модуль
            if (moduleName === 'cards' && window.CardsModule) {
                return new window.CardsModule();
            } else if (moduleName === 'expenses' && window.ExpensesModule) {
                return new window.ExpensesModule();
            }

            return true;
        } catch (error) {
            console.error('Error initializing module:', error);
            throw error;
        }
    }
}

// Создаем глобальный загрузчик
window.moduleLoader = new ModuleLoader();