const canvas = document.getElementById("clockCanvas");
const ctx = canvas.getContext("2d");
const startText = document.getElementById("startTime");
const endText = document.getElementById("endTime");
const initialSocInput = document.getElementById("initialSocInput");
const currentSocLabel = document.getElementById("currentSocPct");
const currentSocRow = document.getElementById("currentSocRow");
// Removed lower-page flag indicators
const currentLimText = document.getElementById("currLim");
const modeSwitchSchedule = document.getElementById("modeSwitchSchedule");
const modeSwitchManual = document.getElementById("modeSwitchManual");
const modeSwitchRemote = document.getElementById("modeSwitchRemote");
const modeSwitchContainer = document.getElementById("modeSwitchContainer");
const modeName = document.getElementById("modeName");
const solarStatus = document.getElementById("solarStatus");
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

let currentLimPos = 0.0;
let currentLimVal = 40;

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
let socInputActive = false;
let socInputElement = null;

// Cache of EV battery capacity from last config fetch; used in SOC calc during status polls
let evBatteryCapacityKwh = 40;

// Cache solar settings from config; status may not include them
let solarEnabledCached = false;
let topupEnabledCached = false;

const scheduleSaveAuto = 10000;
let initialSocSaveTimer = null;

function saveInitialSoc() {
    fetch('/setconfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            "chargeroptions": { "initial_soc_pct": currentLimVal },
            // You may need to add a way to reset energy delivered here
            // This depends on your backend API - you might need something like:
            // "reset_energy_delivered": true
        })
    }).then(() => { 
        makeToast('Saved Initial SOC'); 
        // Optionally force a status update to refresh the display
        updateStatus(true);
    }).catch(() => {});
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
        
        // Check for SOC text click first
        if (currentMode === "schedule" && isInsideSOCText(x, y)) {
            showSOCInput();
            dragMode = 0; 
            dragging = null;
            return;
        }
        
        // Existing code...
        if (dragMode == 1 && currentMode == "schedule") { 
            window.setTimeout(() => { saveSchedule(true); }, scheduleSaveAuto); 
        }
        if (currentMode == "manual") {
            if (isInsidePowerSwitch(x, y)) { 
                manualOnState = !manualOnState; 
                saveState(); 
                drawUI(); 
            }
        }
        dragMode = 0; 
        dragging = null;
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
        if (currentMode == "schedule") { 
            modeSwitchSchedule.classList.add("active"); 
            modeSwitchManual.classList.remove("active"); 
            modeName.innerHTML = "Schedule Mode";
            // Note: updateSolarStatus will be called from updateStatus with stat parameter
        }
        else if (currentMode == "manual") { 
            modeSwitchSchedule.classList.remove("active"); 
            modeSwitchManual.classList.add("active"); 
            modeName.innerHTML = "Manual Mode";
            solarStatus.innerHTML = "";
        }
        else { 
            modeSwitchSchedule.classList.remove("active"); 
            modeSwitchManual.classList.remove("active"); 
            modeName.innerHTML = "Remote Function Mode";
            solarStatus.innerHTML = "";
        }
    } else {
        modeSwitchSchedule.classList.remove("active"); modeSwitchManual.classList.remove("active"); modeSwitchSchedule.classList.add("disabled"); modeSwitchManual.classList.add("disabled"); modeName.innerHTML = "Charger Unreachable";
        solarStatus.innerHTML = "";
    }
}

function updateSolarStatus(stat) {
    // Use cached config values; status may omit loadmanagement booleans
    try {
        if (solarEnabledCached && topupEnabledCached) {
            solarStatus.innerHTML = "Solar Enabled with Cloud Top-up";
        } else if (solarEnabledCached) {
            solarStatus.innerHTML = "Solar Enabled";
        } else {
            solarStatus.innerHTML = "";
        }
    } catch (e) {
        solarStatus.innerHTML = "";
    }
}

function getRadius() { return drawMobile ? radiusSmall : radiusLarge; }

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
    
    // Only update Current SOC display if we're in schedule mode and Initial SOC > 0
    if (currentMode === "schedule") {
        if (currentLimVal > 0) {
            // Always show Initial SOC in the center circle
            // Don't override the Current SOC display here - let updateStatus() handle that
            // The currentLimText will be updated by updateStatus() with the calculated Current SOC
        } else {
            // Hide Current SOC text if Initial SOC = 0
            currentLimText.innerHTML = '';
            currentSocLabel.innerText = '0';
            currentSocRow.style.display = 'none';
        }
    } else {
        // Hide the text in manual and remote modes
        currentLimText.innerHTML = '';
        currentSocLabel.innerText = '0';
        currentSocRow.style.display = 'none';
    }
}

// 2. Add a function to draw the SOC text in the center of the circle:
function drawSOCInCenter() {
    if (currentMode === "schedule") {
        const radius = getRadius();
        
        // Set up text styling
        ctx.font = drawMobile ? "24px Arial" : "28px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        if (socInputActive) {
            // Show a border when input is active
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX - 80, centerY - 15, 160, 30);
        } else {
            // Draw the SOC text normally
            const socText = `Initial SOC ${currentLimVal}%`;
            ctx.fillText(socText, centerX, centerY);
        }
    }
}
function showSOCInput() {
    if (currentMode !== "schedule" || socInputActive) return;
    
    socInputActive = true;
    
    // Create input element
    socInputElement = document.createElement('input');
    socInputElement.type = 'number';
    socInputElement.min = '0';
    socInputElement.max = '100';
    socInputElement.step = '1';
    socInputElement.value = currentLimVal.toString();
    
    // Position the input over the canvas center
    const canvasRect = canvas.getBoundingClientRect();
    socInputElement.style.position = 'absolute';
    socInputElement.style.left = (canvasRect.left + centerX - 60) + 'px';
    socInputElement.style.top = (canvasRect.top + centerY - 15) + 'px';
    socInputElement.style.width = '120px';
    socInputElement.style.height = '30px';
    socInputElement.style.fontSize = '18px';
    socInputElement.style.textAlign = 'center';
    socInputElement.style.border = '2px solid white';
    socInputElement.style.backgroundColor = 'rgba(0,0,0,0.8)';
    socInputElement.style.color = 'white';
    socInputElement.style.borderRadius = '5px';
    socInputElement.style.zIndex = '1000';
    
    // Add event listeners
    socInputElement.addEventListener('input', handleSOCInput);
    socInputElement.addEventListener('blur', hideSOCInput);
    socInputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') hideSOCInput();
    });
    
    document.body.appendChild(socInputElement);
    socInputElement.focus();
    socInputElement.select();
    
    drawUI();
}

// Modified handleSOCInput to update Initial SOC display immediately
function handleSOCInput(e) {
    const parsedValue = parseInt(e.target.value);
    const value = isNaN(parsedValue) ? 0 : parsedValue;
    const clampedValue = Math.max(0, Math.min(100, value));
    
    if (value !== clampedValue) {
        e.target.value = clampedValue;
    }
    
    currentLimVal = clampedValue;
    currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim);
    
    // Update Initial SOC display immediately
    updateCurrentLimText();
       
    // Update display immediately
    drawUI();
}

function hideSOCInput() {
    if (!socInputActive) return;
    
    socInputActive = false;
    
    if (socInputElement) {
        const parsedValue = parseInt(socInputElement.value);
        const finalValue = isNaN(parsedValue) ? 0 : parsedValue;
        const clampedValue = Math.max(0, Math.min(100, finalValue));
        
        currentLimVal = clampedValue;
        currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim);
        
        // Update Current SOC display immediately using updateCurrentLimText
        updateCurrentLimText();
        saveInitialSoc();
        document.body.removeChild(socInputElement);
        socInputElement = null;
    }
    
    drawUI();
}

function isInsideSOCText(x, y) {
    if (currentMode !== "schedule") return false;
    
    const textWidth = 160;
    const textHeight = 30;
    const textX = centerX - textWidth/2;
    const textY = centerY - textHeight/2;
    
    return (x >= textX && x <= textX + textWidth && y >= textY && y <= textY + textHeight);
}

function snapCurrent() {
    currentLimVal = minCurrentLim + Math.floor((maxCurrentLim - minCurrentLim) * currentLimPos);
    currentLimMode[currentMode] = currentLimVal;
    currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim);
    updateCurrentLimText();
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
    // Round to the nearest 10 minutes instead of always rounding down
    let rounded = Math.round(minutes / 10) * 10;
    if (rounded === 60) {
        hours = (hours + 1) % 24;
        minutes = 0;
    } else {
        minutes = rounded;
    }
    return hours.toString().padStart(2, '0') + minutes.toString().padStart(2, '0');
}

function clamp(num, min, max) { return num <= min ? min : num >= max ? max : num }
function normalizeAngle(angle) { return (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); }

function drawUI() {
    redrawModes();
    if (currentMode == "schedule") { drawClock(); }
    else if (currentMode == "manual") { drawPowerSwitch(); }
    else { drawRemoteMode(); }
}

// 3. Update the drawClock() function to include SOC display:
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
    ctx.beginPath(); 
    ctx.strokeStyle = gradient; 
    ctx.lineWidth = 10; 
    ctx.arc(centerX, centerY, radius, dots[0].angle, dots[1].angle, false); 
    ctx.stroke();
    
    dots.forEach((dot) => {
        const dotX = centerX + radius * Math.cos(dot.angle); 
        const dotY = centerY + radius * Math.sin(dot.angle); 
        ctx.beginPath(); 
        ctx.arc(dotX, dotY, 12, 0, Math.PI * 2); 
        ctx.fillStyle = dot.color; 
        ctx.fill(); 
    });
    // Add SOC display in center
    drawSOCInCenter();    
    timeDisplay.style.visibility = 'visible';
    innerStateDisplay.style.visibility = 'visible';
	innerStateDisplay.innerHTML = '';
    startText.innerHTML = angleToTime(dots[0].angle);
    endText.innerHTML = angleToTime(dots[1].angle);
}

// 4. Update the drawPowerSwitch() function to include SOC display:
function drawPowerSwitch() {
    radius = getRadius();
    powerSwitchWidth = radius*1.0; 
    powerSwitchYPos = radius*0.6; 
    powerSwitchHeight = radius*0.40; 
    powerSwitchRounding = powerSwitchHeight/2;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (manualOnState) { 
        ctx.fillStyle = "#44aa44"; 
        ctx.strokeStyle = "#44ff44"; 
    } else { 
        ctx.fillStyle = "#333333"; 
        ctx.strokeStyle = "#aaaaaa"; 
    }
    
    ctx.lineWidth = 2; 
    ctx.beginPath(); 
    ctx.roundRect(centerX - (powerSwitchWidth/2), centerY - powerSwitchYPos, powerSwitchWidth, powerSwitchHeight, powerSwitchRounding); 
    ctx.stroke(); 
    ctx.fill();
    
    circlePadding = 4; 
    circleRadius = (powerSwitchHeight / 2) - circlePadding;
    if (manualOnState) 
        circleX = centerX + (powerSwitchWidth/2) - circleRadius - circlePadding; 
    else 
        circleX = centerX - (powerSwitchWidth/2) + circleRadius + circlePadding;
    circleY = centerY - powerSwitchYPos + (powerSwitchHeight / 2);
    
    ctx.lineWidth = 1; 
    ctx.strokeStyle = "#aaaaaa"; 
    ctx.fillStyle = "#dddddd";
    ctx.beginPath(); 
    ctx.arc(circleX, circleY, circleRadius, 0, 2 * Math.PI); 
    ctx.stroke(); 
    ctx.fill();
    timeDisplay.style.visibility = 'hidden'; 
    innerStateDisplay.style.visibility = 'visible';
    if (manualOnState) 
		innerStateDisplay.innerHTML = '<p style="font-size: 24px; margin: 0;">Charging Enabled</p>'; 
	else 
		innerStateDisplay.innerHTML = '<p style="font-size: 24px; margin: 0;">Charging Disabled</p>';
}

function drawRemoteMode() { ctx.clearRect(0, 0, canvas.width, canvas.height); innerStateDisplay.innerHTML = '<p>Remote Mode</p><p>3 Modules Enabled</p>'; timeDisplay.style.visibility = 'hidden'; innerStateDisplay.style.visibility = 'visible'; }

function saveSchedule(report) {
    const start = angleToTime(dots[0].angle); 
    const end = angleToTime(dots[1].angle);
    
    // Include both schedule data AND preserve the current Initial SOC
    fetch('/setconfig', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
            scheduler: { 
                schedule: [{ 
                    start: start, 
                    end: end, 
                    amps: currentLimMode['schedule'] 
                }]
            },
            // Preserve the current Initial SOC when saving schedule
            chargeroptions: { 
                "initial_soc_pct": currentLimVal 
            }
        })
    })
    .then(response => response.json())
    .then(data => { 
        if (report) { 
            makeToast('Saved new schedule'); 
        } 
    })
    .catch(error => { 
        makeToastError('Unable to save state: no response from charger'); 
    });
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

function switchTo(newMode) { 
    currentMode = newMode; 
    // Store the current initial SOC before switching
    const currentInitialSoc = currentLimVal;
    updateCurrentLimSliderForRemoteValue(currentLimMode[currentMode]); 
    // Restore the initial SOC value - don't overwrite it with current limit
    currentLimVal = currentInitialSoc;
    drawUI(); 
    saveState(); 
    saveMode(); 
    // Don't call snapCurrent() here as it would overwrite currentLimVal again
    // snapCurrent(); 
}

function windowSizeAdjust() { if (window.innerWidth < 850 || window.innerHeight < 850) { drawMobile = true; canvas.width = canvasSmall; canvas.height = canvasSmall; centerX = canvas.width / 2; centerY = canvas.height / 2; document.body.style.zIndex = 1; drawUI(); } else { drawMobile = false; canvas.width = canvasLarge; canvas.height = canvasLarge; centerX = canvas.width / 2; centerY = canvas.height / 2; document.body.style.zIndex = 1; drawUI(); } }

// Modified updateStatus function with updated SOC calculation and energy reset logic
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
            
            if (!stat['eo_connected_to_controller']) { 
                statusWhatDoing.innerHTML = "Error (Controller Fault)"; 
                statusWhatDoing.setAttribute("class", ""); 
                statusWhatDoing.classList.add("status-item"); 
                statusWhatDoing.classList.add("status-fault"); 
            }
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
            
            // Removed lower-page flag indicators
            
            try { 
                // Use cached config values instead of expecting them in status
                const initSoc = parseInt(currentLimVal ?? 0); 
                const delivered = parseFloat(stat['eo_session_energy_kwh'] || 0); 
                const cap = parseFloat(evBatteryCapacityKwh || 40); 
                
                // Updated SOC calculation: Initial SOC + (energy delivered * 100 / EV Battery Capacity)
                // Only calculate and show if Initial SOC > 0 
                if (initSoc > 0) { 
                    const currSoc = Math.min(100, Math.max(0, Math.floor(initSoc + (delivered * 100.0 / cap)))); 
                    currentSocLabel.innerText = currSoc.toString(); 
                    currentSocRow.style.display = ''; 
                    
                    // Update the currentLimText display with the calculated Current SOC
                    if (currentMode === "schedule") {
                        currentLimText.innerHTML = `Current SOC ${currSoc}%`;
                    }
                } else { 
                    // Hide Current SOC display if Initial SOC = 0
                    currentSocLabel.innerText = '0';
                    currentSocRow.style.display = 'none'; 
                    if (currentMode === "schedule") {
                        currentLimText.innerHTML = '';
                    }
                } 
            } catch (e) {}
            
            statusInfo.style.visibility = 'visible'; 
            
            // Update solar status if in schedule mode
            if (currentMode === "schedule") {
                updateSolarStatus(stat);
            }
            
            drawUI();
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
    currentLimVal = parseInt((stat['chargeroptions']||{})['initial_soc_pct'] ?? 40); 
    currentLimPos = (currentLimVal - minCurrentLim) / (maxCurrentLim - minCurrentLim); 
    // Cache EV battery capacity for use in status polling
    try {
        evBatteryCapacityKwh = parseFloat(stat?.loadmanagement?.ev_battery_capacity_kwh ?? 40);
        if (!isFinite(evBatteryCapacityKwh) || evBatteryCapacityKwh <= 0) evBatteryCapacityKwh = 40;
    } catch (e) { evBatteryCapacityKwh = 40; }
    // Cache solar settings for use in UI updates
    try {
        solarEnabledCached = !!(stat?.loadmanagement?.solar_enable);
        topupEnabledCached = !!(stat?.loadmanagement?.solar_topup_enable);
    } catch (e) { solarEnabledCached = false; topupEnabledCached = false; }
    updateCurrentLimText();
    drawUI();
}

function fetchAndUpdateConfig() { fetch('/getconfig', { method: 'GET' }) .then(function(response) { return response.json(); }) .then(function(stat) {updateConfig(stat)}) .catch(error => { console.log('Error fetching config: ', error); }); }

addEventListener("resize", (event) => { windowSizeAdjust() })

window.onload = function() { const url = new URL(window.location.href); const params = new URLSearchParams(url.search); if (params.get('reloadtoast') != null) { makeToast("openeo has restarted"); } }

fetchAndUpdateConfig();
// Add a small delay before initial render on mobile
window.setTimeout(() => {
snapCurrent();
windowSizeAdjust();
updateStatus(true);
drawUI();
redrawModes();
}, 100);

window.setInterval(() => { updateStatus(false); }, 1000);
window.setInterval(() => { fetchAndUpdateConfig(); }, 30000);
modeSwitchContainer.style.display = '';
modeSwitchContainer.style.visibility = 'visible';


