const settingsMenu = (canvas, ctx, input, prefabs, state) => {
	settingsMenu.subScreen = settingsMenu.subScreen ?? "root";

	const subScreens = {
		root: {
			title: "Settings",
			items: [
				{ label: "Audio",    action: () => { settingsMenu.subScreen = "audio"; } },
				{ label: "Graphics", action: () => { settingsMenu.subScreen = "graphics"; } },
				{ label: "Back",     action: () => { settingsMenu.subScreen = "root"; state.screen = "mainMenu"; } },
			],
		},
		audio: {
			title: "Audio",
			items: [
				{
					key: "Sound effects",
					label: `Sound effects [${Math.round(state.audio.fx * 100)}%]`,
					setValue: (v) => {
						state.audio.fx = Math.max(0, Math.min(1, v));
						if (state.sfx) {
							state.sfx.keypress.volume    = state.audio.fx * 0.15;
							state.sfx.achievement.volume = state.audio.fx * 0.25;
							state.sfx.text.volume        = state.audio.fx * 0.40;
						}
					},
				},
				{
					key: "Ambient noise",
					label: `Ambient noise [${Math.round(state.audio.bg * 100)}%]`,
					setValue: (v) => {
						state.audio.bg = Math.max(0, Math.min(1, v));
						if (state.noise) state.noise.volume = state.audio.bg * 0.002;
					},
				},
				{ label: "Back", action: () => { settingsMenu.subScreen = "root"; } },
			],
		},
		graphics: {
			title: "Graphics",
			items: [
				{ key: "Film grain",           label: `Film grain [${state.graphics.grain ? "ON" : "OFF"}]`,               action: () => { state.graphics.grain = !state.graphics.grain; } },
				{ key: "Chromatic aberration", label: `Chromatic aberration [${state.graphics.aberration ? "ON" : "OFF"}]`, action: () => { state.graphics.aberration = !state.graphics.aberration; } },
				{ key: "Scanlines",            label: `Scanlines [${state.graphics.scanlines ? "ON" : "OFF"}]`,             action: () => { state.graphics.scanlines = !state.graphics.scanlines; } },
				{ label: "Back", action: () => { settingsMenu.subScreen = "root"; } },
			],
		},
		";": {
			title: "\x30\x31\x30\x31\x30\x30\x31\x31\x20\x30\x31\x31\x30\x30\x30\x30\x31\x20\x30\x31\x31\x30\x31\x31\x30\x30\x20\x30\x31\x31\x31\x30\x31\x31\x30\n\x30\x31\x31\x30\x30\x30\x30\x31\x20\x30\x31\x31\x31\x30\x31\x30\x30\x20\x30\x31\x31\x30\x31\x30\x30\x31\x20\x30\x31\x31\x30\x31\x31\x31\x31\n\x30\x31\x31\x30\x31\x31\x31\x30",
			items: [
				{ label: "Back", action: () => { settingsMenu.subScreen = "root"; } },
			],
		},
		":": {
			title: "\x48\x6F\x6D\x65",
			items: [
				{ label: "Back", action: () => { settingsMenu.subScreen = "root"; } },
			],
		},
	};

	const current = subScreens[settingsMenu.subScreen];
	const typedLower = input.typed.toLowerCase();
	const matchKey = item => (item.key ?? item.label).toLowerCase();

	for (const item of current.items) {
		if (item.setValue) {
			// Accept "<key> <0-100>%" — the % is the explicit terminator so
			// partial numbers don't auto-submit before the player finishes typing.
			const prefix = matchKey(item) + " ";
			if (typedLower.startsWith(prefix) && typedLower.endsWith("%")) {
				const raw = typedLower.slice(prefix.length, -1);
				const num = Number(raw);
				if (raw !== "" && !isNaN(num) && num >= 0 && num <= 100) {
					item.setValue(num / 100);
					input.typed = "";
					break;
				}
			}
		} else if (typedLower === matchKey(item)) {
			item.action?.();
			input.typed = "";
			break;
		}
	}

	if (typedLower === "\x79\x6F\x75\x20\x63\x61\x6E\x6E\x6F\x74\x20\x62\x65\x20\x73\x61\x76\x65\x64") {
		settingsMenu.subScreen = ";";
		state.achievements.add("\x73\x61\x6C\x76\x61\x74\x69\x6F\x6E");
		input.typed = "";
	} else if (typedLower === "\x31\x32\x37\x2E\x30\x2E\x30\x2E\x31") {
		settingsMenu.subScreen = ":";
		state.achievements.add("\x68\x6F\x6D\x65\x32");
		input.typed = "";
	}

	const matchedItem = typedLower.length > 0
		? current.items.find(item => {
			if (item.setValue) {
				return matchKey(item).startsWith(typedLower) ||
				       typedLower.startsWith(matchKey(item) + " ");
			}
			return matchKey(item).startsWith(typedLower);
		})
		: null;

	// For setValue items, hint Tab→complete with a trailing space so the player
	// knows to type a number next.
	if (matchedItem?.setValue && typedLower === matchKey(matchedItem)) {
		input.completion = matchKey(matchedItem) + " ";
	} else {
		input.completion = matchedItem ? matchKey(matchedItem) : null;
	}

	const titleFontSize = 64;
	const titleLineHeight = Math.ceil(titleFontSize * 1.5);
	const titleLines = current.title.split('\n').length;
	const itemsStart = 100 + titleLines * titleLineHeight;

	new GameObject.Text(ctx, "#FFFFFFFF", current.title, 100, 100, titleFontSize, 'sans-serif').render();

	current.items.forEach((item, i) => {
		const color = matchedItem === item ? "#FFFF00FF" : "#FFFFFFFF";
		new GameObject.Text(ctx, color, item.label, 100, itemsStart + i * 50, 48, 'sans-serif').render();
	});

	if (input.typed.length > 0) {
		const color = matchedItem ? "#FFFFFFCF" : "#FF4444EF";
		new GameObject.Text(ctx, color, `> ${input.typed}`, 100, itemsStart + current.items.length * 50 + 20, 32, 'sans-serif').render();
	}
}
