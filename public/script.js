let time = 0;
let isRunning = false;
let laps = [];
let startTime = null;
let interval;

function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
}

function saveSession() {
  const sessions = JSON.parse(localStorage.getItem('elapse_sessions') || '[]');
  sessions.push({ timestamp: new Date().toISOString(), laps, totalTime: time });
  localStorage.setItem('elapse_sessions', JSON.stringify(sessions));
}

function getSessions() {
  return JSON.parse(localStorage.getItem('elapse_sessions') || '[]');
}

function clearStorage() {
  localStorage.removeItem('elapse_sessions');
  localStorage.removeItem('timer_state');
  loadDataTab();
}

function updateTimer() {
  if (isRunning) {
    time = Date.now() - startTime; // Calculate time from startTime only
    const display = document.querySelector('#timer-display');
    if (display) {
      display.textContent = formatTime(time);
    }
  }
}

function toggleTimer() {
  isRunning = !isRunning;
  const startButton = document.querySelector('#start-button');
  const lapButton = document.querySelector('#lap-button');
  startButton.textContent = isRunning ? 'Pause' : 'Start';
  lapButton.disabled = !isRunning;
  if (isRunning) {
    startTime = Date.now() - time; // Adjust startTime to account for current time
    localStorage.setItem('timer_state', JSON.stringify({ isRunning: true, startTime, laps }));
    interval = setInterval(updateTimer, 10);
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(lock => {
        console.log('Wake lock acquired');
        lock.addEventListener('release', () => console.log('Wake lock released'));
      }).catch(error => console.error('Wake lock request failed:', error));
    }
  } else {
    clearInterval(interval);
    localStorage.setItem('timer_state', JSON.stringify({ isRunning: false, pausedTime: time, laps }));
  }
}

function addLap() {
  if (!isRunning) return;
  const lapTime = time - (laps.length > 0 ? laps.reduce((sum, lap) => sum + lap, 0) : 0);
  if (lapTime > 0) {
    laps.push(lapTime);
    localStorage.setItem('timer_state', JSON.stringify({ isRunning, startTime, pausedTime: time, laps }));
    const lapList = document.querySelector('#laps');
    const li = document.createElement('li');
    li.textContent = `Lap ${laps.length}: ${formatTime(lapTime)}`;
    lapList.appendChild(li);
  }
}

function stopTimer() {
  if (isRunning) {
    const lapTime = time - (laps.length > 0 ? laps.reduce((sum, lap) => sum + lap, 0) : 0);
    if (lapTime > 0) {
      laps.push(lapTime);
      const lapList = document.querySelector('#laps');
      const li = document.createElement('li');
      li.textContent = `Lap ${laps.length}: ${formatTime(lapTime)}`;
      lapList.appendChild(li);
    }
    isRunning = false;
    clearInterval(interval);
    localStorage.setItem('timer_state', JSON.stringify({ isRunning: false, pausedTime: time, laps }));
  }
  if (laps.length > 0) {
    saveSession();
  }
  time = 0;
  laps = [];
  localStorage.removeItem('timer_state');
  document.querySelector('#timer-display').textContent = '00:00:00';
  document.querySelector('#laps').innerHTML = '';
  document.querySelector('#start-button').textContent = 'Start';
  document.querySelector('#lap-button').disabled = true;
}

function loadTimerTab() {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector('button[onclick="loadTab(\'timer\')"]').classList.add('active');
  document.getElementById('tab-content').innerHTML = `
    <div class="timer-display" id="timer-display">00:00:00</div>
    <div class="buttons">
      <button id="start-button" onclick="toggleTimer()">Start</button>
      <button id="lap-button" onclick="addLap()" ${!isRunning ? 'disabled' : ''}>Lap</button>
      <button onclick="stopTimer()">Stop</button>
    </div>
    <div class="lap-list">
      <h2>Laps</h2>
      <ul id="laps"></ul>
    </div>
  `;
  const timerState = JSON.parse(localStorage.getItem('timer_state') || '{}');
  if (timerState.isRunning) {
    isRunning = true;
    startTime = timerState.startTime;
    time = Date.now() - startTime; // Recalculate time on load
    laps = timerState.laps || [];
    document.querySelector('#start-button').textContent = 'Pause';
    document.querySelector('#lap-button').disabled = false;
    interval = setInterval(updateTimer, 10);
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(lock => {
        console.log('Wake lock acquired on restore');
        lock.addEventListener('release', () => console.log('Wake lock released'));
      }).catch(error => console.error('Wake lock request failed:', error));
    }
  } else if (timerState.pausedTime) {
    time = timerState.pausedTime;
    laps = timerState.laps || [];
    document.querySelector('#timer-display').textContent = formatTime(time);
    const lapList = document.querySelector('#laps');
    laps.forEach((lap, index) => {
      const li = document.createElement('li');
      li.textContent = `Lap ${index + 1}: ${formatTime(lap)}`;
      lapList.appendChild(li);
    });
  }
}

function loadDataTab() {
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
  document.querySelector('button[onclick="loadTab(\'data\')"]').classList.add('active');
  const sessions = getSessions();
  let sessionList = '<p>No sessions recorded yet.</p>';
  let chartHtml = '';
  if (sessions.length > 0) {
    sessionList = `<ul class="space-y-2">${sessions.map((session, index) => `
      <li onclick="showSession(${index})">Session ${index + 1}: ${new Date(session.timestamp).toLocaleString()} (Total: ${formatTime(session.totalTime)})</li>
    `).join('')}</ul>`;
    chartHtml = `
      <canvas id="session-chart"></canvas>
      <script>
        try {
          new Chart(document.getElementById('session-chart'), {
            type: 'line',
            data: {
              labels: ${JSON.stringify(sessions.map((_, index) => `Session ${index + 1}`))},
              datasets: [{
                label: 'Total Time (seconds)',
                data: ${JSON.stringify(sessions.map(session => session.totalTime / 1000))},
                borderColor: '#db8f9a',
                backgroundColor: '#FFE4C4',
                tension: 0.1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Session Total Times' }
              },
              scales: {
                y: { 
                  beginAtZero: true, 
                  title: { display: true, text: 'Time (seconds)' },
                  grid: { borderColor: '#253c4c', color: '#253c4c' }
                },
                x: { grid: { borderColor: '#253c4c', color: '#253c4c' } }
              }
            }
          });
        } catch (error) {
          console.error('Chart.js initialization failed:', error);
        }
      </script>
    `;
  }
  document.getElementById('tab-content').innerHTML = `
    <div class="sessions-list">
      <h3>Session Data</h3>
      <button onclick="clearStorage()">Clear All Data</button>
      <div class="chart-container">${chartHtml}</div>
      ${sessionList}
      <div class="session-details" id="session-details"></div>
    </div>
  `;
}

function showSession(index) {
  const sessions = getSessions();
  const session = sessions[index];
  const details = session.laps.map((lap, i) => `
    <li>Lap ${i + 1}: ${formatTime(lap)}${i > 0 ? ` (Diff: ${formatTime(lap - session.laps[i - 1])})` : ''}</li>
  `).join('');
  document.getElementById('session-details').innerHTML = `
    <h3>Session ${index + 1} Details</h3>
    <ul>${details}</ul>
  `;
}

function loadTab(tab) {
  if (tab === 'timer') {
    loadTimerTab();
  } else {
    loadDataTab();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadTimerTab();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(error => {
      console.error('Service Worker registration failed:', error);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateTimer();
    }
  });
});