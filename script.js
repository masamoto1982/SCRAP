const DEBUG = {
    log: (category, msg, ...args) => console.log(`[${category}]`, msg, ...args),
    stack: () => console.log('Stack:', {
        data: FORTH.dataStack, 
        return: FORTH.returnStack,
        control: FORTH.controlStack
    })
};

const DB = {
    name: 'forthDB',
    version: 2,
    stores: {
        dictionary: 'dictionary',
        stacks: 'stacks',
        output: 'output'
    },
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
                Promise.all([
                    this.loadCustomWords(),
                    this.loadStacks(),
                    this.loadOutput()
                ]).then(resolve);
            };
            
            request.onupgradeneeded = event => {
                DEBUG.log('DB', 'Creating/upgrading database');
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains(this.stores.dictionary)) {
                    db.createObjectStore(this.stores.dictionary, { keyPath: 'name' });
                    DEBUG.log('DB', 'Created dictionary store');
                }
                
                if (!db.objectStoreNames.contains(this.stores.stacks)) {
                    db.createObjectStore(this.stores.stacks, { keyPath: 'id' });
                    DEBUG.log('DB', 'Created stacks store');
                }
                
                if (!db.objectStoreNames.contains(this.stores.output)) {
                    db.createObjectStore(this.stores.output, { 
                        keyPath: 'timestamp',
                        autoIncrement: true 
                    });
                    DEBUG.log('DB', 'Created output store');
                }
            };
        });
    },

    async loadCustomWords() {
        DEBUG.log('DB', 'Loading custom words');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.dictionary], 'readonly');
        const store = transaction.objectStore(this.stores.dictionary);
        
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

    async loadStacks() {
        DEBUG.log('DB', 'Loading stacks');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.stacks], 'readonly');
        const store = transaction.objectStore(this.stores.stacks);
        
        return new Promise((resolve, reject) => {
            const request = store.get('current');
            
            request.onsuccess = () => {
                const stacks = request.result;
                if (stacks) {
                    FORTH.dataStack = stacks.dataStack || [];
                    FORTH.returnStack = stacks.returnStack || [];
                    updateStackDisplay();
                }
                DEBUG.log('DB', 'Loaded stacks');
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error loading stacks');
                reject(request.error);
            };
        });
    },

    async loadOutput() {
        DEBUG.log('DB', 'Loading output history');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.output], 'readonly');
        const store = transaction.objectStore(this.stores.output);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                const outputs = request.result;
                outputs.sort((a, b) => b.timestamp - a.timestamp);
                outputs.forEach(output => {
                    ADD_OUTPUT(output.text, false);
                });
                DEBUG.log('DB', `Loaded ${outputs.length} output entries`);
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error loading output history');
                reject(request.error);
            };
        });
    },
	
	async saveWord(name, definition, description) {
        DEBUG.log('DB', `Saving word: ${name}`);
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.dictionary], 'readwrite');
        const store = transaction.objectStore(this.stores.dictionary);
        
        const normalizedName = NORMALIZE_WORD(name);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ 
                name: normalizedName, 
                definition: definition,
                description: description 
            });
            request.onsuccess = () => {
                DEBUG.log('DB', `Word saved: ${normalizedName}`);
                resolve();
            };
            request.onerror = () => {
                DEBUG.log('DB', `Error saving word: ${normalizedName}`);
                reject(request.error);
            };
        });
    },

    async saveStacks() {
        DEBUG.log('DB', 'Saving stacks');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.stacks], 'readwrite');
        const store = transaction.objectStore(this.stores.stacks);
        
        return new Promise((resolve, reject) => {
            const request = store.put({
                id: 'current',
                dataStack: FORTH.dataStack,
                returnStack: FORTH.returnStack,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => {
                DEBUG.log('DB', 'Stacks saved');
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error saving stacks');
                reject(request.error);
            };
        });
    },

    async saveOutput(text) {
        DEBUG.log('DB', 'Saving output');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.output], 'readwrite');
        const store = transaction.objectStore(this.stores.output);
        
        return new Promise((resolve, reject) => {
            const request = store.add({
                text: text,
                timestamp: Date.now()
            });
            
            request.onsuccess = () => {
                DEBUG.log('DB', 'Output saved');
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error saving output');
                reject(request.error);
            };
        });
    },

    async deleteWord(name) {
        DEBUG.log('DB', `Deleting word: ${name}`);
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.dictionary], 'readwrite');
        const store = transaction.objectStore(this.stores.dictionary);
        
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
    },

    async clearOutput() {
        DEBUG.log('DB', 'Clearing output history');
        if (!this.db) throw new Error('Database not initialized');
        
        const transaction = this.db.transaction([this.stores.output], 'readwrite');
        const store = transaction.objectStore(this.stores.output);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            
            request.onsuccess = () => {
                DEBUG.log('DB', 'Output history cleared');
                resolve();
            };
            
            request.onerror = () => {
                DEBUG.log('DB', 'Error clearing output history');
                reject(request.error);
            };
        });
    }
};

const NORMALIZE_WORD = word => {
    return typeof word === 'string' ? word.toUpperCase() : word;
};

const FORTH = {
    dataStack: [],
    returnStack: [],
    dictionary: new Map(),
    compiling: false,
    currentDefinition: [],
    controlStack: [],
    loopIndex: null
};

const CUSTOM_WORDS = {
    definitions: new Map(),
    exists: name => CUSTOM_WORDS.definitions.has(NORMALIZE_WORD(name)),
    count: () => CUSTOM_WORDS.definitions.size,

    async add(name, definition, description) {
        try {
            const normalizedName = NORMALIZE_WORD(name);
            const normalizedDefinition = definition.split(/\s+/)
                .map(token => NORMALIZE_WORD(token))
                .join(' ');
            
            await DB.saveWord(normalizedName, normalizedDefinition, description);
            this.definitions.set(normalizedName, { 
                definition: normalizedDefinition, 
                description 
            });
            this.updateDisplay();
            this.updateDeleteInput();
            DEBUG.log('CustomWord', `Added and saved: ${normalizedName}`);
        } catch (error) {
            throw new Error(`Failed to save word: ${error.message}`);
        }
    },

    async remove(name) {
        const normalizedName = NORMALIZE_WORD(name);
        if (!this.exists(normalizedName)) throw new Error("Custom word not found");
        try {
            await DB.deleteWord(normalizedName);
            this.definitions.delete(normalizedName);
            this.updateDisplay();
            this.updateDeleteInput();
            DEBUG.log('CustomWord', `Removed and deleted: ${normalizedName}`);
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
        button.title = `Type: ${typeof value}`;
        container.appendChild(button);
    });
    DEBUG.stack();
};

const PUSH_TO_DATA_STACK = value => {
    if (!isNaN(value) && typeof value !== 'boolean') {
        FORTH.dataStack.push(Number(value));
    } else {
        FORTH.dataStack.push(NORMALIZE_WORD(value));
    }
    updateStackDisplay();
    DB.saveStacks();
    DEBUG.log('Stack', 'Current stack:', FORTH.dataStack);
};

const ADD_OUTPUT = (text, save = true) => {
    const output = document.getElementById('output_content');
    const line = document.createElement('div');
    line.textContent = text;
    output.insertBefore(line, output.firstChild);
    
    if (save) {
        DB.saveOutput(text);
    }
};

const EXECUTE_WORD = word => {
    const normalizedWord = NORMALIZE_WORD(word);
    DEBUG.log('Execute', `Word: ${normalizedWord}`);
    
    // 数値の場合
    if (!isNaN(word) && typeof word !== 'boolean') {
        const num = Number(word);
        FORTH.dataStack.push(num);
        DEBUG.log('Stack', 'Pushed number:', num);
        return null;
    }

    // 比較演算子
    const compareOps = {
        '=': (a, b) => a === b ? -1 : 0,
        '<>': (a, b) => a !== b ? -1 : 0,
        '<': (a, b) => a < b ? -1 : 0,
        '>': (a, b) => a > b ? -1 : 0,
        '<=': (a, b) => a <= b ? -1 : 0,
        '>=': (a, b) => a >= b ? -1 : 0
    };

    if (compareOps[normalizedWord]) {
        if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
        const [b, a] = [FORTH.dataStack.pop(), FORTH.dataStack.pop()];
        if (typeof a !== 'number' || typeof b !== 'number') 
            throw new Error("Numbers required");
        FORTH.dataStack.push(compareOps[normalizedWord](a, b));
        return `${a} ${normalizedWord} ${b} = ${FORTH.dataStack[FORTH.dataStack.length-1]}`;
    }

    // スタック操作
    switch (normalizedWord) {
        case 'DUP':
            if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
            const v = FORTH.dataStack[FORTH.dataStack.length - 1];
            FORTH.dataStack.push(v);
            return `DUP: ${v}`;

        case 'DROP':
            if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
            const d = FORTH.dataStack.pop();
            return `DROP: ${d}`;

        case 'SWAP':
            if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
            const [b1, a1] = [FORTH.dataStack.pop(), FORTH.dataStack.pop()];
            FORTH.dataStack.push(b1);
            FORTH.dataStack.push(a1);
            return `SWAP: ${a1} ${b1}`;

        case 'IF':
            if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
            const condition = FORTH.dataStack.pop();
            FORTH.controlStack.push({
                type: 'IF',
                executing: condition !== 0
            });
            return null;

        case 'THEN':
            if (FORTH.controlStack.length === 0 || 
                FORTH.controlStack[FORTH.controlStack.length - 1].type !== 'IF')
                throw new Error("THEN without matching IF");
            FORTH.controlStack.pop();
            return null;

        case 'DO':
            if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
            const [limit, initial] = [FORTH.dataStack.pop(), FORTH.dataStack.pop()];
            if (typeof limit !== 'number' || typeof initial !== 'number')
                throw new Error("Numbers required for DO LOOP");
            FORTH.controlStack.push({
                type: 'DO',
                index: initial,
                limit: limit,
                startPosition: FORTH.dataStack.length
            });
            return null;

        case 'I':
            if (FORTH.controlStack.length === 0 || 
                FORTH.controlStack[FORTH.controlStack.length - 1].type !== 'DO')
                throw new Error("I used outside of DO LOOP");
            const currentLoop = FORTH.controlStack[FORTH.controlStack.length - 1];
            FORTH.dataStack.push(currentLoop.index);
            return `I: ${currentLoop.index}`;

        case 'LOOP':
            if (FORTH.controlStack.length === 0 || 
                FORTH.controlStack[FORTH.controlStack.length - 1].type !== 'DO')
                throw new Error("LOOP without matching DO");
            const loop = FORTH.controlStack[FORTH.controlStack.length - 1];
            loop.index++;
            if (loop.index < loop.limit) {
                return 'continue';
            } else {
                FORTH.controlStack.pop();
                return null;
            }
    }

    // 算術演算子
    const mathOps = {
        '+': (a, b) => a + b,
        '-': (a, b) => a - b,
        '*': (a, b) => a * b,
        '/': (a, b) => {
            if (b === 0) throw new Error("Division by zero");
            return Math.floor(a / b);
        }
    };

    if (mathOps[normalizedWord]) {
        if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
        const [b2, a2] = [FORTH.dataStack.pop(), FORTH.dataStack.pop()];
        if (typeof a2 !== 'number' || typeof b2 !== 'number') 
            throw new Error("Numbers required");
        FORTH.dataStack.push(mathOps[normalizedWord](a2, b2));
        return `${a2} ${normalizedWord} ${b2} = ${FORTH.dataStack[FORTH.dataStack.length-1]}`;
    }

    // リターンスタック操作
    switch (normalizedWord) {
        case '>R':
            if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
            FORTH.returnStack.push(FORTH.dataStack.pop());
            return null;
        case 'R>':
            if (FORTH.returnStack.length < 1) throw new Error("Return stack underflow");
            FORTH.dataStack.push(FORTH.returnStack.pop());
            return null;
    }

    // カスタムワード
    if (CUSTOM_WORDS.exists(normalizedWord)) {
        const {definition} = CUSTOM_WORDS.definitions.get(normalizedWord);
        let outputs = [];
        const words = definition.split(/\s+/);
        
        for (let i = 0; i < words.length; i++) {
            const token = words[i];
            const output = EXECUTE_WORD(token);
            if (output === 'continue') {
                i = -1;
            } else if (output) {
                outputs.push(output);
            }
        }
        
        return outputs.length ? `${normalizedWord}: ${outputs.join(', ')}` : null;
    }

    throw new Error(`Unknown word: ${normalizedWord}`);
};

const HANDLE_STACK_INPUT = event => {
    if (event.key === 'Enter' && event.target.value.trim()) {
        const value = event.target.value.trim();
        const numValue = Number(value);
        PUSH_TO_DATA_STACK(!isNaN(numValue) && typeof numValue !== 'boolean' ? numValue : value);
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
        if (FORTH.dictionary.has(NORMALIZE_WORD(name))) 
            throw new Error("Cannot redefine built-in word");

        await CUSTOM_WORDS.add(name, def, desc);
        ['word_name', 'word_definition', 'word_description']
            .forEach(id => document.getElementById(id).value = '');
        ADD_OUTPUT(`Defined: ${NORMALIZE_WORD(name)}`);
    } catch (error) {
        ADD_OUTPUT(`Error: ${error.message}`);
    }
};

const HANDLE_DELETE_WORD = async event => {
    if (event.key === 'Enter') {
        const name = event.target.value.trim();
        try {
            if (FORTH.dictionary.has(NORMALIZE_WORD(name))) 
                throw new Error("Cannot delete built-in word");
            await CUSTOM_WORDS.remove(name);
            event.target.value = '';
            ADD_OUTPUT(`Deleted: ${NORMALIZE_WORD(name)}`);
        } catch (error) {
            ADD_OUTPUT(`Error: ${error.message}`);
        }
    }
};

const HANDLE_DELETE_DROP = event => {
    event.preventDefault();
    const data = event.dataTransfer.getData('text');
    document.getElementById('delete_word_input').value = data;
};

const ALLOW_DROP = event => {
    event.preventDefault();
};

const DROP_TO_STACK = (event, target) => {
    event.preventDefault();
    const data = event.dataTransfer.getData('text');
    if (target === 'data_stack_input') {
        document.getElementById('data_stack_input').value = data;
    } else if (target === 'data') {
        PUSH_TO_DATA_STACK(isNaN(data) ? data : Number(data));
    }
};

const RUN_ALL_STACKS = () => {
    try {
        const tempStack = [...FORTH.dataStack].reverse();
        FORTH.dataStack = [];
        
        while (tempStack.length > 0) {
            const word = tempStack.pop();
            const output = EXECUTE_WORD(word);
            if (output) ADD_OUTPUT(output);
        }
        
        updateStackDisplay();
        DB.saveStacks();
    } catch (error) {
        ADD_OUTPUT(`Error: ${error.message}`);
        FORTH.dataStack = [];
        FORTH.controlStack = [];
        updateStackDisplay();
        DB.saveStacks();
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
        ['+', '-', '*', '/', 'DUP', 'DROP', 'SWAP', 'OVER', 'ROT', 
         '>R', 'R>', '@', '!', 'IF', 'THEN', 'DO', 'LOOP', 'I',
         'VARIABLE', 'CONSTANT', '=', '<>', '<', '>', '<=', '>='].forEach(word => 
            FORTH.dictionary.set(NORMALIZE_WORD(word), word)
        );
        INIT_UI();
        DEBUG.log('Init', 'Application initialized with IndexedDB');
    } catch (error) {
        DEBUG.log('Error', `IndexedDB initialization failed: ${error.message}`);
        ADD_OUTPUT(`Error: Failed to initialize database`);
    }
};

document.addEventListener('DOMContentLoaded', INIT_APPLICATION);