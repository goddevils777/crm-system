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

        // Скрываем контент перед обновлением
        contentArea.style.opacity = '0';

        // Получаем сохраненный HTML
        const moduleAssets = this.moduleAssets.get(moduleName);
        if (moduleAssets && moduleAssets.html) {
            contentArea.innerHTML = moduleAssets.html;
        } else {
            // Если HTML потерялся, перезагружаем модуль полностью
            console.log('HTML assets lost, reloading module completely');
            this.loadedModules.delete(moduleName);
            this.moduleAssets.delete(moduleName);
            return this.loadModule(moduleName);
        }

        // Показываем контент с плавным появлением
        setTimeout(() => {
            contentArea.style.opacity = '1';
        }, 50);

        // Даем время DOM обновиться
        await new Promise(resolve => setTimeout(resolve, 100));

        // УЛУЧШЕННАЯ ИНИЦИАЛИЗАЦИЯ - проверяем что класс существует
        let moduleInstance = null;
        try {
            if (moduleName === 'cards' && window.CardsModule) {
                console.log('Creating new CardsModule instance...');
                moduleInstance = new window.CardsModule();
                window.cardsModule = moduleInstance;
            } else if (moduleName === 'expenses' && window.ExpensesModule) {
                console.log('Creating new ExpensesModule instance...');
                moduleInstance = new window.ExpensesModule();
                window.expensesModule = moduleInstance;
            } else if (moduleName === 'teams' && window.TeamsModule) {
                console.log('Creating new TeamsModule instance...');
                moduleInstance = new window.TeamsModule();
                window.teamsModule = moduleInstance;
            } else {
                console.warn(`Module class not found for: ${moduleName}`);
            }
        } catch (error) {
            console.error('Error creating module instance:', error);
            // Если ошибка создания - перезагружаем модуль
            this.loadedModules.delete(moduleName);
            this.moduleAssets.delete(moduleName);
            return this.loadModule(moduleName);
        }

        return moduleInstance;
    }

    getModuleAssets(moduleName) {
        return this.moduleAssets.get(moduleName) || null;
    }

    async loadAndInitModule(moduleName) {
        try {
            console.log('=== STARTING loadAndInitModule for:', moduleName, '===');

            // Загружаем ресурсы
            const moduleAssets = await this.loadModuleAssets(moduleName);
            console.log('Assets loaded:', moduleAssets);

            // Подготавливаем контент для плавной вставки
            const contentArea = document.getElementById('content-area');
            if (!contentArea) {
                throw new Error('Content area not found');
            }

            // Скрываем область перед вставкой нового контента
            contentArea.style.opacity = '0';

            // Ждем завершения CSS загрузки перед вставкой HTML
            await new Promise(resolve => setTimeout(resolve, 100));

            if (moduleAssets.html) {
                console.log('Inserting HTML into content area...');
                contentArea.innerHTML = moduleAssets.html;
                console.log('HTML inserted successfully');
            } else {
                throw new Error('HTML not loaded');
            }

            // Показываем контент плавно после вставки
            setTimeout(() => {
                contentArea.style.opacity = '1';
            }, 50);

            // Даем время DOM и CSS полностью обновиться
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
                console.log('Creating new CardsModule instance...');
                moduleInstance = new window.CardsModule();
                window.cardsModule = moduleInstance;
            } else if (moduleName === 'expenses' && window.ExpensesModule) {
                console.log('Creating new ExpensesModule instance...');
                moduleInstance = new window.ExpensesModule();
                window.expensesModule = moduleInstance;
            } else if (moduleName === 'teams' && window.TeamsModule) {
                console.log('Creating new TeamsModule instance...');
                moduleInstance = new window.TeamsModule();
                window.teamsModule = moduleInstance;
            } else {
                console.warn(`Module class not found for: ${moduleName}`);
            }

            // Сохраняем ресурсы модуля
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
                contentArea.style.opacity = '1';
            }

            throw error;
        }
    }

    async loadModuleAssets(moduleName) {
        console.log('Starting to load assets for:', moduleName);

        try {
            // Загружаем CSS первым и ждем его полной загрузки
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

            // Ждем полной загрузки CSS
            link.onload = () => {
                // Даем время браузеру применить стили
                setTimeout(() => resolve(true), 50);
            };
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

            return html;
        } catch (error) {
            console.error('Error loading HTML:', error);
            throw error;
        }
    }

    loadJS(moduleName) {
        return new Promise((resolve, reject) => {
            // Для confirm-modal не перезагружаем
            if (moduleName === 'confirm-modal' && window.ConfirmModal) {
                console.log('ConfirmModal already loaded');
                resolve(true);
                return;
            }

            const existingScript = document.querySelector(`script[src*="${moduleName}.js"]`);
            if (existingScript && moduleName !== 'confirm-modal') {
                console.log('JS already loaded for', moduleName);
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = `modules/${moduleName}/${moduleName}.js?v=${Date.now()}`;
            script.setAttribute('data-module', moduleName);
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

        // Устанавливаем переход для плавности
        contentArea.style.transition = 'opacity 0.2s ease';
        contentArea.style.opacity = '0';

        // Вставляем лоадер
        contentArea.innerHTML = `
            <div class="module-loader">
                <div class="loader-spinner"></div>
                <p>Загрузка модуля...</p>
            </div>
        `;

        // Показываем лоадер плавно
        setTimeout(() => {
            contentArea.style.opacity = '1';
        }, 10);
    }

    hideLoader() {
        // Лоадер скроется когда загрузится контент
        const contentArea = document.getElementById('content-area');
        if (contentArea) {
            contentArea.style.transition = 'opacity 0.2s ease';
        }
    }
}

// Создаем глобальный загрузчик
window.moduleLoader = new ModuleLoader();