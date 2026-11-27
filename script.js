(function (global) {
    "use strict";

    class PingasGPTEngine {
        constructor() {
            this.name = "PingasGPT";
            this.prompt = "";
            this.loaded = false;

            this.history = [];
            this.memory = [];

            this.network = new Map();
            this.sentences = [];

            this.wordCounts = new Map();
            this.bigram = new Map();
            this.trigram = new Map();

            this.stopWords = new Set([
                "the", "a", "an", "is", "are", "was", "were",
                "be", "been", "being", "to", "of", "and", "or",
                "in", "on", "at", "for", "from", "with", "by",
                "as", "it", "its", "this", "that", "these",
                "those", "i", "you", "he", "she", "we", "they",
                "me", "my", "your", "his", "her", "our", "their",
                "do", "does", "did", "have", "has", "had",
                "can", "could", "would", "should", "will",
                "what", "which", "who", "whom", "when", "where",
                "why", "how", "if", "then", "than", "but",
                "not", "no", "yes", "so", "very", "just",
                "about", "into", "up", "down", "out", "there",
                "here", "also", "some", "any", "all", "more"
            ]);

            this.settings = {
                associationWindow: 4,
                minimumAssociation: 1,
                learningRate: 1,
                maximumMemory: 500,
                maximumHistory: 100,
                maximumSentenceLength: 45,
                generationLength: 55,
                temperature: 0.8
            };
        }

        
        async load() {
            try {
                const response = await fetch(window.gptprompt || "https://pingasgpt.pages.dev/prompt.txt", {
                    cache: "no-cache"
                });

                if (!response.ok) {
                    throw new Error(
                        "Could not load prompt url: " + response.status
                    );
                }

                this.prompt = await response.text();

                this.learn(this.prompt, "system");
                this.loaded = true;

                return this;
            } catch (error) {
                console.error("PingasGPT loading error:", error);
                throw error;
            }
        }

        
        tokenize(text) {
            return String(text)
                .toLowerCase()
                .match(/[\p{L}\p{N}_'-]+|[^\s]/gu) || [];
        }

        
        keywords(text) {
            return this.tokenize(text).filter(word =>
                word.length > 1 &&
                !this.stopWords.has(word)
            );
        }

        
        splitSentences(text) {
            return String(text)
                .replace(/\r/g, "")
                .split(/(?<=[.!?])\s+|\n+/)
                .map(s => s.trim())
                .filter(s => s.length > 2);
        }

        
        getNode(word) {
            if (!this.network.has(word)) {
                this.network.set(word, {
                    word,
                    connections: new Map(),
                    frequency: 0
                });
            }

            return this.network.get(word);
        }

        
        connectWords(a, b, strength = 1) {
            if (!a || !b || a === b) return;

            const nodeA = this.getNode(a);
            const nodeB = this.getNode(b);

            nodeA.connections.set(
                b,
                (nodeA.connections.get(b) || 0) + strength
            );

            nodeB.connections.set(
                a,
                (nodeB.connections.get(a) || 0) + strength
            );
        }

        
        learnSentence(sentence) {
            const words = this.keywords(sentence);

            if (!words.length) return;

            for (const word of words) {
                const node = this.getNode(word);
                node.frequency++;

                this.wordCounts.set(
                    word,
                    (this.wordCounts.get(word) || 0) + 1
                );
            }

            for (let i = 0; i < words.length; i++) {
                for (
                    let j = i + 1;
                    j < Math.min(
                        words.length,
                        i + this.settings.associationWindow + 1
                    );
                    j++
                ) {
                    const distance = j - i;

                    this.connectWords(
                        words[i],
                        words[j],
                        1 / distance
                    );
                }
            }

            
            const tokens = this.tokenize(sentence);

            for (let i = 0; i < tokens.length - 1; i++) {
                const key = tokens[i];

                if (!this.bigram.has(key)) {
                    this.bigram.set(key, new Map());
                }

                const next = this.bigram.get(key);

                next.set(
                    tokens[i + 1],
                    (next.get(tokens[i + 1]) || 0) + 1
                );

                if (i < tokens.length - 2) {
                    const triKey = tokens.slice(i, i + 2).join(" ");

                    if (!this.trigram.has(triKey)) {
                        this.trigram.set(triKey, new Map());
                    }

                    const tri = this.trigram.get(triKey);

                    tri.set(
                        tokens[i + 2],
                        (tri.get(tokens[i + 2]) || 0) + 1
                    );
                }
            }

            this.sentences.push(sentence);

            if (this.sentences.length > this.settings.maximumMemory) {
                this.sentences.shift();
            }
        }

        
        learn(text, source = "conversation") {
            const sentences = this.splitSentences(text);

            for (const sentence of sentences) {
                this.learnSentence(sentence);

                this.memory.push({
                    text: sentence,
                    source,
                    time: Date.now()
                });
            }

            if (this.memory.length > this.settings.maximumMemory) {
                this.memory.splice(
                    0,
                    this.memory.length - this.settings.maximumMemory
                );
            }
        }

        
        similarity(wordsA, wordsB) {
            if (!wordsA.length || !wordsB.length) return 0;

            const setB = new Set(wordsB);

            let score = 0;

            for (const word of wordsA) {
                if (setB.has(word)) {
                    score += 1;
                    continue;
                }

                const node = this.network.get(word);

                if (!node) continue;

                for (const related of setB) {
                    const connection = node.connections.get(related);

                    if (connection) {
                        score += Math.min(connection, 3) * 0.15;
                    }
                }
            }

            return score / Math.sqrt(wordsA.length * wordsB.length);
        }

        
        activateNetwork(words) {
            const activations = new Map();

            for (const word of words) {
                activations.set(
                    word,
                    (activations.get(word) || 0) + 1
                );

                const node = this.network.get(word);

                if (!node) continue;

                for (const [related, strength] of node.connections) {
                    activations.set(
                        related,
                        (activations.get(related) || 0) +
                        strength * 0.25
                    );
                }
            }

            return [...activations.entries()]
                .sort((a, b) => b[1] - a[1]);
        }

        
        retrieve(query, limit = 5) {
            const queryWords = this.keywords(query);

            const results = this.memory.map((entry, index) => {
                const memoryWords = this.keywords(entry.text);

                const relevance = this.similarity(
                    queryWords,
                    memoryWords
                );

                const recency = index / Math.max(this.memory.length, 1);

                return {
                    ...entry,
                    score: relevance + recency * 0.025
                };
            });

            return results
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        }

        
        chooseNext(options, temperature = 0.8) {
            if (!options || options.size === 0) return null;

            const entries = [...options.entries()];

            const weights = entries.map(([word, count]) => {
                const frequency = Math.pow(count, 1 / temperature);
                return [word, frequency];
            });

            const total = weights.reduce(
                (sum, entry) => sum + entry[1],
                0
            );

            if (!total) return null;

            let random = Math.random() * total;

            for (const [word, weight] of weights) {
                random -= weight;

                if (random <= 0) return word;
            }

            return weights[weights.length - 1][0];
        }

        
        generate(seedWords, maxLength = 30) {
            let words = [...seedWords];

            if (!words.length) {
                const available = [...this.bigram.keys()];

                if (!available.length) return "";

                words = [
                    available[Math.floor(Math.random() * available.length)]
                ];
            }

            let output = words.slice(-3);

            for (let i = 0; i < maxLength; i++) {
                const last = output[output.length - 1];

                const previous = output.slice(-2).join(" ");

                const tri = this.trigram.get(previous);
                const bi = this.bigram.get(last);

                let next = null;

                if (tri && Math.random() < 0.85) {
                    next = this.chooseNext(
                        tri,
                        this.settings.temperature
                    );
                }

                if (!next && bi) {
                    next = this.chooseNext(
                        bi,
                        this.settings.temperature
                    );
                }

                if (!next) break;

                if (next.length > 30) break;

                output.push(next);

                if (
                    [".", "!", "?"].includes(next) &&
                    output.length > 5
                ) {
                    break;
                }
            }

            return output.join(" ");
        }

        
        getPromptContext(query) {
            const promptSentences = this.splitSentences(this.prompt);
            const queryWords = this.keywords(query);

            return promptSentences
                .map(sentence => ({
                    sentence,
                    score: this.similarity(
                        queryWords,
                        this.keywords(sentence)
                    )
                }))
                .filter(item => item.score > 0.05)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(item => item.sentence);
        }

        
        respond(query) {
            const relevant = this.retrieve(query, 5);
            const context = this.getPromptContext(query);

            const queryWords = this.keywords(query);
            const activations = this.activateNetwork(queryWords);

            const relatedWords = activations
                .slice(0, 12)
                .map(item => item[0]);

            
            const previousMessages = this.history
                .slice(-8)
                .map(item => item.content);

            const previousContext = previousMessages
                .join(" ");

            const combinedContext = [
                ...context,
                ...relevant.map(item => item.text)
            ].join(" ");

            
            const candidates = [
                ...relevant.map(item => item.text),
                ...context
            ];

            const uniqueCandidates = [...new Set(candidates)];

            let selected = [];

            for (const sentence of uniqueCandidates) {
                const score = this.similarity(
                    queryWords,
                    this.keywords(sentence)
                );

                if (score > 0.05) {
                    selected.push({
                        text: sentence,
                        score
                    });
                }
            }

            selected.sort((a, b) => b.score - a.score);

            
            let seedText = [
                query,
                combinedContext,
                previousContext
            ].join(" ");

            let seed = this.keywords(seedText);

            
            if (relatedWords.length) {
                seed = [
                    ...queryWords,
                    ...relatedWords.slice(0, 8)
                ];
            }

            
            const generated = this.generate(
                seed,
                this.settings.generationLength
            );

            
            let responseParts = [];

            for (const item of selected.slice(0, 2)) {
                if (item.score > 0.2) {
                    responseParts.push(item.text);
                }
            }

            if (generated && generated.trim()) {
                responseParts.push(generated);
            }

            
            responseParts = [...new Set(responseParts)];

            let response = responseParts.join(" ");

            
            const tokens = response.split(/\s+/);

            if (tokens.length > 120) {
                response = tokens.slice(0, 120).join(" ");
            }

            
            response = response.trim();

            if (response) {
                response =
                    response.charAt(0).toUpperCase() +
                    response.slice(1);
            }

            return response;
        }

        
        async ask(message) {
            if (!this.loaded) {
                await this.load();
            }

            message = String(message || "").trim();

            if (!message) {
                return "";
            }

            
            this.learn(message, "user");

            this.history.push({
                role: "user",
                content: message,
                time: Date.now()
            });

            
            let response = this.respond(message);

            
            if (response) {
                this.learn(response, "assistant");
            }

            this.history.push({
                role: "assistant",
                content: response,
                time: Date.now()
            });

            if (this.history.length > this.settings.maximumHistory) {
                this.history.splice(
                    0,
                    this.history.length - this.settings.maximumHistory
                );
            }

            return response;
        }

        
        train(text) {
            this.learn(text, "training");
            return this;
        }

        
        getStats() {
            return {
                name: this.name,
                loaded: this.loaded,
                words: this.network.size,
                associations: [...this.network.values()]
                    .reduce(
                        (total, node) =>
                            total + node.connections.size,
                        0
                    ),
                sentences: this.sentences.length,
                memories: this.memory.length,
                conversations: this.history.length,
                promptLength: this.prompt.length
            };
        }
        
        clearMemory() {
            this.history = [];
            this.memory = [];
            this.sentences = [];
            this.network.clear();
            this.wordCounts.clear();
            this.bigram.clear();
            this.trigram.clear();

            if (this.prompt) {
                this.learn(this.prompt, "system");
            }

            return this;
        }

        
        exportNetwork() {
            return {
                name: this.name,
                prompt: this.prompt,
                memory: this.memory,
                history: this.history,
                sentences: this.sentences,
                network: [...this.network.entries()].map(
                    ([word, node]) => ({
                        word,
                        frequency: node.frequency,
                        connections: [...node.connections.entries()]
                    })
                ),
                bigram: [...this.bigram.entries()].map(
                    ([word, values]) => [
                        word,
                        [...values.entries()]
                    ]
                ),
                trigram: [...this.trigram.entries()].map(
                    ([phrase, values]) => [
                        phrase,
                        [...values.entries()]
                    ]
                )
            };
        }

        
        importNetwork(data) {
            if (!data || data.name !== this.name) {
                throw new Error("Invalid PingasGPT network.");
            }

            this.prompt = data.prompt || "";
            this.memory = data.memory || [];
            this.history = data.history || [];
            this.sentences = data.sentences || [];

            this.network.clear();

            for (const item of data.network || []) {
                this.network.set(item.word, {
                    word: item.word,
                    frequency: item.frequency,
                    connections: new Map(item.connections)
                });
            }

            this.bigram = new Map(
                (data.bigram || []).map(
                    ([word, values]) => [
                        word,
                        new Map(values)
                    ]
                )
            );

            this.trigram = new Map(
                (data.trigram || []).map(
                    ([phrase, values]) => [
                        phrase,
                        new Map(values)
                    ]
                )
            );

            this.loaded = true;

            return this;
        }
    }

    
    global.PingasGPT = new PingasGPTEngine();

})(globalThis);
