window.addEventListener('DOMContentLoaded', () => {
    // Lógica del juego JavaScript

    // --- DOM Elements ---
    let startOverlay, powerLed, loadingScreen, loadingInstructions, gameContainer, rankingForm, gameOverNormalScreen, playOptionsScreen, codeEntryScreen, continueBtn, playWithCodeBtn, playNormalBtn, validateCodeBtn, backToMenuBtn, playerCodeInput, saveScoreBtn, playAgainNormalBtn, viewRankingBtn, viewRankingMenuBtn, canvas, ctx, rankingDisplay, closeRankingBtn, playAgainBtn, gameMusic, loadingMusic, aciertoSound, falloSound, palmadaSound, rafa, scoreDisplay, timerDisplay, muteBtn;

    // --- Game State ---
    let score = 0;
    let timeLeft = 60;
    let trayX, trayWidth, trayHeight;
    let gameMode = 'normal';
    let validatedGameCode = null;
    let isMuted = false;
    let currentRankingPage = 1;
    let allRankingData = [];

    // --- Constants ---
    const INITIAL_FALL_SPEED_MIN = 100;
    const INITIAL_FALL_SPEED_MAX = 250;
    const ACCELERATION_RATE_PHASE1 = 0.005;
    const ACCELERATION_RATE_PHASE2 = 0.015;
    const PHASE2_TIME_THRESHOLD = 30;
    const BOOT_ANIMATION_DURATION = 7000;
    const BOOT_FINISH_DELAY = 200;
    const RAFA_APPEARANCE_DELAY_MIN = 5000;
    const RAFA_APPEARANCE_DELAY_MAX = 15000;
    const RAFA_APPEARANCE_GAME_DELAY_MIN = 5000;
    const RAFA_APPEARANCE_GAME_DELAY_MAX = 10000;
    const BUTTON_DEBOUNCE_DELAY = 300;
    const RAFA_PENALTY_INTERVAL = 1000;
    const RAFA_PHRASE_DISPLAY_TIME = 2000;
    const OBJECT_GENERATION_MIN = 0.5;
    const OBJECT_GENERATION_MAX = 1.5;
    const MAX_RAFA_PENALTY = 15;
    const MAX_RAFA_APPEARANCES = 5;
    const ITEMS_PER_PAGE = 10;
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    let fallingObjects = [];
    let objectSize;

    // --- Logging Helper (Dev only) ---
    const log = (...args) => { if (isDev) console.log(...args); };
    const logError = (...args) => { if (isDev) console.error(...args); };

    // --- Response Parser Helper ---
    const parseResponse = (responseText) => {
        try {
            return JSON.parse(responseText);
        } catch (jsonError) {
            return { message: responseText };
        }
    };

    // --- Button Event Helper ---
    const createButtonHandler = (action) => {
        let isActive = false;
        return () => {
            if (isActive) return;
            isActive = true;
            action();
            setTimeout(() => { isActive = false; }, BUTTON_DEBOUNCE_DELAY);
        };
    };

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
                    log(`Asset loaded: ${assetSources[key]}`);
                    loadedCount++;
                    if (onProgress) {
                        onProgress(loadedCount / numAssets);
                    }
                    resolve();
                };
                img.onerror = () => {
                    logError(`Failed to load asset: ${assetSources[key]}`);
                    reject(new Error(`Failed to load asset: ${assetSources[key]}`));
                };
                img.src = assetSources[key];
            });
            promises.push(promise);
        }
        return Promise.all(promises).then(() => {
            log('All assets loaded successfully!');
        }).catch(error => {
            logError('Error loading one or more assets:', error);
        });
    }

    function showScreen(screen) {
        document.querySelectorAll('.game-screen').forEach(s => {
            if (s.style.display !== 'none') {
                log(`Hiding screen: ${s.id}`);
                s.style.display = 'none';
            }
        });
        rankingDisplay.style.display = 'none';
        log(`Showing screen: ${screen.id}`);
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
            timeToNextObject = OBJECT_GENERATION_MIN + Math.random() * (OBJECT_GENERATION_MAX - OBJECT_GENERATION_MIN);
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

    const rankingMessages = {
        top10: [
            "¡ERES UNA LEYENDA! 🏆 ¡Los demás son hormigas!",
            "¡LLAMA A LOS MEDIOS! 📺 ¡Este es el nivel de Rafa!",
            "¡EL MEJOR DE LOS MEJORES! 👑 ¡La realeza del Honey Smash!",
            "¡DESATA EL CAOS! 🌪️ ¡Nadie te puede detener!",
            "¡HONEY SMASH SUPREMACÍA! 🍯⚡ ¡Eres IMPARABLE!",
            "¡RAFA QUIERE SER COMO TÚ! 😎 ¡Invertiste los papeles!",
            "¡VIDEOJUEGOS PROFESIONALES TE LLAMAN! 🎮👑",
            "¡PANCARTA EN EL CIELO! 🌤️ ¡MENSAJE IMPORTANTE: ¡TÚ ERES INCREÍBLE!",
            "¡HONEY SMASH HALL OF FAME! 🏅 ¡Tu nombre brilla en luces de neón!",
            "¡LOS OTROS JUGADORES TEMBLANDO! 😱 ¡Les mostraste quién manda!"
        ],
        top20: [
            "¡Muy bien, campeón! Te acercas... demasiado bien 🎯",
            "¡Casi al podio! Falta poquito, sigue así 💪",
            "¡Lo hiciste GENIAL! ¡Rafa está tomando notas! 📝",
            "¡Vas como un cohete! 🚀 ¡El top 10 tiembla!",
            "¡Que siga la fiesta! 🎉 ¡Vuelve a intentar y entra en la élite!",
            "¡Impresionante! 🌟 Dentro de poco van a hablar de ti",
            "¡BRUTAL! 🔥 Así que el top 10 se va a llevar una sorpresa...",
            "¡Cuasi-legendario! 🏆 Solo un paso más..."
        ],
        top30: [
            "¡BOOM! 🎉 ¡Entraste al ranking! ¡Felicidades!",
            "¡Sí, sí, SÍ! 🙌 ¡Estás en el Top 30! ¡Eso cuenta!",
            "¡Oficial! 📊 Tu nombre está escrito en el podio",
            "¡Lo hiciste! 🎊 Pero hey, ¿por qué no intentas mejorar?",
            "¡Entradita! 🚪 Bienvenido al club de los campeones",
            "¡Dentro del top 30! 📍 Ahora a escalar hacia la gloria",
            "¡Ey, NO está mal! 😄 ¡Vuelve e intenta romper el ranking!",
            "¡RANKING: DESBLOQUEADO! 🔓 ¡Eres oficial!"
        ],
        outside30: [
            "Ehhhh... 🍔 Quizás necesites otra Honey... ¡o doscientas!",
            "¡Ay, ay, ay! 😅 Necesitabas MUCHO más... ¡vuelve!",
            "Ummmm... 🤔 ¿Estabas jugando en modo difícil? (o era en modo *muy muy* fácil?)",
            "¡OUCH! 💔 Rafa se decepcionó un poquito...",
            "Necesitas... ehhh... ¿MUCHA más práctica? 😬 ¡Vuelve mañana!",
            "¿En serio? 😳 Los dedos temblando, ¿verdad? ¡Intenta de nuevo!",
            "¡Eso fue ÉPICO! 📺 Épicamente... MAL 😆",
            "¡Honey, necesitabas MIEL! 🍯 (¡Literalmente!)",
            "Que no cunda el pánico... 🚨 Todos empezamos así. ¡Vuelve!",
            "¡Casi casi! 🤏 (Ese 'casi' es REALMENTE casi) 😅",
            "Ummmm NO. 🛑 Definitivamente necesitas practicar más. ¡Pero vuelve! 💪",
            "¿Dormías mientras jugabas? 😴 Parece que SÍ... ¡DESPIERTA Y VUELVE!"
        ]
    };

    async function calculateRankingPosition(playerScore) {
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/ranking?nocache=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (response.ok) {
                const rankingData = await response.json();

                let position = rankingData.findIndex(entry => entry.score < playerScore) + 1;
                if (position === 0) position = rankingData.length + 1;

                const positionElement = document.getElementById('ranking-position');
                const messageElement = document.getElementById('ranking-message');
                const containerElement = document.getElementById('ranking-position-container');

                let messages, rankText;
                if (position <= 10) {
                    messages = rankingMessages.top10;
                    rankText = `🥇 ¡POSICIÓN #${position} EN EL TOP 10! 🥇`;
                } else if (position <= 20) {
                    messages = rankingMessages.top20;
                    rankText = `🥈 Posición #${position} (Top 20) 🥈`;
                } else if (position <= 30) {
                    messages = rankingMessages.top30;
                    rankText = `🥉 Posición #${position} (Top 30) 🥉`;
                } else {
                    messages = rankingMessages.outside30;
                    rankText = `Posición #${position}`;
                }

                positionElement.textContent = rankText;
                messageElement.textContent = messages[Math.floor(Math.random() * messages.length)];
                containerElement.style.display = 'block';
            } else {
                console.error(`Error calculating ranking position: HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Error calculating ranking position:', error);
        }
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
            calculateRankingPosition(score);
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
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/validate-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: fullCode
                })
            });

            const responseText = await response.text();
            const result = parseResponse(responseText);
            result.valid = result.valid || false;

            if (response.status === 403) {
                alert('❌ ¡Este código ya ha sido utilizado! \n\nNecesitas pedir un código nuevo para jugar.');
                playerCodeInput.value = '';
                return;
            }

            if (response.status === 404) {
                alert('❌ ¡El código no existe! \n\nPor favor, verifica que esté correcto.\n(Recuerda: solo los 5 caracteres después de HONEY-)');
                playerCodeInput.value = '';
                return;
            }

            if (response.ok && result.valid) {
                validatedGameCode = fullCode;
                playerCodeInput.value = '';
                startGame('code');
            } else {
                alert(`❌ Error: ${result.message || 'No se pudo validar el código.'}`);
                playerCodeInput.value = '';
            }
        } catch (error) {
            console.error('Error validating code:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('❌ Error de conexión de red. Verifica tu conexión a internet.');
            } else {
                alert(`❌ Error: ${error.message}`);
            }
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

        if (!playerPhone) {
            alert('Por favor, introduce tu teléfono.');
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
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/save-score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scoreData)
            });

            const responseText = await response.text();
            const result = parseResponse(responseText);

            if (response.status === 403) {
                alert(`❌ ${result.message || 'Este código ya ha sido utilizado.'}`);
                document.getElementById('player-name').value = '';
                document.getElementById('player-email').value = '';
                document.getElementById('player-phone').value = '';
                showScreen(playOptionsScreen);
                return;
            }

            if (response.ok) {
                const playerNameResult = result.name || document.getElementById('player-name').value;
                const scoreResult = result.score || score;
                alert(`✅ ¡Puntuación guardada! ${playerNameResult}, tu puntuación de ${scoreResult} puntos ha sido registrada.`);
                document.getElementById('player-name').value = '';
                document.getElementById('player-email').value = '';
                document.getElementById('player-phone').value = '';
                showScreen(playOptionsScreen);
                await fetchRanking();
            } else {
                alert(`❌ Error (${response.status}): ${result.message || 'No se pudo guardar la puntuación'}`);
            }
        } catch (error) {
            console.error('Error sending score:', error);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('❌ Error de conexión de red. Verifica tu conexión a internet.');
            } else {
                alert(`❌ Error: ${error.message}`);
            }
        }
    }

    function displayRankingPage(page) {
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageData = allRankingData.slice(startIndex, endIndex);
        
        const rankingList = document.getElementById('ranking-list');
        rankingList.innerHTML = '';
        
        if (pageData.length === 0) {
            rankingList.innerHTML = '<li style="justify-content: center;">No hay puntuaciones en esta página.</li>';
        } else {
            pageData.forEach((entry, index) => {
                const li = document.createElement('li');
                const position = startIndex + index + 1;
                li.innerHTML = `<span class="rank-position">${position}.</span><span class="rank-name">${entry.name}</span><span class="rank-score">${entry.score}</span>`;
                rankingList.appendChild(li);
            });
        }
        
        const totalPages = Math.ceil(allRankingData.length / ITEMS_PER_PAGE);
        document.getElementById('ranking-page-info').textContent = `Página ${page} de ${totalPages}`;
        document.getElementById('ranking-prev-btn').disabled = page === 1;
        document.getElementById('ranking-next-btn').disabled = page === totalPages;
    }

    async function fetchRanking() {
        try {
            console.log('Attempting to fetch ranking...');
            const response = await fetch('/ranking?nocache=' + Date.now(), {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            console.log('Response received:', response.status);
            const responseText = await response.text();

            if (response.ok) {
                allRankingData = JSON.parse(responseText);
                currentRankingPage = 1;
                displayRankingPage(1);
                await displayHallOfFame();
                rankingDisplay.style.display = 'flex';
                showRankingTab();
            } else {
                console.error(`HTTP Error ${response.status}: ${responseText}`);
                alert(`Error al cargar el ranking (${response.status}): ${responseText}`);
            }
        } catch (error) {
            console.error('Error fetching ranking:', error);
            console.error('Error details:', error.name, error.message);
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                alert('❌ Error de conexión de red. Verifica tu conexión a internet.');
            } else {
                alert(`❌ Error: ${error.message}`);
            }
        }
    }

    async function displayHallOfFame() {
        try {
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/halloffame?nocache=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            const responseText = await response.text();

            if (response.ok) {
                const halloffameData = JSON.parse(responseText);
                log('Hall of Fame data:', halloffameData);

                const podium = [1, 2, 3];
                podium.forEach(position => {
                    const player = halloffameData[position - 1];
                    const podiumElement = document.getElementById(`podium-${position}`);
                    if (player && player.name) {
                        podiumElement.querySelector('.podium-name').textContent = player.name.toUpperCase();
                        podiumElement.querySelector('.podium-score').textContent = `${player.score} pts`;
                        log(`Podio ${position}: ${player.name}`);
                    } else {
                        podiumElement.querySelector('.podium-name').textContent = '-';
                        podiumElement.querySelector('.podium-score').textContent = '-';
                    }
                });

                const halloffameList = document.getElementById('halloffame-list');
                halloffameList.innerHTML = '';

                if (halloffameData.length === 0) {
                    halloffameList.innerHTML = '<li style="justify-content: center;">El Hall of Fame está vacío.</li>';
                } else {
                    halloffameData.forEach((entry, index) => {
                        const li = document.createElement('li');
                        const position = index + 1;
                        li.innerHTML = `<span class="rank-position">${position}.</span><span class="rank-name">${entry.name}</span><span class="rank-score">${entry.score}</span>`;
                        halloffameList.appendChild(li);
                    });
                }
            } else {
                log(`Error al cargar el Hall of Fame: HTTP ${response.status}`);
            }
        } catch (error) {
            logError('Error fetching Hall of Fame:', error);
        }
    }

    function showRankingTab() {
        document.getElementById('ranking-view').classList.remove('hidden');
        document.getElementById('halloffame-view').classList.add('hidden');
        document.getElementById('ranking-tab-ranking').classList.add('active');
        document.getElementById('ranking-tab-halloffame').classList.remove('active');
        document.getElementById('ranking-title').textContent = '📊 Ranking Semanal';
        document.getElementById('ranking-description').textContent = 'Los mejores puntajes de esta semana. Se actualiza cada 7 días.';
    }

    function showHallOfFameTab() {
        document.getElementById('ranking-view').classList.add('hidden');
        document.getElementById('halloffame-view').classList.remove('hidden');
        document.getElementById('ranking-tab-ranking').classList.remove('active');
        document.getElementById('ranking-tab-halloffame').classList.add('active');
        document.getElementById('ranking-title').textContent = '🏆 Hall of Fame';
        document.getElementById('ranking-description').textContent = 'Los 15 mejores puntajes de TODOS LOS TIEMPOS. Estos récords permanecen para siempre.';
    }

    // --- Rafa Logic ---
    let rafaTimeout, rafaPenaltyInterval, rafaPenaltyCounter = 0,
        rafaAppearancesCount = 0;
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
        rafaPenaltyInterval = setInterval(applyRafaPenalty, RAFA_PENALTY_INTERVAL);
        rafaAppearancesCount++;
    }

    function hideRafa(showPhrase = false) {
        rafa.style.display = 'none';
        document.getElementById('rafa-notification').style.display = 'none';
        document.getElementById('points-lost-notification').style.display = 'none';
        clearInterval(rafaPenaltyInterval);
        clearTimeout(rafaTimeout);

        score -= rafaPenaltyCounter;
        scoreDisplay.textContent = `Puntos: ${score}`;

        if (showPhrase) {
            const phrase = rafaPhrases[Math.floor(Math.random() * rafaPhrases.length)];
            const phraseElement = document.getElementById('rafa-phrase');
            phraseElement.textContent = phrase;
            phraseElement.style.display = 'block';
            setTimeout(() => {
                phraseElement.style.display = 'none';
            }, RAFA_PHRASE_DISPLAY_TIME);
        }

        if (timeLeft > 10 && rafaAppearancesCount < MAX_RAFA_APPEARANCES) {
            rafaTimeout = setTimeout(showRafa, Math.random() * RAFA_APPEARANCE_GAME_DELAY_MAX + RAFA_APPEARANCE_GAME_DELAY_MIN);
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
            rafaTimeout = setTimeout(showRafa, Math.random() * RAFA_APPEARANCE_DELAY_MAX + RAFA_APPEARANCE_DELAY_MIN);
        }
    }

    // --- Initial Load ---
    async function startLoadingProcess() {
        log("startLoadingProcess called");
        startOverlay.style.display = 'none';
        log("startOverlay hidden");
        powerLed.classList.add('on');
        
        const powerOnEffect = document.getElementById('power-on-effect');
        const bootContinueBtn = document.getElementById('boot-continue-btn');
        powerOnEffect.classList.remove('hidden');
        
        await new Promise(resolve => setTimeout(resolve, BOOT_ANIMATION_DURATION));
        
        bootContinueBtn.classList.remove('hidden');
        log("Boot continue button shown");

        try {
            await loadAssets(() => {});
            log("Assets loaded");

        } catch (error) {
            logError("Error during loading process:", error);
            alert("Error al cargar el juego. Por favor, recarga la página.");
            return;
        }

        log("Loading process finished");
    }

    const proceedFromBoot = () => {
        const powerOnEffect = document.getElementById('power-on-effect');
        powerOnEffect.classList.add('fade-out');
        
        setTimeout(() => {
            powerOnEffect.classList.add('hidden');
            powerOnEffect.classList.remove('fade-out');
            showScreen(playOptionsScreen);
            loadingMusic.play();
        }, 800);
    };

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
    viewRankingMenuBtn = document.getElementById('view-ranking-menu-btn');
    const rankingPrevBtn = document.getElementById('ranking-prev-btn');
    const rankingNextBtn = document.getElementById('ranking-next-btn');
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

    let isTouchDevice = false;
    
    const addButtonEventListeners = (element, action) => {
        const handler = createButtonHandler(action);
        element.addEventListener('click', (e) => {
            if (!isTouchDevice) handler();
        });
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handler();
        });
    };
    
    const toggleMute = createButtonHandler(() => {
        isMuted = !isMuted;
        audioElements.forEach(audio => {
            audio.muted = isMuted;
        });
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    muteBtn.addEventListener('click', () => {
        if (!isTouchDevice) toggleMute();
    });
    
    muteBtn.addEventListener('touchstart', (e) => {
        isTouchDevice = true;
        e.preventDefault();
        toggleMute();
        setTimeout(() => { isTouchDevice = false; }, 500);
    });

    addButtonEventListeners(continueBtn, () => {
        loadingMusic.pause();
        loadingMusic.currentTime = 0;
        showScreen(playOptionsScreen);
    });

    addButtonEventListeners(playWithCodeBtn, () => {
        showScreen(codeEntryScreen);
    });

    addButtonEventListeners(validateCodeBtn, validateCodeAndPlay);

    addButtonEventListeners(backToMenuBtn, () => {
        showScreen(playOptionsScreen);
    });

    addButtonEventListeners(playNormalBtn, () => {
        startGame('normal');
    });

    addButtonEventListeners(saveScoreBtn, saveScore);

    addButtonEventListeners(playAgainNormalBtn, () => {
        showScreen(playOptionsScreen);
    });

    addButtonEventListeners(viewRankingBtn, fetchRanking);

    addButtonEventListeners(closeRankingBtn, () => {
        rankingDisplay.style.display = 'none';
    });

    addButtonEventListeners(playAgainBtn, () => {
        rankingDisplay.style.display = 'none';
        showScreen(playOptionsScreen);
    });

    addButtonEventListeners(viewRankingMenuBtn, fetchRanking);

    const bootContinueBtn = document.getElementById('boot-continue-btn');
    addButtonEventListeners(bootContinueBtn, proceedFromBoot);

    rankingPrevBtn.addEventListener('click', () => {
        if (currentRankingPage > 1) {
            currentRankingPage--;
            displayRankingPage(currentRankingPage);
        }
    });

    rankingNextBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(allRankingData.length / ITEMS_PER_PAGE);
        if (currentRankingPage < totalPages) {
            currentRankingPage++;
            displayRankingPage(currentRankingPage);
        }
    });

    const rankingTabRanking = document.getElementById('ranking-tab-ranking');
    const rankingTabHallOfFame = document.getElementById('ranking-tab-halloffame');

    rankingTabRanking.addEventListener('click', showRankingTab);
    rankingTabHallOfFame.addEventListener('click', showHallOfFameTab);

    const consoleScreen = document.getElementById('console-screen-container');

    const updateTrayPosition = (clientX) => {
        const rect = consoleScreen.getBoundingClientRect();
        trayX = clientX - rect.left - (trayWidth / 2);
        if (trayX < 0) trayX = 0;
        if (trayX > canvas.width - trayWidth) trayX = canvas.width - trayWidth;
    };

    const isInteractiveElement = (element) => {
        const tagName = element.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'button' || tagName === 'a' || 
               element.classList.contains('menu-button') ||
               element.id === 'rafa' ||
               element.id === 'mute-btn';
    };

    consoleScreen.addEventListener('mousemove', (e) => {
        updateTrayPosition(e.clientX);
    });

    consoleScreen.addEventListener('touchstart', (e) => {
        if (!isInteractiveElement(e.target)) {
            e.preventDefault();
        }
        
        if (gameContainer.style.display === 'flex') {
            updateTrayPosition(e.touches[0].clientX);
        }
    }, { passive: false });

    consoleScreen.addEventListener('touchmove', (e) => {
        if (!isInteractiveElement(e.target)) {
            e.preventDefault();
        }
        
        if (gameContainer.style.display === 'flex') {
            updateTrayPosition(e.touches[0].clientX);
        }
    }, { passive: false });

    const rafaAction = () => {
        palmadaSound.play();
        hideRafa(true);
    };
    rafa.addEventListener('click', rafaAction);
    rafa.addEventListener('touchstart', rafaAction);

    // --- Initial Setup ---
    powerLed.classList.remove('on');
    let isBootAnimating = false;
    startOverlay.addEventListener('click', (e) => {
        if (!isBootAnimating) {
            isBootAnimating = true;
            const powerOnEffect = document.getElementById('power-on-effect');
            document.querySelectorAll('.game-screen').forEach(screen => {
                if (screen.id !== 'power-on-effect') {
                    screen.style.display = 'none';
                }
            });
            startLoadingProcess();
        }
    });
    startOverlay.addEventListener('touchstart', (e) => {
        if (!isBootAnimating) {
            isBootAnimating = true;
            const powerOnEffect = document.getElementById('power-on-effect');
            document.querySelectorAll('.game-screen').forEach(screen => {
                if (screen.id !== 'power-on-effect') {
                    screen.style.display = 'none';
                }
            });
            startLoadingProcess();
        }
    });
    window.addEventListener('resize', resizeCanvas);

});
