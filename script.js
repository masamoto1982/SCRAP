// デバッグ用ユーティリティ
const DEBUG = {
    log: function(category, message) {
        console.log(`[${category}]`, message);
    },
    
    stack: function() {
        console.log('=== Stack State ===');
        console.log('Data Stack:', FORTH.dataStack);
        console.log('Return Stack:', FORTH.returnStack);
        console.log('=================');
    }
};

// FORTHシステムの状態
const FORTH = {
    dataStack: [],
    returnStack: [],
    dictionary: new Map(),
    compiling: false,
    currentDefinition: [],
    ip: 0
};

// カスタムワード管理
const CUSTOM_WORDS = {
    definitions: new Map(),

    exists: function(name) {
        return this.definitions.has(name);
    },

    count: function() {
        return this.definitions.size;
    },

    add: function(name, definition, description) {
        DEBUG.log('CustomWord', `Adding custom word: ${name}`);
        this.definitions.set(name, { definition, description });
        this.updateDisplay();
        this.updateDeleteInput();
    },

    remove: function(name) {
        DEBUG.log('CustomWord', `Removing custom word: ${name}`);
        if (!this.exists(name)) {
            throw new Error("Custom word not found");
        }
        this.definitions.delete(name);
        this.updateDisplay();
        this.updateDeleteInput();
    },

    updateDisplay: function() {
    DEBUG.log('CustomWord', 'Updating custom words display');
    const container = document.getElementById('custom_words_container');
    // words_containerクラスを追加
    container.className = 'words_container';
    container.innerHTML = '';

    this.definitions.forEach((data, name) => {
        const button = document.createElement('button');
        button.className = 'word_button';
        button.textContent = name;
        button.title = data.description;
        button.addEventListener('click', () => {
            PUSH_TO_DATA_STACK(name);
        });
        // button_groupでラップ
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button_group';
        buttonGroup.appendChild(button);
        container.appendChild(buttonGroup);
    });
},

    updateDeleteInput: function() {
        DEBUG.log('CustomWord', 'Updating delete input visibility');
        const deleteWordContainer = document.querySelector('.flex_2');
        if (this.count() === 0) {
            deleteWordContainer.classList.add('no_words');
        } else {
            deleteWordContainer.classList.remove('no_words');
        }
    }
};

// IndexedDB設定
const DB_NAME = 'forthDB';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';
// スタック操作の基本実装
function DUP() {
    DEBUG.log('Operation', 'DUP');
    if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
    const n = FORTH.dataStack[FORTH.dataStack.length - 1];
    FORTH.dataStack.push(n);
    DEBUG.stack();
}

function DROP() {
    DEBUG.log('Operation', 'DROP');
    if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
    FORTH.dataStack.pop();
    DEBUG.stack();
}

function SWAP() {
    DEBUG.log('Operation', 'SWAP');
    if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
    const n2 = FORTH.dataStack.pop();
    const n1 = FORTH.dataStack.pop();
    FORTH.dataStack.push(n2);
    FORTH.dataStack.push(n1);
    DEBUG.stack();
}

// ReturnStack操作
function TO_R() {
    DEBUG.log('Operation', '>R');
    if (FORTH.dataStack.length < 1) throw new Error("Stack underflow");
    const n = FORTH.dataStack.pop();
    FORTH.returnStack.push(n);
    DEBUG.stack();
}

function FROM_R() {
    DEBUG.log('Operation', 'R>');
    if (FORTH.returnStack.length < 1) throw new Error("Return stack underflow");
    const n = FORTH.returnStack.pop();
    FORTH.dataStack.push(n);
    DEBUG.stack();
}

function R_FETCH() {
    DEBUG.log('Operation', 'R@');
    if (FORTH.returnStack.length < 1) throw new Error("Return stack underflow");
    const n = FORTH.returnStack[FORTH.returnStack.length - 1];
    FORTH.dataStack.push(n);
    DEBUG.stack();
}

// UI関連の実装
function CREATE_STACK_BUTTON(value) {
    DEBUG.log('UI', `Creating stack button for value: ${value}`);
    const button = document.createElement('button');
    button.className = 'word_button';
    button.textContent = value;
    return button;
}

function UPDATE_DATA_STACK_DISPLAY() {
    DEBUG.log('UI', 'Updating stack display');
    const container = document.getElementById('data_stack_container');
    container.innerHTML = '';
    
    FORTH.dataStack.forEach((value, index) => {
        const button = CREATE_STACK_BUTTON(value);
        if (index === FORTH.dataStack.length - 1) {
            button.classList.add('stack_top');
        }
        container.appendChild(button);
    });
    DEBUG.stack();
}

function ADD_OUTPUT(text) {
    DEBUG.log('Output', `Adding output: ${text}`);
    const outputContent = document.getElementById('output_content');
    
    const outputLine = document.createElement('div');
    outputLine.textContent = text;
    
    if (outputContent.firstChild) {
        outputContent.insertBefore(outputLine, outputContent.firstChild);
    } else {
        outputContent.appendChild(outputLine);
    }
}

function EXECUTE_WORD(word) {
    DEBUG.log('Execute', `Executing word: ${word}`);
    
    switch(word) {
        case '+':
            if (FORTH.dataStack.length < 2) {
                throw new Error("Stack underflow: + requires two numbers");
            }
            const n2 = FORTH.dataStack.pop();
            const n1 = FORTH.dataStack.pop();
            if (typeof n1 !== 'number' || typeof n2 !== 'number') {
                throw new Error("+ requires numeric values");
            }
            const result = n1 + n2;
            FORTH.dataStack.push(result);
            DEBUG.log('Execute', `${n1} + ${n2} = ${result}`);
            return `${n1} + ${n2} = ${result}`;
    }

    if (CUSTOM_WORDS.exists(word)) {
        const customWord = CUSTOM_WORDS.definitions.get(word);
        DEBUG.log('Execute', `Executing custom word: ${word} with definition: ${customWord.definition}`);
        return `Executed custom word: ${word}`;
    }

    throw new Error(`Unknown word: ${word}`);
}

function PUSH_TO_DATA_STACK(value) {
    DEBUG.log('Stack', `Pushing to stack: ${value}`);
    FORTH.dataStack.push(value);
    UPDATE_DATA_STACK_DISPLAY();
}

function HANDLE_STACK_INPUT(event) {
    if (event.key === 'Enter') {
        const input = event.target;
        const value = input.value.trim();
        
        if (value) {
            DEBUG.log('Input', `Processing input: ${value}`);
            const stackValue = isNaN(value) ? value : Number(value);
            PUSH_TO_DATA_STACK(stackValue);
            input.value = '';
        }
        
        event.preventDefault();
    }
}

function HANDLE_WORD_DEFINITION_KEYPRESS(event, currentField) {
    if (event.key === 'Enter') {
        event.preventDefault();
        
        const nameInput = document.getElementById('word_name');
        const defInput = document.getElementById('word_definition');
        const descInput = document.getElementById('word_description');

        switch(currentField) {
            case 'word_name':
                defInput.focus();
                break;
            case 'word_definition':
                descInput.focus();
                break;
            case 'word_description':
                DEFINE_WORD();
                nameInput.focus();
                break;
        }
    }
}

function DEFINE_WORD() {
    const nameInput = document.getElementById('word_name');
    const defInput = document.getElementById('word_definition');
    const descInput = document.getElementById('word_description');

    const name = nameInput.value.trim();
    const definition = defInput.value.trim();
    const description = descInput.value.trim();

    try {
        if (!name || !definition) {
            throw new Error("Name and definition are required");
        }
        if (FORTH.dictionary.has(name)) {
            throw new Error("Cannot redefine built-in word");
        }

        CUSTOM_WORDS.add(name, definition, description);

        nameInput.value = '';
        defInput.value = '';
        descInput.value = '';

        DEBUG.log('CustomWord', `Successfully defined word: ${name}`);
        ADD_OUTPUT(`Defined: ${name}`);

    } catch (error) {
        DEBUG.log('Error', error.message);
        ADD_OUTPUT(`Error: ${error.message}`);
    }
}

function HANDLE_DELETE_WORD(event) {
    if (event.key === 'Enter') {
        const input = event.target;
        const name = input.value.trim();

        try {
            if (FORTH.dictionary.has(name)) {
                throw new Error("Cannot delete built-in word");
            }
            if (!CUSTOM_WORDS.exists(name)) {
                throw new Error("Custom word not found");
            }

            CUSTOM_WORDS.remove(name);
            input.value = '';
            
            DEBUG.log('CustomWord', `Successfully deleted word: ${name}`);
            ADD_OUTPUT(`Deleted: ${name}`);

        } catch (error) {
            DEBUG.log('Error', error.message);
            ADD_OUTPUT(`Error: ${error.message}`);
        }
    }
}

function RUN_ALL_STACKS() {
    DEBUG.log('Run', 'Execute button pressed');
    
    try {
        const word = FORTH.dataStack[FORTH.dataStack.length - 1];
        if (word === '+') {
            const output = EXECUTE_WORD(FORTH.dataStack.pop());
            ADD_OUTPUT(output);
        }
        UPDATE_DATA_STACK_DISPLAY();
        
    } catch (error) {
        DEBUG.log('Error', error.message);
        ADD_OUTPUT(`Error: ${error.message}`);
    }
}

function INIT_UI() {
    DEBUG.log('Init', 'Initializing UI');
    
    const input = document.getElementById('data_stack_input');
    input.addEventListener('keypress', HANDLE_STACK_INPUT);
    
    const wordButtons = document.querySelectorAll('.word_button');
    wordButtons.forEach(button => {
        button.addEventListener('click', () => {
            PUSH_TO_DATA_STACK(button.textContent);
        });
    });

    CUSTOM_WORDS.updateDeleteInput();

    DEBUG.log('Init', 'UI initialization completed');
}

function INIT_APPLICATION() {
    DEBUG.log('Init', 'Starting application initialization');
    INIT_UI();
    DEBUG.log('Init', 'Application initialization completed');
}

document.addEventListener('DOMContentLoaded', INIT_APPLICATION);