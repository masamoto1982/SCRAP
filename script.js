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

// IndexedDB設定
const DB_NAME = 'forthDB';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';

// =====================================
// スタック操作の基本実装
// =====================================

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

// 算術演算
function ADD() {
    DEBUG.log('Operation', '+');
    if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
    const n2 = FORTH.dataStack.pop();
    const n1 = FORTH.dataStack.pop();
    FORTH.dataStack.push(n1 + n2);
    DEBUG.stack();
}

function SUBTRACT() {
    DEBUG.log('Operation', '-');
    if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
    const n2 = FORTH.dataStack.pop();
    const n1 = FORTH.dataStack.pop();
    FORTH.dataStack.push(n1 - n2);
    DEBUG.stack();
}

// 比較演算
function EQUALS() {
    DEBUG.log('Operation', '=');
    if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
    const n2 = FORTH.dataStack.pop();
    const n1 = FORTH.dataStack.pop();
    FORTH.dataStack.push(n1 === n2 ? -1 : 0);
    DEBUG.stack();
}

function LESS_THAN() {
    DEBUG.log('Operation', '<');
    if (FORTH.dataStack.length < 2) throw new Error("Stack underflow");
    const n2 = FORTH.dataStack.pop();
    const n1 = FORTH.dataStack.pop();
    FORTH.dataStack.push(n1 < n2 ? -1 : 0);
    DEBUG.stack();
}

// =====================================
// 制御構造の実装
// =====================================

function IF() {
    DEBUG.log('Control', 'IF');
    if (!FORTH.compiling) throw new Error("IF only valid in compilation");
    FORTH.currentDefinition.push(IF);
    FORTH.currentDefinition.push(null);  // 分岐先アドレスのプレースホルダ
}

function THEN() {
    DEBUG.log('Control', 'THEN');
    if (!FORTH.compiling) throw new Error("THEN only valid in compilation");
    const ifPos = FORTH.currentDefinition.indexOf(null);
    if (ifPos === -1) throw new Error("Mismatched THEN");
    FORTH.currentDefinition[ifPos] = FORTH.currentDefinition.length;
}

function DO() {
    DEBUG.log('Control', 'DO');
    if (!FORTH.compiling) throw new Error("DO only valid in compilation");
    FORTH.currentDefinition.push(DO);
    FORTH.currentDefinition.push(FORTH.currentDefinition.length);
}

function LOOP() {
    DEBUG.log('Control', 'LOOP');
    if (!FORTH.compiling) throw new Error("LOOP only valid in compilation");
    FORTH.currentDefinition.push(LOOP);
    const doPos = FORTH.currentDefinition.indexOf(DO);
    if (doPos === -1) throw new Error("Mismatched LOOP");
    FORTH.currentDefinition.push(doPos + 1);
}

// ワードの実行処理
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
        default:
            throw new Error(`Unknown word: ${word}`);
    }
}

// 出力を追加する関数
function ADD_OUTPUT(text) {
    DEBUG.log('Output', `Adding output: ${text}`);
    const outputContent = document.getElementById('output_content');
    
    // 新しい出力用のdiv要素を作成
    const outputLine = document.createElement('div');
    outputLine.textContent = text;
    
    // 最新の出力を先頭に追加
    if (outputContent.firstChild) {
        outputContent.insertBefore(outputLine, outputContent.firstChild);
    } else {
        outputContent.appendChild(outputLine);
    }
}

// Runボタンのハンドラを修正
function RUN_ALL_STACKS() {
    DEBUG.log('Run', 'Execute button pressed');
    
    try {
        // スタック上の最後のワードを実行
        const word = FORTH.dataStack[FORTH.dataStack.length - 1];
        if (word === '+') {
            const output = EXECUTE_WORD(FORTH.dataStack.pop());
            // 結果を出力履歴に追加
            ADD_OUTPUT(output);
        }
        // スタックの表示を更新
        UPDATE_DATA_STACK_DISPLAY();
        
    } catch (error) {
        DEBUG.log('Error', error.message);
        ADD_OUTPUT(`Error: ${error.message}`);
    }
}

// =====================================
// IndexedDB関連の実装
// =====================================

async function initDB() {
    DEBUG.log('DB', 'Initializing IndexedDB');
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            DEBUG.log('DB', 'Error initializing DB');
            reject(request.error);
        };
        
        request.onsuccess = () => {
            DEBUG.log('DB', 'Successfully initialized DB');
            const db = request.result;
            loadDictionary(db).then(resolve);
        };

        request.onupgradeneeded = (event) => {
            DEBUG.log('DB', 'Upgrading DB');
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
        };
    });
}

// =====================================
// UI関連の実装
// =====================================

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
            button.classList.add('stack_top');  // スタックトップにクラスを追加
        }
        container.appendChild(button);  // 単純に追加（左から右へ）
    });
    
    DEBUG.stack();
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

// =====================================
// 初期化と起動
// =====================================

function INIT_UI() {
    DEBUG.log('Init', 'Initializing UI');
    
    // DataStack入力欄のイベントリスナー設定
    const input = document.getElementById('data_stack_input');
    input.addEventListener('keypress', HANDLE_STACK_INPUT);
    
    // 組み込みワードボタンのイベントリスナー設定
    const wordButtons = document.querySelectorAll('.word_button');
    wordButtons.forEach(button => {
        button.addEventListener('click', () => {
            PUSH_TO_DATA_STACK(button.textContent);
        });
    });

    DEBUG.log('Init', 'UI initialization completed');
}

async function INIT_APPLICATION() {
    DEBUG.log('Init', 'Starting application initialization');
    
    try {
        await initDB();
        INIT_UI();
        DEBUG.log('Init', 'Application initialization completed');
    } catch (error) {
        DEBUG.log('Error', `Initialization failed: ${error.message}`);
        console.error(error);
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', INIT_APPLICATION);