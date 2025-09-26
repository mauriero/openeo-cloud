# Changelog

## [0.6.0-solar.1](https://github.com/sr-digitalhouse/openeo-solar/compare/v0.5.4-solar.1...v0.6.0-solar.1) (2025-09-26)


### Features

* **settings:** reorder solar settings; show solar-only rows conditionally; time format for End Solar Charging\n\n- Order: Solar enable, Site limit, EV capacity, End SOC, Reservation, Cloud top-up, Min current, End Solar time\n- Hide last four rows unless Solar Charging is enabled\n- End Solar time uses HH:MM pattern; backend supports HH:MM or HHMM ([6b19afa](https://github.com/sr-digitalhouse/openeo-solar/commit/6b19afa0332fd2a9044b167e870036d20c949976))
* **solar+ui:** initial SOC slider, energy-based stop, top-up end time\n\n- Replace home current slider with Initial SOC % display/slider\n- Persist initial_soc_pct in chargeroptions\n- Add EV capacity (kWh) and End SOC % settings\n- Add End Solar Charging at (HH:MM) and rename Top-up label\n- Prevent mains top-up until solar &gt;= reservation + min\n- Integrate delivered energy and stop at target before schedule end ([8e2ed3c](https://github.com/sr-digitalhouse/openeo-solar/commit/8e2ed3c5833ea828a2101a39a89af3d55b0d58a7))
* **ui/home:** show From/Initial/Current SOC; numeric input for Initial SOC; 10-min arc steps; flags visible\n\n- Replace slider with numeric input for Initial SOC on home\n- Arc start/end display retained; snap minutes to 10\n- Solar/Top-up flags already shown based on settings ([19a39e2](https://github.com/sr-digitalhouse/openeo-solar/commit/19a39e2c4ef92bfa6868b3ff4cd14859549db313))
* **ui+logic:** Home texts, Initial/Current SOC, flags; Settings layout; end-of-day slider and defaults; scheduler rounding\n\n- Home shows From &lt;start&gt; to &lt;end&gt;, Initial SOC and Current SOC with autosave\n- Flags for Solar Enabled and Cloud Top-up Enabled based on settings\n- Settings: move/hide solar rows, default end SOC 80, End Solar slider (1000–2200 step 30)\n- Top-up cut-off parses HHMM; scheduler default 21:00→01:00 with 10-min rounding ([0d31011](https://github.com/sr-digitalhouse/openeo-solar/commit/0d3101113d3082bb4e754b42612dff9c92c7263a))
* **ui:** set autosave to 10s for schedule and Initial SOC; reset session energy when Initial SOC saves\n\n- Debounce Initial SOC save at 10s and persist to chargeroptions\n- Schedule autosave constant to 10s\n- Reset eo_session_energy_kwh on initial_soc change ([ee38bdd](https://github.com/sr-digitalhouse/openeo-solar/commit/ee38bddb5eff1bb50e77abfc608aef64e28c3434))


### Bug Fixes

* **download:** align destdir with GitHub archive folder name (&lt;repo&gt;-&lt;sha&gt;)\n\n- Tarball extracts to 'openeo-solar-&lt;sha&gt;' not 'openeo-&lt;sha&gt;'\n- Write release.txt and run deploy script in the correct directory\n- Unblocks deployments that failed at release.txt write ([2426df3](https://github.com/sr-digitalhouse/openeo-solar/commit/2426df3513d49081fd8c815cb7e396ad18133172))
* **download:** use release tag_name instead of name to avoid spaces in refs\n\n- GitHub Release 'name' is a human title and may contain spaces (e.g., '0.5.4 Solar')\n- Use 'tag_name' for API ref resolution to produce valid commit/archive URLs\n- Keeps branches in list as before ([a3ba996](https://github.com/sr-digitalhouse/openeo-solar/commit/a3ba9960b0f42310ded6964ce1dc381b6336912a))
* **topup:** remember solar-threshold seen today and allow grid top-up until cut-off\n\n- Track last time solar &gt;= reservation + min top-up current\n- Allow top-up if seen once today, car present, before end time\n- Prevents false negatives when clouds reduce solar after initial threshold ([9d92d0a](https://github.com/sr-digitalhouse/openeo-solar/commit/9d92d0a5df376fd4cb0f689e80362b5f2318d7da))
* **ui:** enable vertical scrolling on Settings page for phones\n\n- Allow body vertical scroll in base_style.css\n- Explicitly allow scrolling on settings page to avoid clipped bottom on small screens ([e181ee2](https://github.com/sr-digitalhouse/openeo-solar/commit/e181ee27727289b424c2cacdebb1c3158920836b))

## [0.2.3](https://github.com/minceheid/openeo/compare/v0.2.2...v0.2.3) (2025-07-24)


### Bug Fixes

* Correct publishing when Release Please runs ([#29](https://github.com/minceheid/openeo/issues/29)) ([0c59593](https://github.com/minceheid/openeo/commit/0c595930298de40d6aaeaa7dd42ab1fe5c78eaf2))

## [0.2.2](https://github.com/minceheid/openeo/compare/v0.2.1...v0.2.2) (2025-07-23)


### Bug Fixes

* ensure that all duty cycle values are uppercase ([f97666e](https://github.com/minceheid/openeo/commit/f97666eb667d3ae8bcd45ceaf7a371d3d4922c7b))
* ensure that all duty cycle values are uppercase ([8b9f65b](https://github.com/minceheid/openeo/commit/8b9f65bcf8227c83c20364837c702bf56b6cdf53))
* make charging more permissive ([f4bca82](https://github.com/minceheid/openeo/commit/f4bca8214ff6b3c56d8d1a922d1c5f7f31c10bc0))
* make charging more permissive ([3a6047e](https://github.com/minceheid/openeo/commit/3a6047e4c5b2e4842970cee74caa952d1b47ac77))

## 0.2.0 (2025-07-20)


### Features

* Add .gitattributes and apply to existing files ([062ef87](https://github.com/minceheid/openeo/commit/062ef87e925a3fd9b0d380dee9f6b818f7268d85))
* Add publishing mechanism ([41d4a63](https://github.com/minceheid/openeo/commit/41d4a6347dcaaacb347e7ca932fd9e6bf8f38770))


### Bug Fixes

* Update release please ([1be6f8b](https://github.com/minceheid/openeo/commit/1be6f8b366f735efb86f74ae8dea9f5b55cf2675))
