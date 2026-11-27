(function () {
    "use strict";
window.PingasConfig.prompturl = window.localStorage.getItem("gptprompt") || "https://pingasgpt.pages.dev/prompt.txt";
    const $ = id => document.getElementById(id);

    const chat = $("chat");
    const input = $("messageInput");
    const sendButton = $("sendButton");

    let ready = false;
    let busy = false;

    function setStatus(state, message) {
        $("status").className = "status " + state;
        $("statusText").textContent = message;
    }

    function scrollToBottom() {
        chat.scrollTop = chat.scrollHeight;
    }

    function addMessage(role, text) {
        const message = document.createElement("div");
        message.className = "message " + role;

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = role === "user" ? " " : "P";
        if (role === "user") {
            avatar.style.backgroundImage = "/profile.png";
            avatar.style.backgroundSize = "100% 100%";
        }

        const content = document.createElement("div");
        content.className = "content";

        const sender = document.createElement("div");
        sender.className = "sender";
        sender.textContent = role === "user" ? "You" : "PingasGPT";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;

        content.appendChild(sender);
        content.appendChild(bubble);

        message.appendChild(avatar);
        message.appendChild(content);

        chat.appendChild(message);

        scrollToBottom();

        return message;
    }

    function showTyping() {
        const message = document.createElement("div");
        message.className = "message";
        message.id = "typingIndicator";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = "P";

        const content = document.createElement("div");
        content.className = "content";

        const sender = document.createElement("div");
        sender.className = "sender";
        sender.textContent = "PingasGPT";

        const indicator = document.createElement("div");
        indicator.className = "typing";

        for (let i = 0; i < 3; i++) {
            indicator.appendChild(
                document.createElement("span")
            );
        }

        content.appendChild(sender);
        content.appendChild(indicator);

        message.appendChild(avatar);
        message.appendChild(content);

        chat.appendChild(message);

        scrollToBottom();
    }

    function hideTyping() {
        const indicator = $("typingIndicator");

        if (indicator) {
            indicator.remove();
        }
    }

    function updateStats() {
        if (!ready) return;

        const stats = PingasGPT.getStats();

        $("networkInfo").textContent =
            stats.words.toLocaleString() + " words · " +
            stats.associations.toLocaleString() + " connections";
    }

    async function initialize() {
        try {
            setStatus("", "Loading network");

            await PingasGPT.load();

            ready = true;

            setStatus("ready", "Online");

            updateStats();

        } catch (error) {
            console.error(error);

            setStatus("error", "Failed to load");

            $("networkInfo").textContent =
                "Could not load PingasGPT";
        }
    }

    async function sendMessage() {
        const text = input.value.trim();

        if (!text || busy || !ready) return;

        busy = true;
        sendButton.disabled = true;

        input.value = "";
        input.style.height = "42px";

        addMessage("user", text);

        showTyping();

        try {
            
            await new Promise(resolve => setTimeout(resolve, 30));

            const response = await PingasGPT.ask(text);

            hideTyping();

            addMessage(
                "assistant",
                response || " "
            );

            updateStats();

        } catch (error) {
            console.error(error);

            hideTyping();

            addMessage(
                "assistant",
                "An error occurred while generating a response."
            );
        }

        busy = false;
        sendButton.disabled = false;

        input.focus();
    }

    sendButton.addEventListener("click", sendMessage);

    input.addEventListener("keydown", event => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {
            event.preventDefault();
            sendMessage();
        }
    });

    input.addEventListener("input", () => {
        input.style.height = "42px";

        input.style.height =
            Math.min(input.scrollHeight, 160) + "px";
    });

    $("clearButton").addEventListener("click", () => {
        if (busy) return;

        chat.replaceChildren();

        PingasGPT.clearMemory();

        updateStats();
    });

    $("statsButton").addEventListener("click", () => {
        if (!ready) return;

        const stats = PingasGPT.getStats();

        const report = Object.entries(stats)
            .map(([key, value]) => key + ": " + value)
            .join("\n");

        addMessage("assistant", report);
    });

    initialize();

})();