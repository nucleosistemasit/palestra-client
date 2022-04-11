var buildUrl = "Build";
var loaderUrl = buildUrl + "/PALESTRA_METAVERSOCAXIAS_DEV.loader.js";
var config = {
dataUrl: buildUrl + "/PALESTRA_METAVERSOCAXIAS_DEV.data",
frameworkUrl: buildUrl + "/PALESTRA_METAVERSOCAXIAS_DEV.framework.js",
codeUrl: buildUrl + "/PALESTRA_METAVERSOCAXIAS_DEV.wasm",
streamingAssetsUrl: "StreamingAssets",
companyName: "Núcleo",
productName: "Metaverso Caxias",
productVersion: "0.1",
};

var container = document.querySelector("#unity-container");
var canvas = document.querySelector("#unity-canvas");
var loadingBar = document.querySelector("#unity-loading-bar");
var progressBarFull = document.querySelector("#unity-progress-bar-full");
var fullscreenButton = document.querySelector("#unity-fullscreen-button");
var mobileWarning = document.querySelector("#unity-mobile-warning");

// By default Unity keeps WebGL canvas render target size matched with
// the DOM size of the canvas element (scaled by window.devicePixelRatio)
// Set this to false if you want to decouple this synchronization from
// happening inside the engine, and you would instead like to size up
// the canvas DOM size and WebGL render target sizes yourself.
// config.matchWebGLToCanvasSize = false;

if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
    container.className = "unity-mobile";
    // Avoid draining fillrate performance on mobile devices,
    // and default/override low DPI mode on mobile browsers.
    config.devicePixelRatio = 1;
    mobileWarning.style.display = "block";
    setTimeout(() => {
        mobileWarning.style.display = "none";
    }, 5000);
} else {
    // canvas.style.width = "960px";
    // canvas.style.height = "600px";
}
loadingBar.style.display = "block";

var gameInstance = null;
var script = document.createElement("script");
var slideIndex = 0;
const socket = io.connect('https://metaversoaudio.youbot.us:443');
var producer = null;
var rc = null;
var current_page = 1;
var chatSocket = null;
script.src = loaderUrl;
script.onload = () => {
    createUnityInstance(canvas, config, (progress) => {
        progressBarFull.style.width = 100 * progress + "%";
    }).then((unityInstance) => {
        gameInstance = unityInstance;
        loadingBar.style.display = "none";
        peerNameCheck();
        document.getElementById("local-peer-name").addEventListener("keyup", peerNameCheck);
    //           fullscreenButton.onclick = () => {
    //             unityInstance.SetFullscreen(1);
    //           };
    }).catch((message) => {
        alert(message);
    });
};

socket.request = function request(type, data = {}) {
    return new Promise((resolve, reject) => {
        socket.emit(type, data, (data) => {
        if (data.error) {
            reject(data.error)
        } else {
            resolve(data)
        }
        })
    })
}

var entityMap = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#x60;'
};
function escapeHtml(string) {
    return String(string).replace(/[<>"'`]/g, function(s) {
        return entityMap[s];
    });
}

document.body.appendChild(script);        
var peer = null;
var conn = null;
var reconnectionInterval = null;
var destinationId = null;
var peerName = null;

document.getElementById("connect-peer").addEventListener("click", startaudio);

function peerNameCheck() {
    if (document.getElementById("local-peer-name").value.trim() === "") {
        document.getElementById("connect-peer").disabled = true;
    }
    else {
        document.getElementById("connect-peer").disabled = false;
    }
}

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * 
            charactersLength));
    }
    return result;
}

function sendReply(element) {
    let reply_preview = document.getElementById("replyPreview");
    let reply_chat = document.getElementById("replyChat");
    let reply_s_chat = document.getElementById("sReplyChat");

    let id = element.closest('.msg-container').dataset.id;
    let content = element.closest('.p-messaged-chat').querySelector('.msg-content').textContent;
    let name = element.closest('.p-messaged-chat').querySelector('.s-messaged-chat').textContent;

    reply_preview.classList.remove("reply-off");
    reply_chat.innerHTML = content;
    reply_s_chat.innerHTML = name;
    reply_preview.dataset.id = id;
}

function closeReply() {
    document.getElementById("replyPreview").dataset.id = "";
    document.getElementById("replyPreview").classList.add("reply-off");
}


function loadNextPage(event) {
    let chatContainer = document.getElementById("chat");
    if (event.target.scrollTop == 0) {
        chatContainer.removeEventListener("scroll", loadNextPage);
        chatSocket.send(JSON.stringify({"command": "next_page", page_number: current_page}));
    }
}

function setInfiniteScroll() {
    let chatContainer = document.getElementById("chat");
    chatContainer.removeEventListener("scroll", loadNextPage);
    chatContainer.addEventListener("scroll", loadNextPage);
}

function toggleReaction(element) {
    let reaction_type = element.dataset.reaction;
    let id = element.closest('.msg-container').dataset.id;
    if (element.classList.contains('sent')) {
        chatSocket.send(JSON.stringify({"command": "react_remove", "message": id, "reaction_type": parseInt(reaction_type)}));
    }
    else {
        chatSocket.send(JSON.stringify({"command": "react_add", "message": id, "reaction_type": parseInt(reaction_type)}));
    }
}

let clientToken = localStorage.getItem('clientToken');
if (clientToken == null) {
    let newToken = makeid(1000);
    localStorage.setItem('clientToken', newToken);
    clientToken = newToken;
}

chatSocket = new ReconnectingWebSocket('wss://metaversochat.youbot.us/ws/chat/talk/?clientToken=' + clientToken);
// chatSocket = new ReconnectingWebSocket('ws://127.0.0.1:8000/ws/chat/talk/?clientToken=' + clientToken);

chatSocket.onopen = function(e) {
    document.getElementById("chat").removeEventListener("scroll", loadNextPage);
    current_page = 1;
    document.getElementById("chat").innerHTML = "";
};

function printMessage (data, messageBlock, scrollToBottom) {
    if (data.content != null && data.content.trim() !== '') {
        let peerNode = document.createElement('div');
        let messageReply = '';
        if (data.reply_to != null) {
            messageReply = '<span class="reply-chat">' +
                                    '<strong class="s-reply-preview">' + 
                                        data.reply_to.username +
                                    '</strong>' +
                                    data.reply_to.content +
                                '</span>';
        }
        peerNode.dataset.id = data.id;
        if (data.is_admin) {
            peerNode.classList.add('mod-msg')
        }
        peerNode.classList.add('msg-container');
        let messageMenu = '<span id="messageMenu" class="msg-menu">' +
                                '<span id="replyMenu-' + data.id + '" class="menu-reply" onclick="sendReply(this)"><i class="fa-solid fa-reply"></i></span>' +      
                                '<span id="reactionMenu-' + data.id + '" class="menu-reactions">' +
                                '<span class="reaction" data-reaction="1" onclick="toggleReaction(this)">👍</span>' +
                                '<span class="reaction" data-reaction="2" onclick="toggleReaction(this)">👏</span>' +
                                '<span class="reaction" data-reaction="3" onclick="toggleReaction(this)">❤</span>' +
                                '<span class="reaction" data-reaction="4" onclick="toggleReaction(this)">🙌</span>' +
                                '<span class="reaction" data-reaction="5" onclick="toggleReaction(this)">😮</span>' +
                                '<span class="reaction" data-reaction="6" onclick="toggleReaction(this)">🤣</span>' +
                                '</span>' +
                            '</span>';

        let reactionNode = '';        
        let reaction_types = ['1', '2', '3', '4', '5', '6'];
        let reaction_emojis = ['👍', '👏', '❤', '🙌', '😮', '🤣'];

        for (let reaction_type of reaction_types) {
            let reaction_visible = "";
            let reaction_sent = "";
            let reaction_quantity = 0;
            if (data["reaction_" + reaction_type] != null) {
                reaction_quantity = data["reaction_" + reaction_type];
                reaction_visible = data["reaction_" + reaction_type] > 0 ? "visible" : "";
            }
            if (data.sent_reactions != null) {
                reaction_sent = data.sent_reactions.includes(parseInt(reaction_type)) ? "sent" : "";
            }
            reactionNode += '<span class="reaction ' + reaction_sent + ' ' + reaction_visible + '" data-reaction="' + reaction_type + '" onclick="toggleReaction(this)">' + reaction_emojis[parseInt(reaction_type) - 1] + '<span class="react-quantity">' + reaction_quantity + '</span></span>';
        }
        
        peerNode.innerHTML = '<p class="p-messaged-chat"><strong class="s-messaged-chat">' + 
                                escapeHtml(data.username) + 
                                '</strong> ' + 
                                messageReply +
                                '<span class="msg-content">' + linkifyHtml(escapeHtml(data.content), {target: '_blank'}) + '</span>' +
                                '<span class="msg-reactions">' +
                                reactionNode +                                        
                                '</span>' +
                                '<span class="msg-timestamp">' +
                                data.created_at.split(" ")[1] +
                                '</span>' +
                                messageMenu +
                                '</p>' +
                              '</span>';
        let isOnBottom = Math.abs(document.getElementById('chat').scrollHeight - document.getElementById('chat').scrollTop - document.getElementById('chat').clientHeight) < 10;
        messageBlock.appendChild(peerNode);
        if (scrollToBottom) {
            if (data.from_me || isOnBottom) {
                document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
            }
        }
        else {
            let messageBlockHeight = messageBlock.clientHeight;
            document.getElementById('chat').scrollTop = messageBlockHeight;
        }
    }
}

chatSocket.onmessage = function(e) {
    const data = JSON.parse(e.data);
    console.log('data', data);
    // Participante recebe pacote
    if (data.type == 'chat_start') {
        if (data.username != null) {
            document.getElementById("local-peer-name").value = data.username;
            startaudio();
        }
        if (data.profile_picture != null) {
            document.getElementById("host-picture").style.backgroundImage = "url(" + data.profile_picture + ")";
        }
    }
    else if (data.type == 'chat_message') {
        let messageBlock = document.getElementById('chat');
        printMessage(data, messageBlock, true);
    }
    else if (data.type == 'chat_history'){
        let messageBlock = document.createElement('div');
        messageBlock.classList.add("message-block");
        document.getElementById('chat').prepend(messageBlock);
        for (message of data.messages) {
            printMessage(message, messageBlock, false);
        }
        current_page++;
        if (data.has_next_page) {
            setInfiniteScroll();
        }
    }
    else if (data.type == 'chat_reaction') {
        let messageElement = document.querySelector('.msg-container[data-id="' + data.message + '"]');
        if (messageElement != null) {
            let reactionElement = messageElement.querySelector('.reaction[data-reaction="' + data.reaction_type + '"]');
            let reactionQuantity = reactionElement.querySelector('.react-quantity');
            reactionQuantity.textContent = data.quantity;
            if (data.name == 'react_add') {
                reactionElement.style.display = 'inline-block';
                if (data.from_me) {
                    reactionElement.classList.add('sent');
                }
            }
            else if (data.name == 'react_remove') {
                if (data.quantity == 0) {
                    reactionElement.style.display = 'none';
                }
                else {
                    if (data.from_me) {
                        reactionElement.classList.remove('sent');
                    }
                }
            }
        }
    }
    else if (data.type == 'chat_control') {
        if (data.name != null && data.name == 'slideChange') {
            gameInstance.SendMessage('ScriptHandler', 'SlideChange', data.content);
        }
        else if (data.name != null && data.name == 'changeHost') {
            gameInstance.SendMessage('ScriptHandler', 'WhichPalestranteWillTalk', data.content);
        }
        else if (data.name != null && data.name == 'slideSet') {
            gameInstance.SendMessage('ScriptHandler', 'SlideSet', data.content);
        }
        else if (data.name != null && data.name == 'toggleMic') {
            if (data.content) {

            }
            else {

            }
        }
    }
    else if (data.type == 'chat_start') {
        if (data.username != null) {
            document.getElementById("host-name").textContent = data.username;
        }
        if (data.profile_picture != null) {
            document.getElementById("profile-picture").style.backgroundImage = "url(" + data.profile_picture + ")";
        }
        else {
            document.getElementById("profile-picture").style.backgroundImage = "url(css/imgs/default_pic.jpg)";
        }
    }};

chatSocket.onclose = function(e) {
    chatSocket.send(JSON.stringify({type: 'disconnection', name: document.getElementById('local-peer-name').value}))
};

function startaudio() {
    document.getElementById("connect-peer").disabled = true;
    document.getElementById("local-peer-name").disabled = true;
    chatSocket.send(JSON.stringify({command: 'connect', username: document.getElementById('local-peer-name').value}))
    
    if (rc && rc.isOpen()) {
        console.log('Already connected to a room');
    } else {
        rc = new RoomClient(null, null, document.body, window.mediasoupClient, socket,
        'metaversosul-nucleo-1', 'metaversosul-nucleo-1-' + makeid(64), function(){});
    }

    const sendButton = document.getElementById("send-message");

    sendButton.addEventListener("click", function() {
        // Send message
        let messageTextarea = document.getElementById('message-content');
        let messageContent = messageTextarea.value;

        if (messageContent != null && messageContent.trim() !== '') {
            let messageData = {"command": "chat", "content": messageContent};
            if (document.getElementById("replyPreview").dataset.id != "") {
                messageData.reply_to = document.getElementById("replyPreview").dataset.id;
            }
            chatSocket.send(JSON.stringify(messageData));

            // Clear textarea
            messageTextarea.value = '';
            closeReply();
        }            
    });

    document.getElementById('message-content').addEventListener('keyup', function(e) {
        if (e.keyCode == 13) {
        sendButton.click();
    }
    });

    const pictureInput = document.getElementById("picture-input");
    const deletePicture = document.getElementById("delete-picture");

    pictureInput.addEventListener("change", function(event) {
        if (event.target.files && event.target.files[0]) {
            const formData = new FormData();
            formData.append('profile_picture', event.target.files[0]);
            const url = 'http://127.0.0.1:8000/api/client-picture/' + localStorage.getItem('clientToken') + '/';
            const options = {
                method: "POST",
                body: formData
            };
            fetch(url, options)
                .then( res => res.json() )
                .then( response_json => {
                    document.getElementById("profile-picture").style.backgroundImage = "url(" + response_json.profile_picture + ")";
                    event.target.value = "";
                });
        }
    });

    deletePicture.addEventListener("click", function() {
        const url = 'http://127.0.0.1:8000/api/client-picture/' + localStorage.getItem('clientToken') + '/';
        const options = {
            method: "DELETE",
        };
        fetch(url, options)
            .then( res => {
                document.getElementById("profile-picture").style.backgroundImage = "url(css/imgs/default_pic.jpg)";
            });
    });
}
