<div class="canvas-area">
	<div class="canvas-container">
		<canvas id="clockCanvas" class="clock"></canvas>
	</div>
	<div class="canvas-inner-widget">
		<div class="time-display-container" id="timeDisplay">
			<p>From <span id="startTime">2100</span> to <span id="endTime">0100</span></p>
		</div>
		<div class="inner-display-container" id="innerStateDisplay">
			<p>Initial SOC <span id="initialSocPct">0</span> %</p>
			<p id="currentSocRow">Current SOC <span id="currentSocPct">0</span> %</p>
		</div>
		<span class="current-display-container" id="currLim"></span>
		<div id="flagsDisplay" style="visibility:hidden; text-align:center; padding-top:0.5em;">
			<p id="flagSolar" style="display:none;">Solar Enabled</p>
			<p id="flagTopup" style="display:none;">Cloud Top-up Enabled</p>
		</div>
	</div>
</div>