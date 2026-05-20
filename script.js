const bgCanvas = document.getElementById('bgCanvas');
const bctx = bgCanvas.getContext('2d');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let score = 0, activeGame = "", gameLoopReq;
const SHAPES = [
    [[1,1,1,1]], 
    [[1,1,1],[0,1,0]], 
    [[1,1],[1,1]], 
    [[0,1,1],[1,1,0]], 
    [[1,1,0],[0,1,1]], 
    [[1,0,0],[1,1,1]]
];

let settings = {
    volume: 0.5,
    sensitivity: 1.0,
    controlType: 'pc'
};

let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type) {
    if (!audioCtx || settings.volume === 0) return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(settings.volume * 0.2, audioCtx.currentTime);

        if (type === 'score') {
            osc.frequency.setValueAtTime(587, audioCtx.currentTime);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'fail') {
            osc.frequency.setValueAtTime(220, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(); osc.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'jump') {
            osc.frequency.setValueAtTime(360, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(650, audioCtx.currentTime + 0.12);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        }
    } catch(e) { console.log(e); }
}

/** --- ORQA FON ANIMATSIYASI --- **/
let bgParticles = [];
function resize() { bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight; }
window.onresize = resize; resize();

function drawBackground() {
    bctx.fillStyle = '#020206';
    bctx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    if(bgParticles.length < 20 && Math.random() < 0.03) {
        bgParticles.push({
            x: Math.random() * bgCanvas.width, y: -100,
            shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
            speed: 0.4 + Math.random() * 0.7, rot: Math.random() * 6,
            rs: (Math.random() - 0.5) * 0.01, size: 20,
            color: `hsla(${Math.random() * 40 + 190}, 80%, 50%, 0.08)`
        });
    }
    bgParticles.forEach((p, i) => {
        p.y += p.speed; p.rot += p.rs;
        bctx.save(); bctx.translate(p.x, p.y); bctx.rotate(p.rot); bctx.strokeStyle = p.color;
        p.shape.forEach((row, ry) => row.forEach((v, rx) => { if(v) bctx.strokeRect(rx * p.size, ry * p.size, p.size, p.size); }));
        bctx.restore(); if(p.y > bgCanvas.height + 100) bgParticles.splice(i, 1);
    });
    requestAnimationFrame(drawBackground);
}
drawBackground();

/** --- SOZLAMALAR VA MENYU INTERFEYSI --- **/
const modal = document.getElementById('settingsModal');
document.getElementById('openSettingsBtn').onclick = () => { modal.style.display = 'flex'; };

document.getElementById('closeSettingsBtn').onclick = () => {
    settings.volume = parseFloat(document.getElementById('volumeControl').value);
    settings.sensitivity = parseFloat(document.getElementById('sensControl').value);
    settings.controlType = document.getElementById('controlType').value;
    modal.style.display = 'none';
};

document.getElementById('volumeControl').oninput = (e) => {
    document.getElementById('volValue').innerText = Math.round(e.target.value * 100) + "%";
};
document.getElementById('sensControl').oninput = (e) => {
    document.getElementById('sensValue').innerText = "x" + parseFloat(e.target.value).toFixed(1);
};

document.getElementById('card-snake').onclick = () => launch('snake');
document.getElementById('card-tetris').onclick = () => launch('tetris');
document.getElementById('card-flappy').onclick = () => launch('flappy');
document.getElementById('exitGameBtn').onclick = () => exitGame();

function launch(name) {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    cancelAnimationFrame(gameLoopReq);
    document.getElementById('menuScreen').style.display = 'none';
    document.getElementById('gameWrapper').style.display = 'flex';
    
    const dpad = document.getElementById('mobileControls');
    if (settings.controlType === 'mobile' && (name === 'snake' || name === 'tetris')) {
        dpad.style.display = 'flex';
    } else {
        dpad.style.display = 'none';
    }

    activeGame = name; score = 0; updateScore();
    if(name === 'snake') initSnake();
    if(name === 'tetris') initTetris();
    if(name === 'flappy') initFlappy();
}

function gameOver() {
    playSound('fail');
    setTimeout(() => {
        alert("O'YIN TUGADI!\nSiz to'plagan jami xol: " + score);
        exitGame();
    }, 50);
}

function exitGame() {
    activeGame = "";
    cancelAnimationFrame(gameLoopReq);
    document.getElementById('gameWrapper').style.display = 'none';
    document.getElementById('menuScreen').style.display = 'flex';
    window.onkeydown = null;
    canvas.onclick = null;
    canvas.ontouchstart = null;
}

function updateScore() { document.getElementById('scoreLabel').innerText = "XOL: " + score; }

/** --- 1. ILONCHA (SNAKE) --- **/
function initSnake() {
    canvas.width = 400; canvas.height = 400;
    document.getElementById('gameTitle').innerText = "ILONCHA";
    let snake = [{x:10, y:10}, {x:9, y:10}, {x:8, y:10}], dir = {x:1, y:0}, nextDir = {x:1, y:0}, food = {}, lastTime = 0;
    
    function placeFood() {
        let valid = false;
        while(!valid) {
            food = { x: Math.floor(Math.random()*20), y: Math.floor(Math.random()*20) };
            valid = !snake.some(p => p.x === food.x && p.y === food.y);
        }
    }
    placeFood();

    const changeDir = (type) => {
        if(type==='up' && dir.y===0) nextDir={x:0, y:-1};
        if(type==='down' && dir.y===0) nextDir={x:0, y:1};
        if(type==='left' && dir.x===0) nextDir={x:-1, y:0};
        if(type==='right' && dir.x===0) nextDir={x:1, y:0};
    };

    window.onkeydown = (e) => {
        if(e.key==='ArrowUp' || e.key==='w') changeDir('up');
        if(e.key==='ArrowDown' || e.key==='s') changeDir('down');
        if(e.key==='ArrowLeft' || e.key==='a') changeDir('left');
        if(e.key==='ArrowRight' || e.key==='d') changeDir('right');
    };

    document.getElementById('padUp').onclick = () => changeDir('up');
    document.getElementById('padDown').onclick = () => changeDir('down');
    document.getElementById('padLeft').onclick = () => changeDir('left');
    document.getElementById('padRight').onclick = () => changeDir('right');

    function loop(t) {
        if(activeGame !== 'snake') return;
        gameLoopReq = requestAnimationFrame(loop);
        
        let interval = 150 / settings.sensitivity;
        if(t - lastTime < interval) return;
        lastTime = t; dir = nextDir;
        
        let head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
        if(head.x<0 || head.x>=20 || head.y<0 || head.y>=20 || snake.some(s=>s.x===head.x && s.y===head.y)) return gameOver();
        
        snake.unshift(head);
        if(head.x===food.x && head.y===food.y) { score+=10; updateScore(); playSound('score'); placeFood(); } else snake.pop();
        
        ctx.fillStyle = '#020208'; ctx.fillRect(0,0,400,400);
        
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff0055';
        ctx.fillStyle = '#ff0055'; ctx.beginPath(); ctx.arc(food.x*20+10, food.y*20+10, 8, 0, 7); ctx.fill();
        
        ctx.shadowColor = '#00f2ff';
        snake.forEach((p, i) => { 
            ctx.shadowBlur = i === 0 ? 15 : 0;
            ctx.fillStyle = i===0 ? '#00f2ff':'#0066ff'; 
            ctx.fillRect(p.x*20+1, p.y*20+1, 18, 18); 
        });
        ctx.shadowBlur = 0;
    }
    gameLoopReq = requestAnimationFrame(loop);
}

/** --- 2. TETRIS --- **/
function initTetris() {
    canvas.width = 240; canvas.height = 400;
    document.getElementById('gameTitle').innerText = "TETRIS";
    const ROWS=20, COLS=12, S=20;
    let grid = Array.from({length: ROWS}, () => Array(COLS).fill(0)), lastTime=0, dropCounter=0;
    let player = { pos: {x: 4, y: 0}, matrix: SHAPES[Math.floor(Math.random()*6)], color: '#00f2ff' };
    
    function collide(g, p) {
        for(let y=0; y<p.matrix.length; y++) for(let x=0; x<p.matrix[y].length; x++) 
            if(p.matrix[y][x] && (g[y + p.pos.y] && g[y + p.pos.y][x + p.pos.x]) !== 0) return true;
        return false;
    }

    function rotate() {
        let old = player.matrix; player.matrix = player.matrix[0].map((_, i) => player.matrix.map(row => row[i]).reverse());
        if(collide(grid, player)) player.matrix = old;
    }

    window.onkeydown = (e) => {
        if(e.key==='ArrowLeft' || e.key==='a') { player.pos.x--; if(collide(grid, player)) player.pos.x++; }
        if(e.key==='ArrowRight' || e.key==='d') { player.pos.x++; if(collide(grid, player)) player.pos.x--; }
        if(e.key==='ArrowDown' || e.key==='s') { player.pos.y++; if(collide(grid, player)) player.pos.y--; }
        if(e.key==='ArrowUp' || e.key==='w') rotate();
    };

    document.getElementById('padLeft').onclick = () => { player.pos.x--; if(collide(grid, player)) player.pos.x++; };
    document.getElementById('padRight').onclick = () => { player.pos.x++; if(collide(grid, player)) player.pos.x--; };
    document.getElementById('padDown').onclick = () => { player.pos.y++; if(collide(grid, player)) player.pos.y--; };
    document.getElementById('padUp').onclick = () => rotate();

    function loop(t=0) {
        if(activeGame !== 'tetris') return;
        let dt = t - lastTime; lastTime = t; 
        dropCounter += dt * settings.sensitivity;
        
        if(dropCounter > 800) {
            player.pos.y++;
            if(collide(grid, player)) {
                player.pos.y--;
                player.matrix.forEach((row, y) => row.forEach((v, x) => { if(v) grid[y+player.pos.y][x+player.pos.x] = player.color; }));
                player.matrix = SHAPES[Math.floor(Math.random()*6)]; player.pos = {x:4, y:0};
                player.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
                if(collide(grid, player)) return gameOver();
                
                outer: for(let y=ROWS-1; y>=0; y--) { 
                    for(let x=0; x<COLS; x++) if(!grid[y][x]) continue outer; 
                    grid.splice(y,1); grid.unshift(Array(COLS).fill(0)); 
                    score+=100; updateScore(); playSound('score'); y++; 
                }
            }
            dropCounter = 0;
        }
        ctx.fillStyle = '#020208'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        grid.forEach((row, y) => row.forEach((v, x) => { 
            if(v) { ctx.fillStyle=v; ctx.shadowBlur = 10; ctx.shadowColor = v; ctx.fillRect(x*S+1, y*S+1, S-2, S-2); } 
        }));
        
        ctx.fillStyle = player.color; ctx.shadowBlur = 10; ctx.shadowColor = player.color;
        player.matrix.forEach((row, y) => row.forEach((v, x) => { if(v) ctx.fillRect((x+player.pos.x)*S+1, (y+player.pos.y)*S+1, S-2, S-2); }));
        ctx.shadowBlur = 0;
        
        gameLoopReq = requestAnimationFrame(loop);
    }
    loop();
}

/** --- 3. FLAPPY BIRD --- **/
function initFlappy() {
    canvas.width = 320; canvas.height = 480;
    document.getElementById('gameTitle').innerText = "FLAPPY BIRD";
    let bird = { y: 240, v: 0, angle: 0 }, pipes = [], frame = 0;

    function drawLaser(x, y, h, type) {
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff0055';
        ctx.fillStyle = 'rgba(255, 0, 85, 0.15)';
        ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 2;
        ctx.fillRect(x, type === 'top' ? 0 : y, 40, h);
        ctx.strokeRect(x, type === 'top' ? 0 : y, 40, h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 2, type === 'top' ? h - 8 : y, 44, 8);
    }

    function loop() {
        if(activeGame !== 'flappy') return;
        
        bird.v += 0.23; 
        bird.y += bird.v;
        bird.angle = Math.min(Math.PI/4, Math.max(-Math.PI/8, bird.v * 0.08));

        let sky = ctx.createLinearGradient(0, 0, 0, 480); 
        sky.addColorStop(0, '#04020f'); sky.addColorStop(1, '#140c30');
        ctx.fillStyle = sky; ctx.fillRect(0,0,320,480);

        if(frame++ % 90 === 0) {
            let h = Math.random() * 180 + 60;
            pipes.push({ x: 320, top: h, bottom: h + 135 });
        }

        pipes.forEach((p, i) => {
            p.x -= 2.2;
            drawLaser(p.x, 0, p.top, 'top');
            drawLaser(p.x, p.bottom, 480 - p.bottom, 'bottom');
            if(p.x < -50) { pipes.splice(i, 1); score++; updateScore(); playSound('score'); }
            if(50+11 > p.x && 50-11 < p.x+40 && (bird.y-11 < p.top || bird.y+11 > p.bottom)) gameOver();
        });

        ctx.save(); ctx.translate(50, bird.y); ctx.rotate(bird.angle);
        ctx.shadowBlur = 15; ctx.shadowColor = '#00f2ff';
        ctx.fillStyle = '#00f2ff'; ctx.beginPath(); ctx.arc(0,0,12,0,7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4,-3,3,0,7); ctx.fill();
        ctx.fillStyle = '#0055ff'; ctx.fillRect(-10, -2, 6, 4);
        ctx.restore(); ctx.shadowBlur = 0;

        if(bird.y > 480 || bird.y < 0) gameOver();
        gameLoopReq = requestAnimationFrame(loop);
    }
    
    const jump = (e) => {
        if (e && e.target && e.target.id === "exitGameBtn") return;
        if(activeGame === 'flappy') { bird.v = -5.0; playSound('jump'); }
    };
    
    canvas.onclick = jump;
    canvas.ontouchstart = jump;
    
    window.onkeydown = (e) => { if(e.key === ' ' || e.key === 'ArrowUp') jump(); };
    loop();
}