import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// --- CONFIGURACIÓN ---
const API_KEY = "AIzaSyDY6kyelIz1MX8W8xChiGKK89Yqh0cwWfM";
const MODEL_NAME = "models/gemini-2.5-flash-lite";

// --- INICIALIZACIÓN DE LA API ---
let genAI;
let model;
if (API_KEY && API_KEY !== "AQUI_VA_TU_NUEVA_API_KEY") {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: MODEL_NAME });
} else {
    console.warn("API Key no encontrada. La funcionalidad de IA está deshabilitada.");
}

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const contentContainer = document.getElementById('content-container');
const highlighterButton = document.getElementById('highlighter-button');
const mobileChatTrigger = document.getElementById('mobile-chat-trigger');
// Cajón de Chat
const drawer = document.getElementById('chat-drawer');
const drawerCloseButton = document.getElementById('drawer-close');
const selectedTextContainer = document.getElementById('selected-text-container');
const chatHistoryContainer = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
// Elementos del Wizard y Tema
const themeToggle = document.getElementById('theme-toggle');
const wizard = document.getElementById('wizard');
const wizardCloseButton = document.getElementById('wizard-close');

let currentSelectedText = '';
let chat;
let systemPrompt = '';

// --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Lógica del Tema
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    themeToggle.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // Lógica del Wizard
    if (!localStorage.getItem('hasSeenWizard')) {
        wizard.style.display = 'flex';
    }
    wizardCloseButton.addEventListener('click', () => {
        wizard.style.display = 'none';

        localStorage.setItem('hasSeenWizard', 'true');
    });

    // Carga de las instrucciones del sistema
    fetch('system_prompt.json')
        .then(res => res.json())
        .then(data => { systemPrompt = data.systemInstruction || ''; })
        .catch(err => console.warn('No se pudo cargar system_prompt.json:', err));

    // Carga del contenido
    fetch('content.json')
        .then(response => {
            if (!response.ok) throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
            return response.json();
        })
        .then(data => buildPage(data))
        .catch(error => {
            console.error('Error fatal al cargar el contenido:', error);
            contentContainer.innerHTML = `<h1>Error al Cargar</h1><p>No se pudo cargar <strong>content.json</strong>.</p><p>Asegúrate de que el archivo existe en la misma carpeta que index.html.</p><p><em>Detalles: ${error.message}</em></p>`;
        });
});

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = 'Modo Claro';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.textContent = 'Modo Oscuro';
    }
}

function buildPage(data) {
    // ... (Esta función no cambia)
    const fragment = document.createDocumentFragment();
    const h1 = document.createElement('h1');
    h1.textContent = data.title;
    fragment.appendChild(h1);
    const h2 = document.createElement('h2');
    h2.textContent = data.subtitle;
    fragment.appendChild(h2);
    data.sections.forEach(section => {
        const sectionTitle = document.createElement('h2');
        sectionTitle.id = section.id;
        sectionTitle.textContent = section.title;
        fragment.appendChild(sectionTitle);
        if (section.content) section.content.forEach(item => fragment.appendChild(createElement(item)));
        if (section.subsections) {
            section.subsections.forEach(subsection => {
                const subsectionTitle = document.createElement('h3');
                subsectionTitle.textContent = subsection.title;
                fragment.appendChild(subsectionTitle);
                subsection.content.forEach(item => fragment.appendChild(createElement(item)));
            });
        }
    });
    contentContainer.appendChild(fragment);
}

function createElement(item) {
    // ... (Esta función no cambia)
    let el;
    switch (item.type) {
        case 'p': el = document.createElement('p'); el.textContent = item.text; break;
        case 'h4': el = document.createElement('h4'); el.textContent = item.text; break;
        case 'list':
            el = document.createElement('ul');
            item.items.forEach(liText => {
                const li = document.createElement('li');
                li.textContent = liText;
                el.appendChild(li);
            });
            break;
        case 'blockquote': el = document.createElement('blockquote'); el.textContent = item.text; break;
        default: el = document.createElement('p'); el.textContent = item.text || '';
    }
    return el;
}

// MODIFICADO: Se añade 'touchend' para mejor respuesta en móviles
['mouseup', 'touchend'].forEach(evt => {
    document.addEventListener(evt, (event) => {
        if (drawer.contains(event.target) || wizard.contains(event.target)) return;
        
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length > 5) {
            currentSelectedText = selectedText;
            // Lógica para el botón de escritorio
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            highlighterButton.style.display = 'block';
            highlighterButton.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (highlighterButton.offsetWidth / 2)}px`;
            highlighterButton.style.top = `${rect.top + window.scrollY - highlighterButton.offsetHeight - 5}px`;
            // Lógica para el botón móvil
            mobileChatTrigger.classList.add('active');
        } else {
            highlighterButton.style.display = 'none';
            mobileChatTrigger.classList.remove('active');
        }
    });
});

// Refactorizado para evitar duplicar código
function openChatDrawer() {
    if (!genAI) {
        alert("La funcionalidad de IA no está disponible. Por favor, configura una clave de API en el archivo main.js.");
        return;
    }
    selectedTextContainer.textContent = `"${currentSelectedText}"`;
    chatHistoryContainer.innerHTML = '';
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    highlighterButton.style.display = 'none';
    mobileChatTrigger.classList.remove('active'); // Desactivar al abrir
    startChatSession();
    drawerCloseButton.focus();
}

highlighterButton.addEventListener('click', openChatDrawer);
mobileChatTrigger.addEventListener('click', () => {
    if (mobileChatTrigger.classList.contains('active')) {
        openChatDrawer();
    }
});

function closeDrawer() {
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    chat = null;
}
drawerCloseButton.addEventListener('click', closeDrawer);
drawer.addEventListener('click', (event) => {
    if (event.target === drawer) closeDrawer();
});

chatForm.addEventListener('submit', async (event) => {
    // ... (Esta función no cambia)
    event.preventDefault();
    const userQuery = chatInput.value.trim();
    if (!userQuery || !chat) return;

    addMessageToHistory(userQuery, 'user');
    chatInput.value = '';
    chatInput.disabled = true;

    try {
        const stream = await chat.sendMessageStream(userQuery);
        let modelResponse = "";
        const modelMessageElement = addMessageToHistory("", 'model');
        for await (const chunk of stream.stream) {
            const chunkText = chunk.text();
            modelResponse += chunkText;
            if (window.marked) {
                modelMessageElement.innerHTML = marked.parse(modelResponse);
            } else {
                modelMessageElement.textContent = modelResponse;
            }
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        }
    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        addMessageToHistory("Lo siento, ocurrió un error al procesar tu pregunta.", 'model');
    } finally {
        chatInput.disabled = false;
        chatInput.focus();
    }
});

function addMessageToHistory(text, role) {
    const el = document.createElement('div');
    el.className = role === 'user' ? 'user-message' : 'model-message';
    if (role === 'model' && window.marked) {
        el.innerHTML = marked.parse(text);
    } else {
        el.textContent = text;
    }
    chatHistoryContainer.appendChild(el);
    chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
    return el;
}

function startChatSession() {
    const instructionTemplate = systemPrompt || `Eres un asistente experto en Arqueidentidad: Omicron. El usuario ha seleccionado el siguiente fragmento: "{{fragment}}". Inicia la conversación preguntando qué desea explorar.`;
    const systemInstruction = instructionTemplate.replace('{{fragment}}', currentSelectedText);
    const firstMessage = `Has seleccionado el fragmento: "${currentSelectedText}". ¿Qué te gustaría explorar o preguntar sobre esta idea?`;

    chat = model.startChat({
        history: [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: firstMessage }] }
        ]
    });

    addMessageToHistory(firstMessage, 'model');
}
