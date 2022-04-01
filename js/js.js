//
/* Minimiza o painel do chat horizontalmente */
//

function toggleChat () {

  var chat = document.getElementById("sidePanel");
  var unityContainer = document.getElementById("unity-container");
  var unityCanvas = document.getElementById("unity-canvas");

  chat.classList.toggle("side-panel-closed"); 
  unityContainer.classList.toggle("unity-fullscreen"); 
  unityCanvas.classList.toggle("unity-fullscreen"); 
}

//
/* Botão de scroll até o fim do chat */
//

var scrollToTopBtn = document.getElementById("scrollToBottomBtn");
var chatDiv = document.getElementById("chat");
var scrollPosition = chatDiv.scrollTop;
var maxY = chatDiv.scrollHeight;

function scrollToBottom() {

maxY = chatDiv.scrollHeight;

chatDiv.scrollTo({
  top: maxY,
  behavior: "smooth"
});  
}

scrollToTopBtn.addEventListener("click", scrollToBottom);

//
/* Esconde o botão quando já estiver no final do chat*/
//

chatDiv.onscroll = function() {scrollCheck()}
  
function scrollCheck () { 

maxY = chatDiv.scrollHeight;
scrollPosition = chatDiv.scrollTop;

if (scrollPosition > (maxY/1.5)){
    scrollToTopBtn.classList.add("btn-off"); 
  } else {
    scrollToTopBtn.classList.remove("btn-off"); 
  }
};