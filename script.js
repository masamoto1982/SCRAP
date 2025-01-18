const DEBUG = {
    log: (category, msg) => console.log(`[${category}]`, msg),
    stack: () => console.log('Stack:', {data: FORTH.dataStack, return: FORTH.returnStack})
};

const DB = {
    name: 'forthDB',
    version: 1,
    store: 'dictionary',
    db: null,

    async init() {
        DEBUG.log('DB', 'Initializing IndexedDB');
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.name, this.version);
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error initializing DB');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                DEBUG.log('DB', 'Successfully connected to DB');
                this.loadCustomWords().then(resolve);
            };
            
            request.onupgradeneeded = event => {
                DEBUG.log('DB', 'Creating/upgrading database');
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.store)) {
                    db.createObjectStore(this.store, { keyPath: 'name' });
                    DEBUG.log('DB', 'Created dictionary store');
                }
            };
        });
    },

    async loadCustomWords() {
        DEBUG.log('DB', 'Loading custom words');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.store], 'readonly');
        const store = transaction.objectStore(this.store);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                const words = request.result;
                DEBUG.log('DB', `Loaded ${words.length} custom words`);
                words.forEach(word => {
                    CUSTOM_WORDS.definitions.set(word.name, {
                        definition: word.definition,
                        description: word.description
                    });
                });
                CUSTOM_WORDS.updateDisplay();
                CUSTOM_WORDS.updateDeleteInput();
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error loading custom words');
                reject(request.error);
            };
        });
    },

    async saveWord(name, definition, description) {
        DEBUG.log('DB', `Saving word: ${name}`);
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.store], 'readwrite');
        const store = transaction.objectStore(this.store);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ name, definition, description });
            request.onsuccess = () => {
                DEBUG.log('DB', `Word saved: ${name}`);
                resolve();
            };
            request.onerror = () => {
                DEBUG.log('DB', `Error saving word: ${name}`);
                reject(request.error);
            };
        });
    },

    async deleteWord(name) {
        DEBUG.log('DB', `Deleting word: ${name}`);
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.store], 'readwrite');
        const store = transaction.objectStore(this.store);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(name);
            request.onsuccess = () => {
                DEBUG.log('DB', `Word deleted: ${name}`);
                resolve();
            };
            request.onerror = () => {
                DEBUG.log('DB', `Error deleting word: ${name}`);
                reject(request.error);
            };
        });
    }
};

const FORTH = {
    dataStack: [],
    returnStack: [],
    dictionary: new Map(),
    compiling: false,
    currentDefinition: []
};

const CUSTOM_WORDS = {
    definitions: new Map(),
    exists: name => CUSTOM_WORDS.definitions.has(name),
    count: () => CUSTOM_WORDS.definitions.size,

    async add(name, definition, description) {
        try {
            await DB.saveWord(name, definition, description);
            this.definitions.set(name, { definition, description });
            this.updateDisplay();
            this.updateDeleteInput();
            DEBUG.log('CustomWord', `Added and saved: ${name}`);
        } catch (error) {
            throw new Error(`Failed to save word: ${error.message}`);
        }
    },

    async remove(name) {
        if (!this.exists(name)) throw new Error("Custom word not found");
        try {
            await DB.deleteWord(name);
            this.definitions.delete(name);
            this.updateDisplay();
            this.updateDeleteInput();
            DEBUG.log('CustomWord', `Removed and deleted: ${name}`);
        } catch (error) {
            throw new Error(`Failed to delete word: ${error.message}`);
        }
    },

    updateDisplay() {
        const container = document.getElementById('custom_words_container');
        container.className = 'words_container';
        container.innerHTML = '';

        this.definitions.forEach((data, name) => {
            const button = document.createElement('button');
            Object.assign(button, {
                className: 'word_button',
                textContent: name,
                title: data.description,
                onclick: () => PUSH_TO_DATA_STACK(name)
            });
            const group = document.createElement('div');
            group.className = 'button_group';
            group.appendChild(button);
            container.appendChild(group);
        });
    },

    updateDeleteInput() {
        const container = document.querySelector('.flex_2');
        container.classList.toggle('no_words', this.count() === 0);
    }
};

const updateStackDisplay = () => {
    const container = document.getElementById('data_stack_container');
    container.innerHTML = '';
    
    FORTH.dataStack.forEach((value, index) => {
        const button = document.createElement('button');
        button.className = 'word_button' + (index === FORTH.dataStack.length - 1 ? ' stack_top' : '');
        button.textContent = value;
        container.appendChild(button);
    });
    DEBUG.stack();
};

const PUSH_TO_DATA_STACK = value => {
    FORTH.dataStack.push(value);
    updateStackDisplay();
};

const ADD_OUTPUT = text => {
    const output = document.getElementById('output_content');
    const line = document.createElement('div');
    line.textContent = text;
    output.insertBefore(line, output.firstChild);
};

const EXECUTE_WORD = word => {
    DEBUG.log('Execute', `Word: ${word}`);
    
    if (word === '+') {
        if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
        const [n2, n1] = [FORTH.dataStack.pop(), FORTH.dataStack.pop()];
        if (typeof n1 !== 'number' || typeof n2 !== 'number') 
            throw new Error("Numbers required");
        FORTH.dataStack.push(n1 + n2);
        return `${n1} + ${n2} = ${FORTH.dataStack[FORTH.dataStack.length-1]}`;
    }

    if (CUSTOM_WORDS.exists(word)) {
        const {definition} = CUSTOM_WORDS.definitions.get(word);
        const output = definition.split(/\s+/).map(token => {
            if (!isNaN(token)) {
                FORTH.dataStack.push(Number(token));
                return null;
            }
            return EXECUTE_WORD(token);
        }).filter(Boolean);
        return `${word}: ${output.join(', ')}`;
    }

    throw new Error(`Unknown word: ${word}`);
};

const HANDLE_STACK_INPUT = event => {
    if (event.key === 'Enter' && event.target.value.trim()) {
        const value = event.target.value.trim();
        PUSH_TO_DATA_STACK(isNaN(value) ? value : Number(value));
        event.target.value = '';
        event.preventDefault();
    }
};

const HANDLE_WORD_DEFINITION_KEYPRESS = (event, currentField) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        const fields = ['word_name', 'word_definition', 'word_description'];
        const currentIndex = fields.indexOf(currentField);
        if (currentIndex === fields.length - 1) {
            DEFINE_WORD();
            document.getElementById('word_name').focus();
        } else {
            document.getElementById(fields[currentIndex + 1]).focus();
        }
    }
};

const DEFINE_WORD = async () => {
    const [name, def, desc] = ['word_name', 'word_definition', 'word_description']
        .map(id => document.getElementById(id).value.trim());

    try {
        if (!name || !def) throw new Error("Name and definition required");
        if (FORTH.dictionary.has(name)) throw new Error("Cannot redefine built-in word");

        await CUSTOM_WORDS.add(name, def, desc);
        ['word_name', 'word_definition', 'word_description']
            .forEach(id => document.getElementById(id).value = '');
        ADD_OUTPUT(`Defined: ${name}`);
    } catch (error) {
        ADD_OUTPUT(`Error: ${error.message}`);
    }
};

const HANDLE_DELETE_WORD = async event => {
    if (event.key === 'Enter') {
        const name = event.target.value.trim();
        try {
            if (FORTH.dictionary.has(name)) throw new Error("Cannot delete built-in word");
            await CUSTOM_WORDS.remove(name);
            event.target.value = '';
            ADD_OUTPUT(`Deleted: ${name}`);
        } catch (error) {
            ADD_OUTPUT(`Error: ${error.message}`);
        }
    }
};

const RUN_ALL_STACKS = () => {
    try {
        if (FORTH.dataStack.length > 0) {
            const word = FORTH.dataStack[FORTH.dataStack.length - 1];
            if (FORTH.dictionary.has(word) || CUSTOM_WORDS.exists(word)) {
                const output = EXECUTE_WORD(FORTH.dataStack.pop());
                ADD_OUTPUT(output);
            }
        }
        updateStackDisplay();
    } catch (error) {
        ADD_OUTPUT(`Error: ${error.message}`);
    }
};

const INIT_UI = () => {
    document.getElementById('data_stack_input')
        .addEventListener('keypress', HANDLE_STACK_INPUT);

    CUSTOM_WORDS.updateDeleteInput();
};

const INIT_APPLICATION = async () => {
    try {
        await DB.init();
        ['+', 'DUP', 'DROP', 'SWAP', '>R', 'R>', 'R@'].forEach(word => 
            FORTH.dictionary.set(word, word)
        );
        INIT_UI();
        DEBUG.log('Init', 'Application initialized with IndexedDB');
    } catch (error) {
        DEBUG.log('Error', `IndexedDB initialization failed: ${error.message}`);
        ADD_OUTPUT(`Error: Failed to initialize database`);
    }
};

document.addEventListener('DOMContentLoaded', INIT_APPLICATION);