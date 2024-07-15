import { CreateWebWorkerMLCEngine } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm"

const $ = el => document.querySelector(el)

const $form = $('form')
const $input = $('input')
const $template = $('#message-template')
const $messages = $('#messages-list')
const $container = $('#chat-container')
const $button = $('form button')
const $info = $('small')
const $loading = $('.loading')
const $newChatBtn = $('#new-chat')
const $chatList = $('#chat-list')
const $chatItems = $('#chat-items')

let messages = []
let end = false
let chatIndex = Date.now().toString()
let chatNames = JSON.parse(localStorage.getItem('chatNames')) || {}

const SELECTED_MODEL = 'gemma-2b-it-q4f32_1-MLC'

async function initializeEngine() {
  try {
    const engine = await CreateWebWorkerMLCEngine(
      new Worker('./worker.js', { type: 'module' }),
      SELECTED_MODEL,
      {
        initProgressCallback: (info) => {
          console.log(`Progress: ${info.progress * 100}% - ${info.text}`)
          $info.textContent = info.text
          if (info.progress === 1 && !end) {
            end = true
            $loading?.parentNode?.removeChild($loading)
            $button.removeAttribute('disabled')
            addMessage("¡Hola! Soy un Botsito que se ejecuta completamente en tu navegador. ¿En qué puedo ayudarte hoy?", 'bot')
            $input.focus()
          }
        }
      }
    )
    return engine
  } catch (error) {
    console.error("Error initializing engine:", error)
    $info.textContent = "Error al inicializar el motor. Verifique la consola para más detalles."
  }
}

const engine = await initializeEngine()

function loadChat(chatId) {
  const savedMessages = JSON.parse(localStorage.getItem(chatId)) || []
  messages = savedMessages
  $messages.innerHTML = ''
  messages.forEach(msg => {
    addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot')
  })
}

function saveChat(chatId) {
  localStorage.setItem(chatId, JSON.stringify(messages))
  updateChatList()
}

function updateChatList() {
  const chatKeys = Object.keys(localStorage).filter(key => key !== 'chatNames')
  $chatList.innerHTML = chatKeys.map(key => `<option value="${key}">${chatNames[key] || 'Chat ' + new Date(parseInt(key)).toLocaleString()}</option>`).join('')
  if (chatKeys.length > 0) {
    $chatList.style.display = 'block'
  } else {
    $chatList.style.display = 'none'
  }
  $chatList.value = chatIndex
  $chatItems.innerHTML = chatKeys.map(key => 
    `<li class="chat-item" data-chat-id="${key}">
      ${chatNames[key] || 'Chat ' + new Date(parseInt(key)).toLocaleString()}
      <div class="chat-options">
        <button onclick="renameChat('${key}')">Renombrar</button>
        <button onclick="deleteChat('${key}')">Eliminar</button>
      </div>
    </li>`
  ).join('')
}

window.renameChat = function (chatId) {
  const newName = prompt("Ingrese el nuevo nombre para el chat:", chatNames[chatId] || "")
  if (newName) {
    chatNames[chatId] = newName
    localStorage.setItem('chatNames', JSON.stringify(chatNames))
    updateChatList()
  }
}

window.deleteChat = function (chatId) {
  if (confirm("¿Estás seguro de que quieres eliminar este chat?")) {
    localStorage.removeItem(chatId)
    delete chatNames[chatId]
    localStorage.setItem('chatNames', JSON.stringify(chatNames))
    messages = []
    $messages.innerHTML = ''
    updateChatList()
    const chatKeys = Object.keys(localStorage).filter(key => key !== 'chatNames')
    if (chatKeys.length > 0) {
      chatIndex = chatKeys[0]
      loadChat(chatIndex)
    } else {
      chatIndex = Date.now().toString()
      addMessage("No hay chats disponibles. Este es un nuevo chat.", 'bot')
    }
    $input.focus()
  }
}

$chatList.addEventListener('change', (event) => {
  chatIndex = event.target.value
  loadChat(chatIndex)
})

$form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const messageText = $input.value.trim()

  if (messageText !== '') {
    $input.value = ''
  }

  addMessage(messageText, 'user')
  $button.setAttribute('disabled', '')

  const userMessage = {
    role: 'user',
    content: messageText
  }

  messages.push(userMessage)
  saveChat(chatIndex)

  const chunks = await engine.chat.completions.create({
    messages,
    stream: true
  })

  let reply = ""

  const $botMessage = addMessage("", 'bot')

  for await (const chunk of chunks) {
    const choice = chunk.choices[0]
    const content = choice?.delta?.content ?? ""
    reply += content
    $botMessage.textContent = reply
  }

  $button.removeAttribute('disabled')
  messages.push({
    role: 'assistant',
    content: reply
  })
  saveChat(chatIndex)
  $container.scrollTop = $container.scrollHeight
})

$newChatBtn.addEventListener('click', () => {
  chatIndex = Date.now().toString()
  messages = []
  $messages.innerHTML = ''
  addMessage("¡Hola! Este es un nuevo chat. ¿En qué puedo ayudarte?", 'bot')
  $input.focus()
  saveChat(chatIndex)
})

function addMessage(text, sender) {
  const clonedTemplate = $template.content.cloneNode(true)
  const $newMessage = clonedTemplate.querySelector('.message')

  const $who = $newMessage.querySelector('span')
  const $text = $newMessage.querySelector('p')

  $text.textContent = text
  $who.textContent = sender === 'bot' ? 'IA' : 'Tú'
  $newMessage.classList.add(sender)

  $messages.appendChild($newMessage)

  $container.scrollTop = $container.scrollHeight

  return $text
}

// Initialize the chat list on load
updateChatList()
loadChat(chatIndex)







