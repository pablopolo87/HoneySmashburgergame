window.addEventListener('DOMContentLoaded', () => {
    // Lógica del juego JavaScript

    // --- DOM Elements ---
    let startOverlay, powerLed, loadingScreen, loadingInstructions, gameContainer, rankingForm, gameOverNormalScreen, playOptionsScreen, codeEntryScreen, continueBtn, playWithCodeBtn, playNormalBtn, validateCodeBtn, backToMenuBtn, playerCodeInput, saveScoreBtn, playAgainNormalBtn, viewRankingBtn, progressBarContainer, progressBar, canvas, ctx, rankingDisplay, closeRankingBtn, playAgainBtn, gameMusic, loadingMusic, aciertoSound, falloSound, palmadaSound, rafa, scoreDisplay, timerDisplay, muteBtn;

    // --- Game State ---
    let score = 0;
    let timeLeft = 60;
    let trayX, trayWidth, trayHeight;
    let gameMode = 'normal';
    let validatedGameCode = null;
    let isMuted = false;
    const INITIAL_FALL_SPEED_MIN = 100;
    const INITIAL_FALL_SPEED_MAX = 250;
    const ACCELERATION_RATE_PHASE1 = 0.005;
    const ACCELERATION_RATE_PHASE2 = 0.015;
    const PHASE2_TIME_THRESHOLD = 30;

    let fallingObjects = [];
    let objectSize;

    const objectPoints = {
        bacon: 15,
        cebolla: 15,
        lechuga: 15,
        pan: 15,
        queso: 15,
        miel: 15,
        honey: 20, // Honey gives more points
        zapato: -5,
        lejia: -5
    };

    // --- Asset Preloader ---
    const assetSources = {
        trayImage: 'assets/bandeja_nueva.png',
        backgroundImage: 'assets/Fondo1.png',
        bacon: 'assets/bacon.png',
        cebolla: 'assets/cebolla.png',
        lechuga: 'assets/lechuga.png',
        pan: 'assets/pan.png',
        queso: 'assets/queso.png',
        miel: 'assets/miel.png',
        honey: 'assets/honey.png',
        zapato: 'assets/zapato.png',
        lejia: 'assets/lejia.png',
        rafa: 'assets/rafa.png',
        rafa1: 'assets/rafa 1.png',
        rafa3: 'assets/rafa 3.png',
        yiyes: 'assets/yiyes.png'
    };

    const assets = {};

    function loadAssets(onProgress) {
        const promises = [];
        const numAssets = Object.keys(assetSources).length;
        let loadedCount = 0;

        for (const key in assetSources) {
            const img = new Image();
            assets[key] = img; // Store the image object
            const promise = new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log(`Asset loaded: ${assetSources[key]}`);
                    loadedCount++;
                    if (onProgress) {
                        onProgress(loadedCount / numAssets);
                    }
                    resolve();
                };
                img.onerror = () => {
                    console.error(`Failed to load asset: ${assetSources[key]}`);
                    reject(new Error(`Failed to load asset: ${assetSources[key]}`));
                };
                img.src = assetSources[key];
            });
            promises.push(promise);
        }
        return Promise.all(promises).then(() => {
            console.log('All assets loaded successfully!');
        }).catch(error => {
            console.error('Error loading one or more assets:', error);
        });
    }

    function showScreen(screen) {
        document.querySelectorAll('.game-screen').forEach(s => {
            if (s.style.display !== 'none') {
                console.log(`Hiding screen: ${s.id}`);
                s.style.display = 'none';
            }
        });
        console.log(`Showing screen: ${screen.id}`);
        screen.style.display = 'flex';
    }

    // --- Game Functions ---
    function resizeCanvas() {
        const consoleScreen = document.getElementById('console-screen-container');
        if (canvas && consoleScreen) {
            canvas.width = consoleScreen.offsetWidth;
            canvas.height = consoleScreen.offsetHeight;

            // Make sizes responsive
            objectSize = canvas.width * 0.08; // e.g., 8% of canvas width
            trayWidth = canvas.width * 0.2;
            trayHeight = trayWidth * 0.5; // Maintain aspect ratio

            trayX = (canvas.width - trayWidth) / 2;
        }
    }

    function draw() {
        if (!ctx || !assets.trayImage) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(assets.trayImage, trayX, canvas.height - trayHeight, trayWidth, trayHeight);
        fallingObjects.forEach(obj => {
            if (assets[obj.type]) {
                ctx.save();
                ctx.translate(obj.x + obj.size / 2, obj.y + obj.size / 2);
                ctx.rotate(obj.rotation);
                ctx.drawImage(assets[obj.type], -obj.size / 2, -obj.size / 2, obj.size, obj.size);
                ctx.restore();
            }
        });
    }

    function update(deltaTime) {
        // Acceleration logic based on time
        const speedMultiplier = timeLeft > PHASE2_TIME_THRESHOLD ?
            1 + (60 - timeLeft) * ACCELERATION_RATE_PHASE1 :
            1 + (60 - PHASE2_TIME_THRESHOLD) * ACCELERATION_RATE_PHASE1 + (PHASE2_TIME_THRESHOLD - timeLeft) * ACCELERATION_RATE_PHASE2;

        // Use a single loop for updates and collision detection
        let remainingObjects = [];
        fallingObjects.forEach(obj => {
            obj.y += obj.speed * speedMultiplier * deltaTime;
            obj.rotation += obj.rotationSpeed * deltaTime;

            // Collision detection
            if (obj.y + obj.size > canvas.height - trayHeight &&
                obj.y < canvas.height && // Object is above the bottom edge
                obj.x + obj.size > trayX &&
                obj.x < trayX + trayWidth) {
                
                score += objectPoints[obj.type];
                if (objectPoints[obj.type] > 0) {
                    aciertoSound.currentTime = 0;
                    aciertoSound.play();
                } else {
                    falloSound.currentTime = 0;
                    falloSound.play();
                }
                // Do not add to remainingObjects, effectively removing it
            } else if (obj.y < canvas.height) {
                remainingObjects.push(obj);
            }
        });

        fallingObjects = remainingObjects;
        scoreDisplay.textContent = `Puntos: ${score}`;
        timerDisplay.textContent = `Tiempo: ${Math.ceil(timeLeft)}s`;
    }

    function generateObject() {
        const goodObjects = ['bacon', 'cebolla', 'lechuga', 'pan', 'queso', 'miel'];
        const badObjects = ['zapato', 'lejia'];
        let type;
        const random = Math.random();

        if (random < 0.05) {
            type = 'honey';
        } else if (random < 0.7) {
            type = goodObjects[Math.floor(Math.random() * goodObjects.length)];
        } else {
            type = badObjects[Math.floor(Math.random() * badObjects.length)];
        }

        const x = Math.random() * (canvas.width - objectSize);
        const speed = (Math.random() * (INITIAL_FALL_SPEED_MAX - INITIAL_FALL_SPEED_MIN) + INITIAL_FALL_SPEED_MIN);
        const rotation = 0;
        const rotationSpeed = (Math.random() - 0.5) * 2; // Radians per second
        fallingObjects.push({
            x,
            y: -objectSize, // Start off-screen
            type,
            speed,
            rotation,
            rotationSpeed,
            size: objectSize
        });
    }

    let lastTime = 0;
    let timeToNextObject = 0;

    function gameLoop(currentTime) {
        if (lastTime === 0) {
            lastTime = currentTime;
        }
        const deltaTime = (currentTime - lastTime) / 1000; // Time in seconds
        lastTime = currentTime;

        timeLeft -= deltaTime;
        timeToNextObject -= deltaTime;

        if (timeToNextObject <= 0) {
            generateObject();
            timeToNextObject = 0.5 + Math.random(); // Generate object every 0.5-1.5 seconds
        }

        update(deltaTime);
        draw();

        if (timeLeft > 0) {
            requestAnimationFrame(gameLoop);
        } else {
            endGame();
        }
    }

    function startGame(mode) {
        gameMode = mode;
        loadingMusic.pause();
        loadingMusic.currentTime = 0;
        showScreen(gameContainer);
        gameMusic.play();
        powerLed.classList.add('on');
        score = 0;
        timeLeft = 60;
        fallingObjects = [];
        rafaPenaltyCounter = 0;
        
        resizeCanvas(); // Initial setup of sizes
        initializeRafa();

        // Reset game loop variables
        lastTime = 0;
        timeToNextObject = 0;

        // Start the loop
        requestAnimationFrame(gameLoop);
    }

    function endGame() {
        clearTimeout(rafaTimeout);
        gameMusic.pause();
        gameMusic.currentTime = 0;
        loadingMusic.play();
        powerLed.classList.remove('on');

        if (gameMode === 'code') {
            document.getElementById('final-score-with-code').textContent = score;
            document.getElementById('game-code-hidden').value = validatedGameCode;
            showScreen(rankingForm);
        } else {
            document.getElementById('final-score-normal').textContent = score;
            showScreen(gameOverNormalScreen);
        }
    }

    async function validateCodeAndPlay() {
        const codeSuffix = playerCodeInput.value.trim();
        if (codeSuffix.length !== 5) {
            alert('Por favor, introduce los 5 caracteres de tu código.');
            return;
        }
        const fullCode = `HONEY-${codeSuffix}`;
        try {
            const response = await fetch('/api/validate-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: fullCode
                })
            });
            const result = await response.json();
            if (response.ok && result.valid) {
                validatedGameCode = fullCode;
                startGame('code');
            } else {
                alert(result.message || 'Error al validar el código.');
            }
        } catch (error) {
            console.error('Error validating code:', error);
            alert('No se pudo conectar con el servidor.');
        }
    }

    async function saveScore() {
        const playerName = document.getElementById('player-name').value;
        const playerEmail = document.getElementById('player-email').value;
        const playerPhone = document.getElementById('player-phone').value;
        const gameCode = document.getElementById('game-code-hidden').value;
        if (!playerName) {
            alert('Por favor, introduce tu nombre.');
            return;
        }
        const scoreData = {
            name: playerName,
            score: score,
            email: playerEmail,
            phone: playerPhone,
            code: gameCode
        };
        try {
            const response = await fetch('/save-score', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scoreData)
            });
            if (response.ok) {
                alert(await response.text());
                showScreen(playOptionsScreen);
                await fetchRanking();
            } else {
                alert(`Error: ${await response.text()}`);
            }
        } catch (error) {
            console.error('Error sending score:', error);
            alert('Error de conexión.');
        }
    }

    async function fetchRanking() {
        try {
            const response = await fetch('/ranking');
            if (response.ok) {
                const rankingData = await response.json();
                const rankingList = document.getElementById('ranking-list');
                rankingList.innerHTML = '';
                if (rankingData.length === 0) {
                    rankingList.innerHTML = '<li style="justify-content: center;">No hay puntuaciones aún.</li>';
                } else {
                    rankingData.forEach((entry, index) => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span class="rank-position">${index + 1}.</span><span class="rank-name">${entry.name}</span><span class="rank-score">${entry.score}</span>`;
                        rankingList.appendChild(li);
                    });
                }
                rankingDisplay.style.display = 'flex';
            } else {
                alert(`Error al cargar el ranking: ${await response.text()}`);
            }
        } catch (error) {
            console.error('Error fetching ranking:', error);
            alert('Error de conexión.');
        }
    }

    // --- Rafa Logic ---
    let rafaTimeout, rafaPenaltyInterval, rafaPenaltyCounter = 0,
        rafaAppearancesCount = 0;
    const MAX_RAFA_PENALTY = 15,
        MAX_RAFA_APPEARANCES = 5;
    const rafaPhrases = ["¡Bien hecho, joven!", "¡Sigue así!", "¡Eres un crack!", "¡Imparable!", "¡Vas a por todas!", "¡Qué fiera!", "¡Así se hace!", "¡Eres una máquina!"];
    const rafaImages = ['rafa', 'rafa1', 'rafa3', 'yiyes'];

    function showRafa() {
        const randomImage = rafaImages[Math.floor(Math.random() * rafaImages.length)];
        rafa.src = assets[randomImage].src;
        const rafaWidth = rafa.offsetWidth;
        rafa.style.left = `${Math.random() * (canvas.width - rafaWidth - 20) + 10}px`;
        rafa.style.display = 'block';
        document.getElementById('rafa-notification').style.display = 'block';
        rafaPenaltyCounter = 0;
        rafaPenaltyInterval = setInterval(applyRafaPenalty, 1000);
        rafaAppearancesCount++;
    }

    function hideRafa(showPhrase = false) {
        rafa.style.display = 'none';
        document.getElementById('rafa-notification').style.display = 'none';
        document.getElementById('points-lost-notification').style.display = 'none';
        clearInterval(rafaPenaltyInterval);
        clearTimeout(rafaTimeout);

        score -= rafaPenaltyCounter; // Aplicar la penalización final
        scoreDisplay.textContent = `Puntos: ${score}`;

        if (showPhrase) {
            const phrase = rafaPhrases[Math.floor(Math.random() * rafaPhrases.length)];
            const phraseElement = document.getElementById('rafa-phrase');
            phraseElement.textContent = phrase;
            phraseElement.style.display = 'block';
            setTimeout(() => {
                phraseElement.style.display = 'none';
            }, 2000);
        }

        if (timeLeft > 10 && rafaAppearancesCount < MAX_RAFA_APPEARANCES) {
            rafaTimeout = setTimeout(showRafa, Math.random() * 10000 + 5000);
        }
    }

    function applyRafaPenalty() {
        if (rafa.style.display === 'none') return;
        if (rafaPenaltyCounter < MAX_RAFA_PENALTY) {
            rafaPenaltyCounter++;
            const notification = document.getElementById('points-lost-notification');
            notification.textContent = `-${rafaPenaltyCounter} Puntos`;
            notification.style.display = 'block';
        } else {
            hideRafa(false);
        }
    }

    function initializeRafa() {
        rafaAppearancesCount = 0;
        clearTimeout(rafaTimeout);
        if (timeLeft > 10) {
            rafaTimeout = setTimeout(showRafa, Math.random() * 15000 + 5000);
        }
    }

    // --- Initial Load ---
    async function startLoadingProcess() {
        console.log("startLoadingProcess called");
        startOverlay.style.display = 'none';
        console.log("startOverlay hidden");
        showScreen(loadingScreen);
        console.log("loadingScreen shown");
        powerLed.classList.add('on');
        loadingMusic.play();
        progressBar.style.width = '0%';

        try {
            await loadAssets(progress => {
                progressBar.style.width = `${progress * 100}%`;
            });
            console.log("Assets loaded");

        } catch (error) {
            console.error("Error during loading process:", error);
            alert("Error al cargar el juego. Por favor, recarga la página.");
            return; // Stop execution if assets fail to load
        }

        // Short delay to allow the progress bar to reach 100%
        await new Promise(resolve => setTimeout(resolve, 200));

        progressBarContainer.style.display = 'none';
        continueBtn.style.display = 'block';
        console.log("Loading process finished");
    }

    // --- App Initialization ---
    // --- Initialize DOM Elements ---
    startOverlay = document.getElementById('start-overlay');
    console.log("startOverlay element:", startOverlay);
    powerLed = document.getElementById('power-led');
    loadingScreen = document.getElementById('loading-screen');
    loadingInstructions = document.getElementById('loading-instructions');
    gameContainer = document.getElementById('game-container');
    rankingForm = document.getElementById('ranking-form');
    gameOverNormalScreen = document.getElementById('game-over-normal');
    playOptionsScreen = document.getElementById('play-options-screen');
    codeEntryScreen = document.getElementById('code-entry-screen');
    continueBtn = document.getElementById('continue-btn');
    playWithCodeBtn = document.getElementById('play-with-code-btn');
    playNormalBtn = document.getElementById('play-normal-btn');
    validateCodeBtn = document.getElementById('validate-code-btn');
    backToMenuBtn = document.getElementById('back-to-menu-btn');
    playerCodeInput = document.getElementById('player-code-input');
    saveScoreBtn = document.getElementById('save-score-btn');
    playAgainNormalBtn = document.getElementById('play-again-normal-btn');
    viewRankingBtn = document.getElementById('view-ranking-btn');
    progressBarContainer = document.getElementById('progress-bar-container');
    progressBar = document.getElementById('progress-bar');
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    rankingDisplay = document.getElementById('ranking-display');
    closeRankingBtn = document.getElementById('close-ranking');
    playAgainBtn = document.getElementById('play-again-btn');
    gameMusic = document.getElementById('gameMusic');
    gameMusic.volume = 0.3;
    loadingMusic = document.getElementById('loadingMusic');
    loadingMusic.volume = 0.3;
    aciertoSound = document.getElementById('aciertoSound');
    falloSound = document.getElementById('falloSound');
    palmadaSound = document.getElementById('palmadaSound');
    rafa = document.getElementById('rafa');
    scoreDisplay = document.getElementById('score');
    timerDisplay = document.getElementById('timer');
    muteBtn = document.getElementById('mute-btn');

    // --- Event Listeners ---
    const audioElements = [gameMusic, loadingMusic, aciertoSound, falloSound, palmadaSound];

    const toggleMute = () => {
        isMuted = !isMuted;
        audioElements.forEach(audio => {
            audio.muted = isMuted;
        });
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
    };

    muteBtn.addEventListener('click', toggleMute);
    muteBtn.addEventListener('touchstart', toggleMute);

    const continueAction = () => {
        loadingMusic.pause();
        loadingMusic.currentTime = 0;
        showScreen(playOptionsScreen);
    };
    continueBtn.addEventListener('click', continueAction);
    continueBtn.addEventListener('touchstart', continueAction);

    const playWithCodeAction = () => showScreen(codeEntryScreen);
    playWithCodeBtn.addEventListener('click', playWithCodeAction);
    playWithCodeBtn.addEventListener('touchstart', playWithCodeAction);

    validateCodeBtn.addEventListener('click', validateCodeAndPlay);
    validateCodeBtn.addEventListener('touchstart', validateCodeAndPlay);

    const backToMenuAction = () => showScreen(playOptionsScreen);
    backToMenuBtn.addEventListener('click', backToMenuAction);
    backToMenuBtn.addEventListener('touchstart', backToMenuAction);

    const playNormalAction = () => startGame('normal');
    playNormalBtn.addEventListener('click', playNormalAction);
    playNormalBtn.addEventListener('touchstart', playNormalAction);

    saveScoreBtn.addEventListener('click', saveScore);
    saveScoreBtn.addEventListener('touchstart', saveScore);

    const playAgainNormalAction = () => showScreen(playOptionsScreen);
    playAgainNormalBtn.addEventListener('click', playAgainNormalAction);
    playAgainNormalBtn.addEventListener('touchstart', playAgainNormalAction);

    const viewRankingAction = () => {
        showScreen(playOptionsScreen);
        fetchRanking();
    };
    viewRankingBtn.addEventListener('click', viewRankingAction);
    viewRankingBtn.addEventListener('touchstart', viewRankingAction);

    const closeRankingAction = () => {
        rankingDisplay.style.display = 'none';
    };
    closeRankingBtn.addEventListener('click', closeRankingAction);
    closeRankingBtn.addEventListener('touchstart', closeRankingAction);

    const playAgainAction = () => {
        rankingDisplay.style.display = 'none';
        showScreen(playOptionsScreen);
    };
    playAgainBtn.addEventListener('click', playAgainAction);
    playAgainBtn.addEventListener('touchstart', playAgainAction);

    const consoleScreen = document.getElementById('console-screen-container');

    consoleScreen.addEventListener('mousemove', (e) => {
        const rect = consoleScreen.getBoundingClientRect();
        trayX = e.clientX - rect.left - (trayWidth / 2);
        if (trayX < 0) trayX = 0;
        if (trayX > canvas.width - trayWidth) trayX = canvas.width - trayWidth;
    });

    // Touch events for mobile
    consoleScreen.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling
        const rect = consoleScreen.getBoundingClientRect();
        trayX = e.touches[0].clientX - rect.left - (trayWidth / 2);
        if (trayX < 0) trayX = 0;
        if (trayX > canvas.width - trayWidth) trayX = canvas.width - trayWidth;
    }, { passive: false });

    consoleScreen.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        const rect = consoleScreen.getBoundingClientRect();
        trayX = e.touches[0].clientX - rect.left - (trayWidth / 2);
        if (trayX < 0) trayX = 0;
        if (trayX > canvas.width - trayWidth) trayX = canvas.width - trayWidth;
    }, { passive: false });

    const rafaAction = () => {
        palmadaSound.play();
        hideRafa(true);
    };
    rafa.addEventListener('click', rafaAction);
    rafa.addEventListener('touchstart', rafaAction);

    // --- Initial Setup ---
    powerLed.classList.remove('on');
    startOverlay.addEventListener('click', startLoadingProcess);
    startOverlay.addEventListener('touchstart', startLoadingProcess); // Add touchstart for mobile
    window.addEventListener('resize', resizeCanvas);

    // --- Anti-Inspection Measures ---
    // Note: These are deterrents, not foolproof security measures.
    window.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    }, false);

    function antiDebugger() {
        debugger;
    }

    setInterval(antiDebugger, 1000);
});
