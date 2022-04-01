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
const socket = io.connect('https://tecnicaspedagogicas.com.br:443');
var producer = null;
var rc = null;
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

chatSocket = new ReconnectingWebSocket('ws://127.0.0.1:8000/ws/chat/talk/?clientToken=' + clientToken);

chatSocket.onopen = function(e) {
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
                                '<span id="replyMenu-' + data.id + '" class="menu-reply" onclick="sendReply(this)">⬅</span>' +      
                                '<span id="reactionMenu-' + data.id + '" class="menu-reactions">' +
                                '<span class="reaction-menu" data-reaction="1" onclick="toggleReaction(this)">👍</span>' +
                                '<span class="reaction-menu" data-reaction="2" onclick="toggleReaction(this)">👏</span>' +
                                '<span class="reaction-menu" data-reaction="3" onclick="toggleReaction(this)">❤</span>' +
                                '<span class="reaction-menu" data-reaction="4" onclick="toggleReaction(this)">🙌</span>' +
                                '<span class="reaction-menu" data-reaction="5" onclick="toggleReaction(this)">😮</span>' +
                                '<span class="reaction-menu" data-reaction="6" onclick="toggleReaction(this)">🤣</span>' +
                                '</span>' +
                            '</span>';
        let reactionNode = '';
        let visible_1 = data.reaction_1 > 0 ? "visible" : "";
        let sent_1 = data.sent_reactions.includes(1) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_1 + ' ' + visible_1 + '" data-reaction="1" onclick="toggleReaction(this)">👍<span class="react-quantity">' + data.reaction_1 + '</span></span>';
        let visible_2 = data.reaction_2 > 0 ? "visible" : "";
        let sent_2 = data.sent_reactions.includes(2) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_2 + ' ' + visible_2 + '" data-reaction="2" onclick="toggleReaction(this)">👏<span class="react-quantity">' + data.reaction_2 + '</span></span>';
        let visible_3 = data.reaction_3 > 0 ? "visible" : "";
        let sent_3 = data.sent_reactions.includes(3) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_3 + ' ' + visible_3 + '" data-reaction="3" onclick="toggleReaction(this)">❤<span class="react-quantity">' + data.reaction_3 + '</span></span>';
        let visible_4 = data.reaction_4 > 0 ? "visible" : "";
        let sent_4 = data.sent_reactions.includes(4) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_4 + ' ' + visible_4 + '" data-reaction="4" onclick="toggleReaction(this)">🙌<span class="react-quantity">' + data.reaction_4 + '</span></span>';
        let visible_5 = data.reaction_5 > 0 ? "visible" : "";
        let sent_5 = data.sent_reactions.includes(5) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_5 + ' ' + visible_5 + '" data-reaction="5" onclick="toggleReaction(this)">😮<span class="react-quantity">' + data.reaction_5 + '</span></span>';
        let visible_6 = data.reaction_6 > 0 ? "visible" : "";
        let sent_6 = data.sent_reactions.includes(6) ? "sent" : "";
        reactionNode += '<span class="reaction ' + sent_6 + ' ' + visible_6 + '" data-reaction="6" onclick="toggleReaction(this)">🤣<span class="react-quantity">' + data.reaction_6 + '</span></span>';
        
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
        messageBlock.appendChild(peerNode);
        if (scrollToBottom) {
            if (data.from_me) {
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
    // else if (data.type == 'chat') {
    //     if (data.content != null && data.content.trim() !== '') {
    //     let peerNode = document.createElement('p');
    //     let messageUser = data.name || 'Palestrante';
    //     peerNode.className = "p-messaged-chat";
    //     peerNode.innerHTML = '<strong class="s-messaged-chat">' + escapeHtml(messageUser) + '</strong> ' + linkifyHtml(escapeHtml(data.content), {target: '_blank'});
    //     document.getElementById('chat').appendChild(peerNode);
    //     document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
    //     }
    // }
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
    // else if (data.type == 'command' && typeof data.content === 'string') {                
    //     // Call Unity function						
    //     // Participante recebe comando (voltar/avançar slide)
    //     gameInstance.SendMessage('ScriptHandler', 'SlideChange', data.content);                 
    // }              
    // else {
    //     if (data.name == 'changeHost') {
    //     gameInstance.SendMessage('ScriptHandler', 'WhichPalestranteWillTalk', data.content);
    //     }
    //     else if (data.name == 'slideSet') {
    //     gameInstance.SendMessage('ScriptHandler', 'SlideSet', data.content);
    //     }
    // }
    else if (data.type == 'chat_control') {
        if (data.name != null && data.name == 'slideChange'){
            gameInstance.SendMessage('ScriptHandler', 'SlideChange', data.content);
        }
        else if (data.name != null && data.name == 'changeHost'){
            gameInstance.SendMessage('ScriptHandler', 'WhichPalestranteWillTalk', data.content);
        }
        else if (data.name != null && data.name == 'slideSet'){
            gameInstance.SendMessage('ScriptHandler', 'SlideSet', data.content);
        }
    }
    else if (data.type == 'chat_start') {
        if (data.username != null) {
            document.getElementById("host-name").textContent = data.username;
        }
        if (data.profile_picture != null) {
            document.getElementById("host-picture").src = data.profile_picture;
        }
        if (data.permissions.includes('chat.can_control_presentation_slides')) {
            document.getElementById("slide-header").style.display = '';
            document.getElementById("previous-slide").style.display = '';
            document.getElementById("next-slide").style.display = '';

            var loopInterval = setInterval(function() {
                chatSocket.send(JSON.stringify({"command": "control", content: slideIndex, name: 'slideSet'}));
                chatSocket.send(JSON.stringify({"command": "control", content: hostIndex, name: 'changeHost'}));
            }, 5000);
        }
    }
    else if (data.type == 'chat_connection') {
        connectionCount++;
        document.getElementById('conexoes').innerHTML = connectionCount;
        let peerNode = document.createElement('p');
        peerNode.className = "p-entered-chat";
        peerNode.innerHTML = '<strong class="s-entered-chat">' + escapeHtml(data.username) + '</strong> entrou na sala.';
        document.getElementById('chat').appendChild(peerNode);
        document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
    }
    else if (data.type == 'chat_disconnection') {
        connectionCount--;
        document.getElementById('conexoes').innerHTML = connectionCount;
        let peerNode = document.createElement('p');
        peerNode.className = "p-exited-chat";
        peerNode.innerHTML = '<strong class="s-exited-chat">' + escapeHtml(data.username) + '</strong> saiu da sala.';
        document.getElementById('chat').appendChild(peerNode);
        document.getElementById('chat').scrollTop = document.getElementById('chat').scrollHeight;
        }
    };

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

    document.getElementById("send-message").addEventListener("click", function() {
        // Send message
        let messageTextarea = document.getElementById('message-content');
        let messageContent = messageTextarea.value;

        if (messageContent != null && messageContent.trim() !== '') {
        chatSocket.send(JSON.stringify({type: 'chat', content: messageContent, name: document.getElementById('local-peer-name').value}));

        // Clear textarea
        messageTextarea.value = '';
        }
    });

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
  
    const previousButton = document.getElementById("previous-slide");
    const nextButton = document.getElementById("next-slide");
    const palestrante1 = document.getElementById("palestrante-1");
    const palestrante2 = document.getElementById("palestrante-2");
    const palestrante3 = document.getElementById("palestrante-3");
    const palestrante4 = document.getElementById("palestrante-4");
    const stopTalk = document.getElementById("stopTalk");
    const exportCSV = document.getElementById("download-csv");
    const pictureInput = document.getElementById("picture-input");
    const deletePicture = document.getElementById("delete-picture");

    palestrante1.addEventListener("click", function() {
        hostIndex = 0;
        chatSocket.send(JSON.stringify({"command": "control", content: 0, name: 'changeHost'}));
    });

    palestrante2.addEventListener("click", function() {
        hostIndex = 1;
        chatSocket.send(JSON.stringify({"command": "control", content: 1, name: 'changeHost'}));
    });

    palestrante3.addEventListener("click", function() {
        hostIndex = 2;
        chatSocket.send(JSON.stringify({"command": "control", content: 2, name: 'changeHost'}));
    });

    palestrante4.addEventListener("click", function() {
        hostIndex = 3;
        chatSocket.send(JSON.stringify({"command": "control", content: 3, name: 'changeHost'}));
    });

    stopTalk.addEventListener("click", function() {
        hostIndex = -1;
        chatSocket.send(JSON.stringify({"command": "control", content: -1, name: 'changeHost'}));
    });

    exportCSV.addEventListener("click", function() {
        const url = 'http://127.0.0.1:8000/api/export-chat/';
        const authHeader = 'Bearer ' + localStorage.getItem('authToken');
        const options = {
            headers: {
                Authorization: authHeader
            }
        };
        fetch(url, options)
            .then( res => res.blob() )
            .then( blob => {
                let file = window.URL.createObjectURL(blob);
                window.location.assign(file);
            });
    });

    pictureInput.addEventListener("change", function(event) {
        if (event.target.files && event.target.files[0]) {
            const formData = new FormData();
            formData.append('profile_picture', event.target.files[0]);
            const url = 'http://127.0.0.1:8000/api/profile-picture/';
            const authHeader = 'Bearer ' + localStorage.getItem('authToken');
            const options = {
                method: "POST",
                headers: {
                    Authorization: authHeader
                },
                body: formData
            };
            fetch(url, options)
                .then( res => res.json() )
                .then( response_json => {
                    document.getElementById("host-picture").src = response_json.profile_picture;
                    event.target.value = "";
                });
        }
    });

    deletePicture.addEventListener("click", function() {
        const url = 'http://127.0.0.1:8000/api/profile-picture/';
        const authHeader = 'Bearer ' + localStorage.getItem('authToken');
        const options = {
            method: "DELETE",
            headers: {
                Authorization: authHeader
            }
        };
        fetch(url, options)
            .then( res => {
                document.getElementById("host-picture").src = "";
            });
    });
}
