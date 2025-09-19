const canvas = document.getElementById("clockCanvas");
const ctx = canvas.getContext("2d");
const startText = document.getElementById("startTime");
const endText = document.getElementById("endTime");
const initialSocInput = document.getElementById("initialSocInput");
const currentSocLabel = document.getElementById("currentSocPct");
const currentSocRow = document.getElementById("currentSocRow");
const flagSolar = document.getElementById("flagSolar");
const flagTopup = document.getElementById("flagTopup");
const currentLimText = document.getElementById("currLim");
const modeSwitchSchedule = document.getElementById("modeSwitchSchedule");
const modeSwitchManual = document.getElementById("modeSwitchManual");
const modeSwitchRemote = document.getElementById("modeSwitchRemote");
const modeSwitchContainer = document.getElementById("modeSwitchContainer");
const modeName = document.getElementById("modeName");
const timeDisplay = document.getElementById("timeDisplay");
const innerStateDisplay = document.getElementById("innerStateDisplay");
const statusWhatDoing = document.getElementById("statusWhatDoing");
const statusChargeCurrent = document.getElementById("statusChargeCurrent");
const statusChargeVolt = document.getElementById("statusChargeVolt");
const statusChargePower = document.getElementById("statusChargePower");
const statusInfo = document.getElementById("statusInfo");

let centerX = canvas.width / 2;
let centerY = canvas.height / 2;
let radiusLarge = 170;
let radiusSmall = 100;
let canvasLarge = 450;
let canvasSmall = 250;
let dragMode = 0;
let dragging = null;
let drawMobile = false;

let slideClickPosTol = 0.2;
let swClickPosTol = 0.1;

let powerSwitchWidth = 0;
let powerSwitchYPos = 0;
let powerSwitchHeight = 0;
let powerSwitchRounding = 0;

let currentLimYRelPos = 0.0;
let currentLimXRelPos = 0.50;

let currentLimPos = 0.0;
let currentLimVal = 0;

let currentLimMode = { 'schedule' : 0, 'manual' : 0, 'remote' : -1 };

const maxCurrentLim = 100;
const minCurrentLim = 0;

let currentMode = "manual";
let manualOnState = false;

let reqMissedResponses = 0;

let updateTick = 0;
let updateFreq = 1;

let firstPoll = false;

let chargerCommsOk = true;

const scheduleSaveAuto = 10000;
const initialSocSaveAuto = 10000;
let initialSocSaveTimer = null;

function scheduleInitialSocSave() {
    if (initialSocSaveTimer) { clearTimeout(initialSocSaveTimer); }
    initialSocSaveTimer = setTimeout(() => { saveInitialSoc(); }, initialSocSaveAuto);
}

function saveInitialSoc() {
    fetch('/setconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "chargeroptions" : { "initial_soc_pct": currentLimVal } })
    }).then(() => { makeToast('Saved Initial SOC'); }).catch(() => {});
}

function parseTimeToAngle(time) {
    let hours = parseInt(time.substring(0, 2));
    let minutes = parseInt(time.substring(2));
    let totalMinutes = hours * 60 + minutes;
    return (totalMinutes / 1440) * 2 * Math.PI - Math.PI / 2;
}

let dots = [
    { angle: parseTimeToAngle("0000"), color: "#4dabf7" } ,
    { angle: parseTimeToAngle("0000"), color: "#f74d4d" }
];

let lastScheduleDots = window.structuredClone(dots);

['mousedown','touchstart'].forEach(event=>
    canvas.addEventListener(event, (e) => {
        const { x, y } = getMousePos(e);
        if (currentMode == "schedule") {
            dots.forEach((dot, index) => {
                if (isInsideDot(x, y, dot.angle)) {
                    dragMode = 1;
                    dragging = index;
                    return;
                }
            });
        }
    })
);

function mouseTouchArcEvent(e) {
    const { x, y } = getMousePos(e);
    dots[dragging].angle = Math.atan2(y - centerY, x - centerX);
    drawUI();
}

function mouseTouchSliderEvent(e) { /* no-op now */ }

canvas.addEventListener("mousemove", (e) => {
    if (dragMode == 1) { mouseTouchArcEvent(e); }
});

canvas.addEventListener("touchmove", (e) => {
    if (dragMode == 1 && currentMode == "schedule") { e.preventDefault(); mouseTouchArcEvent(e); }
}, { passive: false });

['mouseup','touchend'].forEach(event=>
    canvas.addEventListener(event, (e) => {
        const { x, y } = getMousePos(e);
        if (dragMode == 1 && currentMode == "schedule") { window.setTimeout(() => { saveSchedule(true); }, scheduleSaveAuto); }
        if (currentMode == "manual") {
            if (isInsidePowerSwitch(x, y)) { manualOnState = !manualOnState; saveState(); drawUI(); }
        }
        dragMode = 0; dragging = null
    })
);

['mousedown','touchstart'].forEach(event=>
    modeSwitchSchedule.addEventListener(event, () => { switchTo("schedule") })
);
['mousedown','touchstart'].forEach(event=>
    modeSwitchManual.addEventListener(event, () => { switchTo("manual") })
);

function redrawModes() {
    modeSwitchSchedule.classList.remove("disabled");
    modeSwitchManual.classList.remove("disabled");
    if (chargerCommsOk) {
        if (currentMode == "schedule") { modeSwitchSchedule.classList.add("active"); modeSwitchManual.classList.remove("active"); modeName.innerHTML = "Schedule Mode"; }
        else if (currentMode == "manual") { modeSwitchSchedule.classList.remove("active"); modeSwitchManual.classList.add("active"); modeName.innerHTML = "Manual Mode"; }
        else { modeSwitchSchedule.classList.remove("active"); modeSwitchManual.classList.remove("active"); modeName.innerHTML = "Remote Function Mode"; }
    } else {
        modeSwitchSchedule.classList.remove("active"); modeSwitchManual.classList.remove("active"); modeSwitchSchedule.classList.add("disabled"); modeSwitchManual.classList.add("disabled"); modeName.innerHTML = "Charger Unreachable";
    }
}

function getRadius() { return drawMobile ? radiusSmall : radiusLarge; }

function isInsideCurrentLimSlider(x, y, ignoreY) { return null; }

function isInsidePowerSwitch(x, y) {
    radius = getRadius();
    x0 = centerX - (powerSwitchWidth/2) - (radius*swClickPosTol);
    y0 = centerY - powerSwitchYPos - (radius*swClickPosTol)
    x1 = centerX + (powerSwitchWidth/2) + (radius*swClickPosTol);
    y1 = centerY - powerSwitchYPos + powerSwitchHeight + (radius*swClickPosTol);
    return (x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

function updateCurrentLimSliderForRemoteValue(remVal) {
    currentLimPos = (remVal - minCurrentLim) / (maxCurrentLim - minCurrentLim);
    currentLimPos = clamp(currentLimPos, 0, 1);
    currentLimVal = remVal;
    updateCurrentLimText();
}

function updateCurrentLimText() {
    tempLimVal = Math.floor(minCurrentLim + ((maxCurrentLim - minCurrentLim) * currentLimPos));
    initialSocInput.value = tempLimVal.toString();
    currentLimText.innerHTML = "";
}

function snapCurrent() {
    currentLimVal = minCurrentLim + Math.floor((maxCurrentLim - minCurrentLim) * currentLimPos);
    currentLimMode[currentMode] = currentLimVal;
    currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim);
    updateCurrentLimText();
    scheduleInitialSocSave();
    drawUI();
    updateStatus();
    canvas.style.visibility = 'visible';
}

function isInsideDot(x, y, angle) {
    radius = getRadius();
    const dotX = centerX + radius * Math.cos(angle);
    const dotY = centerY + radius * Math.sin(angle);
    return Math.hypot(x - dotX, y - dotY) < 15;
}

function angleToTime(angle) {
    let totalMinutes = Math.floor(((angle + Math.PI / 2) / (2 * Math.PI)) * 1440) % 1440;
    if (totalMinutes < 0) totalMinutes += 1440;
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    minutes = minutes - (minutes % 10);
    return hours.toString().padStart(2, '0') + minutes.toString().padStart(2, '0');
}

function clamp(num, min, max) { return num <= min ? min : num >= max ? max : num }
function normalizeAngle(angle) { return (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); }

function drawUI() {
    redrawModes();
    if (currentMode == "schedule") { drawClock(); drawCurrentLimit(); }
    else if (currentMode == "manual") { drawPowerSwitch(); drawCurrentLimit(); }
    else { drawRemoteMode(); drawCurrentLimit(); }
}

function drawClock() {
    radius = getRadius();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.stroke();
    const gradient = ctx.createLinearGradient(
        centerX + radius * Math.cos(dots[0].angle),
        centerY + radius * Math.sin(dots[0].angle),
        centerX + radius * Math.cos(dots[1].angle),
        centerY + radius * Math.sin(dots[1].angle)
    );
    gradient.addColorStop(0, dots[0].color);
    gradient.addColorStop(1, dots[1].color);
    ctx.beginPath(); ctx.strokeStyle = gradient; ctx.lineWidth = 10; ctx.arc(centerX, centerY, radius, dots[0].angle, dots[1].angle, false); ctx.stroke();
    dots.forEach((dot) => {{ const dotX = centerX + radius * Math.cos(dot.angle); const dotY = centerY + radius * Math.sin(dot.angle); ctx.beginPath(); ctx.arc(dotX, dotY, 12, 0, Math.PI * 2); ctx.fillStyle = dot.color; ctx.fill(); }});
    timeDisplay.style.visibility = 'visible';
    innerStateDisplay.style.visibility = 'visible';
    startText.innerHTML = angleToTime(dots[0].angle);
    endText.innerHTML = angleToTime(dots[1].angle);
}

function drawPowerSwitch() {
    radius = getRadius();
    powerSwitchWidth = radius*1.0; powerSwitchYPos = radius*0.6; powerSwitchHeight = radius*0.40; powerSwitchRounding = powerSwitchHeight/2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (manualOnState) { ctx.fillStyle = "#44aa44"; ctx.strokeStyle = "#44ff44"; } else { ctx.fillStyle = "#333333"; ctx.strokeStyle = "#aaaaaa"; }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(centerX - (powerSwitchWidth/2), centerY - powerSwitchYPos, powerSwitchWidth, powerSwitchHeight, powerSwitchRounding); ctx.stroke(); ctx.fill();
    circlePadding = 4; circleRadius = (powerSwitchHeight / 2) - circlePadding;
    if (manualOnState) circleX = centerX + (powerSwitchWidth/2) - circleRadius - circlePadding; else circleX = centerX - (powerSwitchWidth/2) + circleRadius + circlePadding;
    circleY = centerY - powerSwitchYPos + (powerSwitchHeight / 2);
    ctx.lineWidth = 1; ctx.strokeStyle = "#aaaaaa"; ctx.fillStyle = "#dddddd";
    ctx.beginPath(); ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI); ctx.stroke(); ctx.fill();
    timeDisplay.style.visibility = 'hidden'; innerStateDisplay.style.visibility = 'visible';
    if (manualOnState) innerStateDisplay.innerHTML = '<p>Charging Enabled</p>'; else innerStateDisplay.innerHTML = '<p>Charging Disabled</p>';
}

function drawRemoteMode() { ctx.clearRect(0, 0, canvas.width, canvas.height); innerStateDisplay.innerHTML = '<p>Remote Mode</p><p>3 Modules Enabled</p>'; timeDisplay.style.visibility = 'hidden'; innerStateDisplay.style.visibility = 'visible'; }

function drawCurrentLimit() {
    radius = getRadius(); let x0 = centerX - (radius*currentLimXRelPos); let x1 = centerX + (radius*currentLimXRelPos); let y = centerY + (radius*currentLimYRelPos);
    radius = getRadius(); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (currentLimPos * (x1 - x0)), y); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.lineTo(x0 + (currentLimPos * (x1 - x0)), y); ctx.lineTo(x1, y); ctx.strokeStyle = "#888888"; ctx.lineWidth = 4; ctx.stroke();
    // No knob drawn
}

function saveSchedule(report) {
    const start = angleToTime(dots[0].angle); const end = angleToTime(dots[1].angle);
    fetch('/setconfig', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ scheduler: { schedule: [{ start: start, end: end, amps : currentLimMode['schedule'] }]}}), })
    .then(response => response.json()).then(data => { if (report) { makeToast('Saved new schedule'); } })
    .catch(error => { makeToastError('Unable to save state: no response from charger'); });
}

function saveState() {
    const start = angleToTime(dots[0].angle); const end = angleToTime(dots[1].angle);
    if (!firstPoll) { return; }
    switch_enabled = 0; schedule_enabled = 0; if (currentMode == "manual") switch_enabled = 1; if (currentMode == "schedule") schedule_enabled = 1;
    fetch('/setconfig', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ "switch" : { enabled : switch_enabled, on : manualOnState, amps : currentLimMode['manual'] }, "chargeroptions" : { "initial_soc_pct": currentLimVal } }), })
    .then(response => response.json()).then(data => {}).catch(error => { makeToastError('Unable to save state: ' + error.toString()) });
    window.setTimeout(() => { updateStatus(true); }, 500); window.setTimeout(() => { updateStatus(true); }, 1500);
}

function saveCurrentLimit() { if (currentMode == "schedule") saveSchedule(false); else if (currentMode == "manual") saveState(); else console.log('Not implemented'); }

function saveMode() { console.log('saveMode(' + currentMode + ')'); config={}; fetch('/setmode', { method: 'POST', headers: { 'Content-Type': 'application/json', }, body: JSON.stringify({ newmode : currentMode }), })
.then(response => response.json()).then(data => { updateConfig(data.config); }).catch(error => { makeToastError('Unable to save state: ' + error.toString()) }); return(config); }

function switchTo(newMode) { currentMode = newMode; updateCurrentLimSliderForRemoteValue(currentLimMode[currentMode]); currentLimVal = currentLimMode[currentMode]; drawUI(); saveState(); saveMode(); snapCurrent(); }

function windowSizeAdjust() { if (window.innerWidth < 850 || window.innerHeight < 850) { drawMobile = true; canvas.width = canvasSmall; canvas.height = canvasSmall; centerX = canvas.width / 2; centerY = canvas.height / 2; document.body.style.zIndex = 1; drawUI(); } else { drawMobile = false; canvas.width = canvasLarge; canvas.height = canvasLarge; centerX = canvas.width / 2; centerY = canvas.height / 2; document.body.style.zIndex = 1; drawUI(); } }

function updateStatus(once) {
    if (once || ((updateTick % updateFreq) == 0)) {
        updateTick++;
        fetch('/getstatus', { method: 'GET' })
        .then(function(response) { return response.json(); })
        .then(function(stat) {
            chargerCommsOk = true; updateFreq = 1; reqMissedResponses = 0;
            statusChargeVolt.innerHTML = Math.round(stat['eo_live_voltage'], 0) + "V";
            statusChargeCurrent.innerHTML = Math.round(stat['eo_current_vehicle'], 0) + "/" + Math.round(stat['eo_amps_requested'], 0) + "A";
            statusChargePower.innerHTML = Number(stat['eo_power_delivered']).toFixed(2) + "kW";
            if (!stat['eo_connected_to_controller']) { statusWhatDoing.innerHTML = "Error (Controller Fault)"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-fault"); }
            else {
                state = stat['eo_charger_state'];
                if (state == 'car-connected') { if (stat['eo_amps_requested'] == 0) { state = 'charge-suspended'; } }
                else if (state == 'charge-complete') { if (stat['eo_amps_requested'] > 0) { state = 'car-connected'; } else { state = 'charge-suspended'; } }
                if (state == 'idle') { statusWhatDoing.innerHTML = "Idle"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-idle"); }
                else if (state == 'plug-present') { statusWhatDoing.innerHTML = "Waiting for Connection"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-paused-by-connection"); }
                else if (state == 'car-connected') { statusWhatDoing.innerHTML = "Waiting for Vehicle"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-paused-by-vehicle"); }
                else if (state == 'mains-fault') { statusWhatDoing.innerHTML = "Error"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-fault"); }
                else if (state == 'charging' && stat['eo_amps_requested'] > 0) { statusWhatDoing.innerHTML = "Charging"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-charging"); }
                else if (state == 'charging' || state == 'charge-complete' || state == 'charge-suspended') {
                    if (stat['eo_current_vehicle'] > 0) { statusWhatDoing.innerHTML = "Pausing (Waiting for Vehicle)"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-paused-by-evse"); }
                    else { if (currentMode == "schedule") { statusWhatDoing.innerHTML = "Paused (Awaiting Schedule)"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-paused-by-evse"); } else { statusWhatDoing.innerHTML = "Paused"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); statusWhatDoing.classList.add("status-paused-by-evse"); } }
                } else { statusWhatDoing.innerHTML = "Unknown"; statusWhatDoing.setAttribute("class", ""); statusWhatDoing.classList.add("status-item"); }
            }
            try { const lm = stat['loadmanagement'] || {}; const solarEnabled = !!lm['solar_enable']; const topupEnabled = !!lm['solar_topup_enable']; flagSolar.style.display = solarEnabled ? '' : 'none'; flagTopup.style.display = (solarEnabled && topupEnabled) ? '' : 'none'; document.getElementById('flagsDisplay').style.visibility = 'visible'; } catch (e) {}
            try { const initSoc = parseInt((stat['chargeroptions']||{})['initial_soc_pct'] || 0); const delivered = parseFloat(stat['eo_session_energy_kwh'] || 0); const cap = parseFloat((stat['loadmanagement']||{})['ev_battery_capacity_kwh'] || 40); if (initSoc > 0 && cap > 0) { const currSoc = Math.min(100, Math.max(0, Math.floor(initSoc + (delivered * 100.0 / cap)))); currentSocLabel.innerText = currSoc.toString(); currentSocRow.style.display = ''; } else { currentSocRow.style.display = 'none'; } } catch (e) {}
            statusInfo.style.visibility = 'visible'; drawUI();
        })
        .catch(error => { reqMissedResponses++; if (reqMissedResponses >= 10) { updateFreq = 10; chargerCommsOk = false; drawUI(); return; } });
    }
}

function updateConfig(stat) {
    firstPoll = true;
    if (stat['scheduler']['schedule'].length > 0) { dots[0].angle = parseTimeToAngle(stat['scheduler']['schedule'][0]['start']); dots[1].angle = parseTimeToAngle(stat['scheduler']['schedule'][0]['end']); }
    currentLimMode['manual'] = stat?.['switch']?.amps ?? 0; currentLimMode['schedule'] = stat?.scheduler?.schedule?.[0]?.amps ?? 0;
    manualOnState = stat?.switch?.on ?? false;
    currentMode = stat?.chargeroptions?.mode ?? 'manual';
    currentLimVal = parseInt((stat['chargeroptions']||{})['initial_soc_pct'] || 0); currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim); updateCurrentLimText();
    drawUI();
}

function fetchAndUpdateConfig() { fetch('/getconfig', { method: 'GET' }) .then(function(response) { return response.json(); }) .then(function(stat) {updateConfig(stat)}) .catch(error => { console.log('Error fetching config: ', error); }); }

addEventListener("resize", (event) => { windowSizeAdjust() })

window.onload = function() { const url = new URL(window.location.href); const params = new URLSearchParams(url.search); if (params.get('reloadtoast') != null) { makeToast("openeo has restarted"); } }

fetchAndUpdateConfig();
snapCurrent();
windowSizeAdjust();
updateStatus(true);
window.setInterval(() => { updateStatus(false); }, 1000);
window.setInterval(() => { fetchAndUpdateConfig(); }, 30000);
drawUI();
redrawModes();
updateCurrentLimText();
modeSwitchContainer.style.display = '';
modeSwitchContainer.style.visibility = 'visible';