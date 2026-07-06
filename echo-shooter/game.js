(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const STEP = 1 / 60;

  const overlayEl = document.getElementById("overlay");
  const overlayPromptEl = document.getElementById("overlay-prompt");
  const hudScoreEl = document.getElementById("hud-score");
  const hudWaveEl = document.getElementById("hud-wave");
  const hudHpEl = document.getElementById("hud-hp");
  const hudEchoesEl = document.getElementById("hud-echoes");

  // ---- echo configuration -------------------------------------------------
  const ECHO_DEFS = [
    { delay: 4.0, color: "rgba(120, 200, 255, 0.55)", trail: "rgba(120, 200, 255, 0.18)", unlockWave: 0, label: "ECHO-1" },
    { delay: 7.5, color: "rgba(255, 170, 120, 0.55)", trail: "rgba(255, 170, 120, 0.18)", unlockWave: 2, label: "ECHO-2" },
  ];

  // ---- wave script (time-based, deterministic) ----------------------------
  const WAVES = [
    {
      duration: 16,
      spawns: [
        { t: 1.0, type: "grunt", x: 110 },
        { t: 1.0, type: "grunt", x: 370 },
        { t: 4.5, type: "zigzag", x: 240 },
        { t: 7.5, type: "grunt", x: 150 },
        { t: 7.5, type: "grunt", x: 330 },
        { t: 11.0, type: "shooter", x: 240 },
        { t: 13.5, type: "grunt", x: 90 },
        { t: 13.5, type: "grunt", x: 390 },
      ],
    },
    {
      duration: 18,
      spawns: [
        { t: 1.0, type: "zigzag", x: 140 },
        { t: 1.0, type: "zigzag", x: 340 },
        { t: 4.0, type: "shooter", x: 160 },
        { t: 4.0, type: "shooter", x: 320 },
        { t: 8.0, type: "grunt", x: 100 },
        { t: 8.3, type: "grunt", x: 180 },
        { t: 8.6, type: "grunt", x: 300 },
        { t: 8.9, type: "grunt", x: 380 },
        { t: 13.0, type: "zigzag", x: 240 },
        { t: 14.5, type: "shooter", x: 240 },
      ],
    },
    {
      duration: 20,
      spawns: [
        { t: 1.0, type: "shooter", x: 100 },
        { t: 1.0, type: "shooter", x: 380 },
        { t: 5.0, type: "grunt", x: 240 },
        { t: 5.3, type: "grunt", x: 200 },
        { t: 5.6, type: "grunt", x: 280 },
        { t: 9.0, type: "zigzag", x: 130 },
        { t: 9.0, type: "zigzag", x: 350 },
        { t: 13.0, type: "shooter", x: 240 },
        { t: 16.0, type: "grunt", x: 80 },
        { t: 16.0, type: "grunt", x: 400 },
        { t: 16.4, type: "zigzag", x: 240 },
      ],
    },
    {
      duration: 22,
      spawns: [
        { t: 1.0, type: "zigzag", x: 100 },
        { t: 1.0, type: "zigzag", x: 380 },
        { t: 1.0, type: "shooter", x: 240 },
        { t: 6.0, type: "grunt", x: 120 },
        { t: 6.2, type: "grunt", x: 200 },
        { t: 6.4, type: "grunt", x: 280 },
        { t: 6.6, type: "grunt", x: 360 },
        { t: 11.0, type: "shooter", x: 140 },
        { t: 11.0, type: "shooter", x: 340 },
        { t: 15.0, type: "zigzag", x: 240 },
        { t: 18.0, type: "grunt", x: 90 },
        { t: 18.0, type: "grunt", x: 240 },
        { t: 18.0, type: "grunt", x: 390 },
      ],
    },
    {
      duration: 24,
      spawns: [
        { t: 1.0, type: "shooter", x: 90 },
        { t: 1.0, type: "shooter", x: 240 },
        { t: 1.0, type: "shooter", x: 390 },
        { t: 6.0, type: "zigzag", x: 140 },
        { t: 6.0, type: "zigzag", x: 340 },
        { t: 9.0, type: "grunt", x: 100 },
        { t: 9.3, type: "grunt", x: 180 },
        { t: 9.6, type: "grunt", x: 300 },
        { t: 9.9, type: "grunt", x: 380 },
        { t: 14.0, type: "shooter", x: 160 },
        { t: 14.0, type: "shooter", x: 320 },
        { t: 18.0, type: "zigzag", x: 240 },
        { t: 20.5, type: "grunt", x: 120 },
        { t: 20.5, type: "grunt", x: 240 },
        { t: 20.5, type: "grunt", x: 360 },
      ],
    },
    {
      duration: Infinity, // boss wave ends when the boss dies
      spawns: [{ t: 1.0, type: "boss", x: 240 }],
    },
  ];

  const ENEMY_STATS = {
    grunt: { hp: 1, radius: 12, score: 10, color: "#ff7a7a" },
    zigzag: { hp: 2, radius: 12, score: 20, color: "#ffd479" },
    shooter: { hp: 3, radius: 14, score: 30, color: "#c98bff" },
    boss: { hp: 160, radius: 46, score: 2000, color: "#ff4d6d" },
  };

  // ---- mutable game state ---------------------------------------------------
  let state = "title"; // title | playing | gameover | clear
  let keys = new Set();
  let starField = [];

  let player, history, echoes, bullets, enemyBullets, enemies, particles;
  let frameCount, score, waveIndex, waveTimer, hitFlash, invuln;

  function resetGame() {
    player = { x: WIDTH / 2, y: HEIGHT - 90, hp: 5, fireCooldown: 0 };
    history = [];
    echoes = ECHO_DEFS.map((def) => ({ def, x: player.x, y: player.y, active: false, unlockFrame: null }));
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    frameCount = 0;
    score = 0;
    waveIndex = 0;
    waveTimer = 0;
    hitFlash = 0;
    invuln = 0;
    spawnedThisWave = new Set();
  }

  let spawnedThisWave = new Set();

  for (let i = 0; i < 90; i++) {
    starField.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, speed: 40 + Math.random() * 90, r: Math.random() * 1.6 + 0.4 });
  }

  window.addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if ((e.key === " " || e.key === "Enter") && (state === "title" || state === "gameover" || state === "clear")) {
      startGame();
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) keys.clear();
  });

  function startGame() {
    resetGame();
    state = "playing";
    overlayEl.classList.add("hidden");
  }

  function isDown(...names) {
    return names.some((n) => keys.has(n));
  }

  // ---- update ---------------------------------------------------------------
  function update(dt) {
    frameCount++;
    updateStars(dt);
    if (state !== "playing") return;

    updatePlayer(dt);
    recordHistory();
    updateEchoes(dt);
    updateBullets(dt);
    updateEnemies(dt);
    updateWave(dt);
    updateParticles(dt);
    if (hitFlash > 0) hitFlash -= dt;
    if (invuln > 0) invuln -= dt;

    if (player.hp <= 0 && state === "playing") {
      state = "gameover";
      showOverlay("GAME OVER", `SCORE: ${score}`, "Press SPACE / ENTER to retry");
    }
  }

  function updateStars(dt) {
    for (const s of starField) {
      s.y += s.speed * dt;
      if (s.y > HEIGHT) {
        s.y = 0;
        s.x = Math.random() * WIDTH;
      }
    }
  }

  function updatePlayer(dt) {
    const speed = 240;
    let vx = 0, vy = 0;
    if (isDown("arrowleft", "a")) vx -= 1;
    if (isDown("arrowright", "d")) vx += 1;
    if (isDown("arrowup", "w")) vy -= 1;
    if (isDown("arrowdown", "s")) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    player.x = clamp(player.x + vx * speed * dt, 16, WIDTH - 16);
    player.y = clamp(player.y + vy * speed * dt, 60, HEIGHT - 20);

    player.fireCooldown -= dt;
    player.fired = false;
    if (isDown(" ", "z") && player.fireCooldown <= 0) {
      player.fireCooldown = 0.14;
      player.fired = true;
      bullets.push({ x: player.x, y: player.y - 18, vy: -480, from: "player" });
    }
  }

  function recordHistory() {
    history.push({ x: player.x, y: player.y, fired: player.fired });
  }

  function updateEchoes(dt) {
    for (const echo of echoes) {
      const unlocked = waveIndex >= echo.def.unlockWave;
      if (!unlocked) {
        echo.active = false;
        echo.unlockFrame = null;
        continue;
      }
      if (echo.unlockFrame === null) echo.unlockFrame = history.length;
      const delayFrames = Math.round(echo.def.delay / STEP);
      const idx = history.length - 1 - delayFrames;
      if (idx < echo.unlockFrame) {
        echo.active = false;
        continue;
      }
      echo.active = true;
      const rec = history[idx];
      echo.x = rec.x;
      echo.y = rec.y;
      if (rec.fired) {
        bullets.push({ x: echo.x, y: echo.y - 18, vy: -480, from: "echo", color: echo.def.color });
      }
      if (frameCount % 4 === 0) {
        particles.push({ x: echo.x, y: echo.y + 12, life: 0.4, r: 3, color: echo.def.trail });
      }
    }
  }

  function updateBullets(dt) {
    for (const b of bullets) b.y += b.vy * dt;
    bullets = bullets.filter((b) => b.y > -20 && b.y < HEIGHT + 20);

    for (const b of enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    enemyBullets = enemyBullets.filter((b) => b.x > -20 && b.x < WIDTH + 20 && b.y > -20 && b.y < HEIGHT + 20);

    if (invuln <= 0) {
      for (const b of enemyBullets) {
        if (dist(b.x, b.y, player.x, player.y) < 10) {
          hitPlayer();
          b.dead = true;
        }
      }
      enemyBullets = enemyBullets.filter((b) => !b.dead);
    }
  }

  function hitPlayer() {
    player.hp -= 1;
    hitFlash = 0.25;
    invuln = 1.0;
  }

  function updateEnemies(dt) {
    for (const en of enemies) {
      const stats = ENEMY_STATS[en.type];
      switch (en.type) {
        case "grunt":
          en.y += 90 * dt;
          break;
        case "zigzag":
          en.y += 75 * dt;
          en.phase += dt * 3;
          en.x = clamp(en.baseX + Math.sin(en.phase) * 80, 20, WIDTH - 20);
          break;
        case "shooter":
          if (en.y < en.targetY) en.y += 70 * dt;
          en.fireTimer -= dt;
          if (en.y >= en.targetY && en.fireTimer <= 0) {
            en.fireTimer = 1.4;
            const ang = Math.atan2(player.y - en.y, player.x - en.x);
            enemyBullets.push({ x: en.x, y: en.y, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210 });
          }
          break;
        case "boss":
          if (en.y < 130) en.y += 60 * dt;
          en.phase += dt;
          en.x = clamp(240 + Math.sin(en.phase * 0.6) * 160, 60, WIDTH - 60);
          en.fireTimer -= dt;
          if (en.y >= 128 && en.fireTimer <= 0) {
            en.fireTimer = 0.9;
            const spread = 5;
            for (let i = 0; i < spread; i++) {
              const ang = Math.PI / 2 + (i - (spread - 1) / 2) * 0.28;
              enemyBullets.push({ x: en.x, y: en.y + 20, vx: Math.cos(ang) * 190, vy: Math.sin(ang) * 190 });
            }
          }
          break;
      }

      // contact damage with player
      if (invuln <= 0 && dist(en.x, en.y, player.x, player.y) < stats.radius + 10) {
        hitPlayer();
      }

      // bullets hitting this enemy
      for (const b of bullets) {
        if (b.dead) continue;
        if (dist(b.x, b.y, en.x, en.y) < stats.radius + 4) {
          en.hp -= 1;
          b.dead = true;
        }
      }
    }

    bullets = bullets.filter((b) => !b.dead);

    for (const en of enemies) {
      if (en.hp <= 0) {
        score += ENEMY_STATS[en.type].score;
        for (let i = 0; i < 10; i++) {
          particles.push({
            x: en.x,
            y: en.y,
            life: 0.5,
            r: 2 + Math.random() * 2,
            color: ENEMY_STATS[en.type].color,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
          });
        }
        if (en.type === "boss") {
          state = "clear";
          showOverlay("MISSION CLEAR", `SCORE: ${score}`, "Press SPACE / ENTER to play again");
        }
      }
    }
    enemies = enemies.filter((en) => en.hp > 0 && en.y < HEIGHT + 60);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      if (p.vx) p.x += p.vx * dt;
      if (p.vy) p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function updateWave(dt) {
    const wave = WAVES[waveIndex];
    if (!wave) return;
    waveTimer += dt;

    for (const s of wave.spawns) {
      const key = `${waveIndex}:${s.t}:${s.x}:${s.type}`;
      if (waveTimer >= s.t && !spawnedThisWave.has(key)) {
        spawnedThisWave.add(key);
        spawnEnemy(s.type, s.x);
      }
    }

    const isBossWave = wave.duration === Infinity;
    if (!isBossWave && waveTimer >= wave.duration && waveIndex < WAVES.length - 1) {
      waveIndex++;
      waveTimer = 0;
      spawnedThisWave = new Set();
    }
  }

  function spawnEnemy(type, x) {
    const stats = ENEMY_STATS[type];
    const base = { type, x, y: -30, hp: stats.hp, phase: Math.random() * Math.PI * 2, baseX: x, fireTimer: 1.2, targetY: 120 + Math.random() * 80 };
    enemies.push(base);
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x1 - x2, y1 - y2);
  }

  // ---- render -----------------------------------------------------------
  function render() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#050610";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "rgba(200, 210, 255, 0.7)";
    for (const s of starField) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === "playing" || state === "gameover" || state === "clear") {
      drawParticles();
      drawEnemies();
      drawEnemyBullets();
      drawBullets();
      drawEchoes();
      drawPlayer();
    }

    if (hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 60, 80, ${Math.min(0.35, hitFlash)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    updateHud();
  }

  function drawPlayer() {
    if (player.hp <= 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (invuln > 0 && Math.floor(invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#7dfcff";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(11, 14);
    ctx.lineTo(0, 7);
    ctx.lineTo(-11, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEchoes() {
    for (const echo of echoes) {
      if (!echo.active) continue;
      ctx.save();
      ctx.translate(echo.x, echo.y);
      ctx.fillStyle = echo.def.color;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 12);
      ctx.lineTo(0, 6);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.fillStyle = b.from === "player" ? "#c9fff0" : b.color || "#9db3ff";
      ctx.fillRect(b.x - 2, b.y - 6, 4, 10);
    }
  }

  function drawEnemyBullets() {
    ctx.fillStyle = "#ff5d7a";
    for (const b of enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemies() {
    for (const en of enemies) {
      const stats = ENEMY_STATS[en.type];
      ctx.fillStyle = stats.color;
      ctx.beginPath();
      ctx.arc(en.x, en.y, stats.radius, 0, Math.PI * 2);
      ctx.fill();
      if (en.type === "boss") {
        ctx.strokeStyle = "#fff3";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(en.x, en.y, stats.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        drawBossHpBar(en);
      }
    }
  }

  function drawBossHpBar(boss) {
    const stats = ENEMY_STATS.boss;
    const w = 300;
    ctx.fillStyle = "#222";
    ctx.fillRect(WIDTH / 2 - w / 2, 24, w, 8);
    ctx.fillStyle = "#ff4d6d";
    ctx.fillRect(WIDTH / 2 - w / 2, 24, w * Math.max(0, boss.hp / stats.hp), 8);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateHud() {
    hudScoreEl.textContent = `SCORE: ${score}`;
    const waveNum = Math.min(waveIndex + 1, WAVES.length);
    hudWaveEl.textContent = waveIndex === WAVES.length - 1 ? `WAVE: BOSS` : `WAVE: ${waveNum} / ${WAVES.length}`;
    hudHpEl.textContent = "HP: " + "♥".repeat(Math.max(0, player ? player.hp : 0));

    hudEchoesEl.innerHTML = "";
    if (state === "playing") {
      echoes.forEach((echo) => {
        const span = document.createElement("span");
        if (waveIndex < echo.def.unlockWave) {
          span.textContent = `${echo.def.label}: locked`;
        } else if (!echo.active) {
          const delayFrames = Math.round(echo.def.delay / STEP);
          const unlockFrame = echo.unlockFrame ?? history.length;
          const remainFrames = unlockFrame + delayFrames + 1 - history.length;
          const remain = Math.max(0, remainFrames * STEP);
          span.textContent = `${echo.def.label}: incoming ${remain.toFixed(1)}s`;
        } else {
          span.textContent = `${echo.def.label}: active`;
        }
        hudEchoesEl.appendChild(span);
      });
    }
  }

  function showOverlay(title, scoreLine, prompt) {
    overlayEl.innerHTML = "";
    const h1 = document.createElement("h1");
    h1.textContent = title;
    overlayEl.appendChild(h1);
    if (scoreLine) {
      const p = document.createElement("p");
      p.className = "score-line";
      p.textContent = scoreLine;
      overlayEl.appendChild(p);
    }
    const promptEl = document.createElement("p");
    promptEl.className = "prompt";
    promptEl.textContent = prompt;
    overlayEl.appendChild(promptEl);
    overlayEl.classList.remove("hidden");
  }

  // ---- main loop --------------------------------------------------------
  let lastTime = null;
  let acc = 0;

  function frame(t) {
    if (lastTime === null) lastTime = t;
    let dt = (t - lastTime) / 1000;
    lastTime = t;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }

  resetGame();
  requestAnimationFrame(frame);
})();
