"use strict";
window.addEventListener("load",()=>{


const $ = id => document.getElementById(id);

let generatedImage = null;

function updateStatus() {
    $("status").textContent = "Image engine ready";
}

function renderGallery() {
    const gallery = $("gallery");

    gallery.replaceChildren();

    const images = [...PingasGPTImages.learnedImages.values()];

    $("imageCount").textContent =
        images.length + " remembered image(s)";

    for (const item of images) {
        const card = document.createElement("div");
        card.className = "gallery-item";

        const img = document.createElement("img");
        img.src = item.data;
        img.alt = "Remembered image";

        const info = document.createElement("p");
        info.textContent =
            item.analysis.width + " × " +
            item.analysis.height;

        const button = document.createElement("button");
        button.textContent = "View image";

        button.onclick = () => {
            $("preview").replaceChildren();

            const preview = document.createElement("img");
            preview.src = item.data;
            preview.alt = "Remembered image";

            $("preview").appendChild(preview);

            generatedImage = item.data;
            $("downloadButton").disabled = false;
        };

        card.append(img, info, button);
        gallery.appendChild(card);
    }
}

$("generateButton").addEventListener("click", () => {
    const prompt = $("prompt").value.trim();

    if (!prompt) {
        $("generationStatus").textContent =
            "Please enter an image prompt.";
        return;
    }

    if (!$("generationEnabled").checked) {
        $("generationStatus").textContent =
            "no, me can't draw.";
        return;
    }

    $("generateButton").disabled = true;
    $("generationStatus").textContent = "Generating...";

    try {
        PingasGPTImages.config.imageGenerationEnabled = true;

        const result = PingasGPTImages.generateImage(prompt);

        if (typeof result !== "string" ||
            !result.startsWith("data:image/")) {
            throw new Error("Image generation failed.");
        }

        generatedImage = result;

        const img = document.createElement("img");
        img.src = result;
        img.alt = prompt;

        $("preview").replaceChildren(img);
        $("downloadButton").disabled = false;

        $("generationStatus").textContent =
            "Image generated successfully.";
    } catch (error) {
        $("generationStatus").textContent =
            error.message || "Image generation failed.";
    }

    $("generateButton").disabled = false;
});

$("downloadButton").addEventListener("click", () => {
    if (!generatedImage) return;

    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = "pingasgpt-image.png";
    link.click();
});

$("learnButton").addEventListener("click", async () => {
    const url = $("imageURL").value.trim();

    if (!url) {
        $("learningStatus").textContent =
            "Please enter an image URL.";
        return;
    }

    $("learnButton").disabled = true;
    $("learningStatus").textContent = "Learning image...";

    const result = await PingasGPTImages.learnImage(url);

    if (result.success) {
        $("learningStatus").textContent =
            "yes, i remembered the image.";
        renderGallery();
    } else {
        $("learningStatus").textContent =
            "no, cors issue or not ok";
    }

    $("learnButton").disabled = false;
});

$("generationEnabled").addEventListener("change", () => {
    PingasGPTImages.config.imageGenerationEnabled =
        $("generationEnabled").checked;

    $("generationStatus").textContent =
        $("generationEnabled").checked
            ? "Image generation enabled."
            : "no, me can't draw.";
});

updateStatus();
renderGallery();
})