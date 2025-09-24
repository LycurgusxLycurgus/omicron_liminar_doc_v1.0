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
const mobileSelectionHint = document.getElementById('mobile-selection-hint');
// Cajón de Chat
const drawer = document.getElementById('chat-drawer');
const drawerCloseButton = document.getElementById('drawer-close');
const chatHistoryContainer = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
// Elementos del Wizard y Tema
const themeToggle = document.getElementById('theme-toggle');
const wizard = document.getElementById('wizard');
const wizardCloseButton = document.getElementById('wizard-close');
const wizardTitle = document.getElementById('wizard-title');
const wizardSubtitle = document.getElementById('wizard-subtitle');
const wizardInstructions = document.getElementById('wizard-instructions');
const wizardDontShow = document.getElementById('wizard-dont-show');

let currentSelectedText = '';
let chat;
let systemPrompt = '';

const MOBILE_MIN_SELECTION_LENGTH = 6;
const MOBILE_SELECTION_PROMPT = 'Selecciona el fragmento que quieres conversar y toca Conversar para confirmar.';
const MOBILE_SELECTION_READY = 'Toca Conversar para confirmar la selección.';
let isMobileSelectionModeActive = false;
let mobileHintTimeout = null;

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
    const shouldHideWizard = localStorage.getItem('hideWizard') === 'true';
    if (!shouldHideWizard) {
        openWizard();
    }
    if (wizardCloseButton) {
        wizardCloseButton.addEventListener('click', () => {
            closeWizard();
        });
    }
    if (wizard) {
        wizard.addEventListener('click', (event) => {
            if (event.target === wizard) {
                closeWizard();
            }
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && wizard && wizard.style.display === 'flex') {
            closeWizard();
        }
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

function isMobileViewport() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function openWizard() {
    if (!wizard) return;
    updateWizardContent();
    if (wizardDontShow) {
        wizardDontShow.checked = false;
    }
    wizard.style.display = 'flex';
    wizard.setAttribute('aria-hidden', 'false');
    if (wizardCloseButton) {
        wizardCloseButton.focus();
    }
}

function closeWizard() {
    if (!wizard) return;
    wizard.style.display = 'none';
    wizard.setAttribute('aria-hidden', 'true');
    if (wizardDontShow && wizardDontShow.checked) {
        localStorage.setItem('hideWizard', 'true');
    }
}

function updateWizardContent() {
    if (!wizardTitle || !wizardSubtitle || !wizardInstructions) return;
    const mobile = isMobileViewport();
    const title = mobile ? 'Conversar desde tu dispositivo móvil' : 'Conversar desde tu ordenador';
    const subtitle = mobile
        ? 'Sigue estos pasos rápidos para seleccionar un fragmento y abrir el chat.'
        : 'Descubre cómo iniciar una conversación contextual en tres pasos.';
    const steps = mobile
        ? [
            'Pulsa el botón «Conversar» en la esquina superior izquierda para activar el modo de selección.',
            'Selecciona un fragmento de al menos unas pocas palabras del documento.',
            'Pulsa de nuevo «Conversar» para confirmar y abrir el chat contextual.',
            'Escribe tus preguntas en la parte inferior del cajón y envíalas.'
        ]
        : [
            'Selecciona un fragmento relevante del documento (unas pocas palabras o más).',
            'Cuando aparezca el botón flotante «Conversar», haz clic en él para abrir el chat.',
            'Formula tus preguntas en el campo de texto del cajón y envíalas.'
        ];

    wizardTitle.textContent = title;
    wizardSubtitle.textContent = subtitle;
    wizardInstructions.innerHTML = '';
    steps.forEach((step) => {
        const li = document.createElement('li');
        li.textContent = step;
        wizardInstructions.appendChild(li);
    });
}

function showMobileSelectionHint(message, persistent = false) {
    if (!mobileSelectionHint) return;
    mobileSelectionHint.textContent = message;
    mobileSelectionHint.classList.add('visible');
    if (mobileHintTimeout) {
        clearTimeout(mobileHintTimeout);
        mobileHintTimeout = null;
    }
    if (!persistent) {
        mobileHintTimeout = setTimeout(() => {
            mobileSelectionHint.classList.remove('visible');
            mobileHintTimeout = null;
        }, 3500);
    }
}

function hideMobileSelectionHint() {
    if (!mobileSelectionHint) return;
    mobileSelectionHint.classList.remove('visible');
    if (mobileHintTimeout) {
        clearTimeout(mobileHintTimeout);
        mobileHintTimeout = null;
    }
}

function enterMobileSelectionMode() {
    if (!mobileChatTrigger) return;
    isMobileSelectionModeActive = true;
    currentSelectedText = '';
    mobileChatTrigger.classList.add('selection-mode');
    mobileChatTrigger.classList.remove('ready');
    mobileChatTrigger.setAttribute('aria-expanded', 'true');
    const selection = window.getSelection();
    if (selection && typeof selection.removeAllRanges === 'function') {
        selection.removeAllRanges();
    }
    showMobileSelectionHint(MOBILE_SELECTION_PROMPT, true);
}

function exitMobileSelectionMode({ clearSelection = true, keepText = false } = {}) {
    if (!mobileChatTrigger) return;
    isMobileSelectionModeActive = false;
    mobileChatTrigger.classList.remove('selection-mode', 'ready');
    mobileChatTrigger.setAttribute('aria-expanded', 'false');
    hideMobileSelectionHint();
    if (!keepText) {
        currentSelectedText = '';
    }
    if (clearSelection) {
        const selection = window.getSelection();
        if (selection && typeof selection.removeAllRanges === 'function') {
            selection.removeAllRanges();
        }
    }
}

function handleMobileSelectionUpdate(selectedText) {
    if (!mobileChatTrigger || !isMobileSelectionModeActive) return;
    if (selectedText.length >= MOBILE_MIN_SELECTION_LENGTH) {
        currentSelectedText = selectedText;
        mobileChatTrigger.classList.add('ready');
        showMobileSelectionHint(MOBILE_SELECTION_READY, true);
    } else {
        mobileChatTrigger.classList.remove('ready');
        if (selectedText.length === 0) {
            showMobileSelectionHint(MOBILE_SELECTION_PROMPT, true);
        }
    }
}

// MODIFICADO: Se añade 'touchend' para mejor respuesta en móviles
['mouseup', 'touchend'].forEach(evt => {
    document.addEventListener(evt, (event) => {
        if ((drawer && drawer.contains(event.target)) || (wizard && wizard.contains(event.target))) return;

        const selection = window.getSelection();
        const selectedText = selection ? selection.toString().trim() : '';

        if (isMobileViewport()) {
            if (!isMobileSelectionModeActive) return;
            handleMobileSelectionUpdate(selectedText);
            return;
        }

        if (selectedText.length >= MOBILE_MIN_SELECTION_LENGTH) {
            if (selection && selection.rangeCount > 0) {
                currentSelectedText = selectedText;
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                highlighterButton.style.display = 'block';
                highlighterButton.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (highlighterButton.offsetWidth / 2)}px`;
                highlighterButton.style.top = `${rect.top + window.scrollY - highlighterButton.offsetHeight - 5}px`;
            }
        } else {
            highlighterButton.style.display = 'none';
            currentSelectedText = '';
        }
    });
});

document.addEventListener('selectionchange', () => {
    if (!isMobileViewport() || !isMobileSelectionModeActive) return;
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    handleMobileSelectionUpdate(selectedText);
});

window.addEventListener('resize', () => {
    if (!isMobileViewport() && isMobileSelectionModeActive) {
        exitMobileSelectionMode({ clearSelection: false });
    }
    if (wizard && wizard.style.display === 'flex') {
        updateWizardContent();
    }
});

// Refactorizado para evitar duplicar código
function openChatDrawer() {
    if (!currentSelectedText) {
        alert('Selecciona un fragmento de texto antes de conversar.');
        return;
    }
    exitMobileSelectionMode({ clearSelection: true, keepText: true });
    if (!genAI) {
        alert("La funcionalidad de IA no está disponible. Por favor, configura una clave de API en el archivo main.js.");
        return;
    }
    chatHistoryContainer.innerHTML = '';
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    highlighterButton.style.display = 'none';
    startChatSession();
    if (drawerCloseButton) {
        drawerCloseButton.focus();
    }
}

highlighterButton.addEventListener('click', openChatDrawer);
mobileChatTrigger.addEventListener('click', () => {
    if (!isMobileViewport()) return;
    if (!isMobileSelectionModeActive) {
        enterMobileSelectionMode();
        return;
    }
    if (currentSelectedText && currentSelectedText.length >= MOBILE_MIN_SELECTION_LENGTH) {
        openChatDrawer();
    } else {
        showMobileSelectionHint('Selecciona un fragmento más extenso antes de confirmar.', true);
    }
});

function closeDrawer() {
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    chat = null;
    highlighterButton.style.display = 'none';
    exitMobileSelectionMode({ clearSelection: true });
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
    const firstMessage = `Trabajaremos con este fragmento: "${currentSelectedText}". ¿Qué te gustaría explorar o preguntar sobre esta idea?`;

    chat = model.startChat({
        history: [
            { role: "user", parts: [{ text: systemInstruction }] },
            { role: "model", parts: [{ text: firstMessage }] }
        ]
    });

    addMessageToHistory(firstMessage, 'model');
}
