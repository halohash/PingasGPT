
(function (global) {
    "use strict";

    class PingasGPTImageGenerator {
        constructor() {
            this.name = "PingasGPT Image Generator";

            // CONFIGURATION
            window.PingasConfig.ImageGen = {
                imageGenerationEnabled: true,
                maximumLearnedImages: 100,
                analysisSize: 64
            };

            this.canvas = null;
            this.ctx = null;

            // Stores original images and their visual descriptions.
            this.learnedImages = new Map();
        }

        createCanvas(width = 768, height = 768) {
            this.canvas = document.createElement("canvas");
            this.canvas.width = width;
            this.canvas.height = height;

            this.ctx = this.canvas.getContext("2d", {
                willReadFrequently: true
            });

            return this.canvas;
        }

        randomColor() {
            return `hsl(${Math.floor(Math.random() * 360)}, ${50 + Math.random() * 40}%, ${35 + Math.random() * 35}%)`;
        }

        // Analyze the visual properties of an image.
        analyzeImage(image) {
            const size = window.PingasConfig.ImageGen.analysisSize;
            const canvas = this.createCanvas(size, size);
            const ctx = this.ctx;

            ctx.clearRect(0, 0, size, size);

            ctx.drawImage(image, 0, 0, size, size);

            const pixels = ctx.getImageData(
                0, 0, size, size
            ).data;

            const colorCounts = new Map();

            let totalRed = 0;
            let totalGreen = 0;
            let totalBlue = 0;
            let brightness = 0;
            let edgeCount = 0;

            const grid = [];

            const getPixel = (x, y) => {
                const index = (y * size + x) * 4;

                return {
                    r: pixels[index],
                    g: pixels[index + 1],
                    b: pixels[index + 2]
                };
            };

            for (let y = 0; y < size; y++) {
                const row = [];

                for (let x = 0; x < size; x++) {
                    const color = getPixel(x, y);

                    totalRed += color.r;
                    totalGreen += color.g;
                    totalBlue += color.b;

                    const light =
                        (color.r * 0.299) +
                        (color.g * 0.587) +
                        (color.b * 0.114);

                    brightness += light;

                    // Quantize colors into a small palette.
                    const key = [
                        Math.round(color.r / 32) * 32,
                        Math.round(color.g / 32) * 32,
                        Math.round(color.b / 32) * 32
                    ].join(",");

                    colorCounts.set(
                        key,
                        (colorCounts.get(key) || 0) + 1
                    );

                    // Store the image's rough visual layout.
                    row.push(key);

                    // Estimate edges by comparing nearby pixels.
                    if (x > 0 && y > 0) {
                        const left = getPixel(x - 1, y);
                        const above = getPixel(x, y - 1);

                        const difference =
                            Math.abs(color.r - left.r) +
                            Math.abs(color.g - left.g) +
                            Math.abs(color.b - left.b) +
                            Math.abs(color.r - above.r) +
                            Math.abs(color.g - above.g) +
                            Math.abs(color.b - above.b);

                        if (difference > 180) {
                            edgeCount++;
                        }
                    }
                }

                grid.push(row);
            }

            const totalPixels = size * size;

            const dominantColors = [...colorCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([color, count]) => ({
                    color: "rgb(" + color + ")",
                    percentage: count / totalPixels
                }));

            return {
                width: image.width,
                height: image.height,

                aspectRatio: image.width / image.height,

                averageColor: {
                    r: Math.round(totalRed / totalPixels),
                    g: Math.round(totalGreen / totalPixels),
                    b: Math.round(totalBlue / totalPixels)
                },

                averageBrightness:
                    Math.round(brightness / totalPixels),

                dominantColors,

                edgeDensity: edgeCount / totalPixels,

                visualGrid: grid,

                analyzedAt: Date.now()
            };
        }

        // Learn an image from a URL.
        async learnImage(url) {
            try {
                url = String(url || "").trim();

                if (!url) {
                    return {
                        success: false,
                        message: "no, cors issue or not ok"
                    };
                }

                const response = await fetch(url, {
                    mode: "cors",
                    cache: "no-cache"
                });

                if (!response.ok) {
                    throw new Error("Image request failed");
                }

                const blob = await response.blob();

                if (!blob.type.startsWith("image/")) {
                    throw new Error("Not an image");
                }

                const image = await createImageBitmap(blob);

                const analysis = this.analyzeImage(image);

                // Save the complete original image.
                const originalCanvas = this.createCanvas(
                    image.width,
                    image.height
                );

                this.ctx.drawImage(image, 0, 0);

                const imageData = originalCanvas.toDataURL(
                    blob.type === "image/jpeg" ? "image/jpeg" : "image/png"
                );

                image.close();

                // Remember the image and its analysis.
                this.learnedImages.set(url, {
                    url,
                    data: imageData,
                    analysis,
                    learnedAt: Date.now()
                });

                // Limit memory usage.
                while (
                    this.learnedImages.size >
                    window.PingasConfig.ImageGen.maximumLearnedImages
                ) {
                    const oldest = this.learnedImages.keys().next().value;
                    this.learnedImages.delete(oldest);
                }

                return {
                    success: true,
                    message: "yes, i remembered the image.",
                    analysis
                };

            } catch (error) {
                console.warn("PingasGPT image learning error:", error);

                return {
                    success: false,
                    message: "no, cors issue or not ok"
                };
            }
        }

        // Get a previously learned image.
        getLearnedImage(url) {
            return this.learnedImages.get(url) || null;
        }

        // Search learned images using their visual features.
        findSimilarImages(analysis, limit = 5) {
            const results = [];

            for (const item of this.learnedImages.values()) {
                const other = item.analysis;

                const colorDistance = Math.sqrt(
                    Math.pow(analysis.averageColor.r - other.averageColor.r, 2) +
                    Math.pow(analysis.averageColor.g - other.averageColor.g, 2) +
                    Math.pow(analysis.averageColor.b - other.averageColor.b, 2)
                );

                const brightnessDistance = Math.abs(
                    analysis.averageBrightness -
                    other.averageBrightness
                );

                const edgeDistance = Math.abs(
                    analysis.edgeDensity -
                    other.edgeDensity
                );

                const score =
                    colorDistance +
                    brightnessDistance +
                    edgeDistance * 100;

                results.push({
                    url: item.url,
                    score,
                    analysis: other
                });
            }

            return results
                .sort((a, b) => a.score - b.score)
                .slice(0, limit);
        }

        // Generate procedural artwork.
        generate(prompt, width = 768, height = 768) {
            if (!window.PingasConfig.ImageGen.imageGenerationEnabled) {
                return "no, me can't draw.";
            }

            prompt = String(prompt || "").toLowerCase();

            const canvas = this.createCanvas(width, height);
            const ctx = this.ctx;

            const colors = [
                this.randomColor(),
                this.randomColor(),
                this.randomColor()
            ];

            const gradient = ctx.createLinearGradient(
                0, 0, width, height
            );

            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(0.5, colors[1]);
            gradient.addColorStop(1, colors[2]);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            if (
                prompt.includes("space") ||
                prompt.includes("star") ||
                prompt.includes("galaxy")
            ) {
                for (let i = 0; i < 300; i++) {
                    ctx.fillStyle = "white";
                    ctx.globalAlpha = Math.random();

                    ctx.beginPath();
                    ctx.arc(
                        Math.random() * width,
                        Math.random() * height,
                        Math.random() * 3,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }

                ctx.globalAlpha = 1;

                const radius = Math.min(width, height) * 0.19;
                const x = width * 0.5;
                const y = height * 0.5;

                const planet = ctx.createRadialGradient(
                    x - radius * 0.4,
                    y - radius * 0.4,
                    1,
                    x,
                    y,
                    radius
                );

                planet.addColorStop(0, "#ffffff");
                planet.addColorStop(0.3, colors[0]);
                planet.addColorStop(1, "#080820");

                ctx.fillStyle = planet;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }

            else {
                for (let i = 0; i < 100; i++) {
                    ctx.fillStyle = this.randomColor();
                    ctx.globalAlpha = 0.3 + Math.random() * 0.5;

                    ctx.beginPath();
                    ctx.arc(
                        Math.random() * width,
                        Math.random() * height,
                        10 + Math.random() * 120,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }

                ctx.globalAlpha = 1;
            }

            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(0, height - 65, width, 65);

            ctx.fillStyle = "white";
            ctx.font = "22px Arial";
            ctx.fillText(prompt.slice(0, 55), 20, height - 25);

            return canvas.toDataURL("image/png");
        }

        async generateImage(prompt, width, height) {
            return this.generate(prompt, width, height);
        }
    }

    global.PingasGPTImages = new PingasGPTImageGenerator();

    // Global shorthand.
    global.learnImage = function (url) {
        return global.PingasGPTImages.learnImage(url);
    };

})(globalThis);
