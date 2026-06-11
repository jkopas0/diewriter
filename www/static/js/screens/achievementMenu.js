const ACHIEVEMENTS = [
	{ id: "blind_trust",    name: "Blind Trust",      description: "Let us begin.",                          secret: false },
	{ id: "dw_inside",     name: "Between Lines",     description: "You knew before you were told.",         secret: true  },
	{ id: "dw_silence",    name: "Right to Remain",   description: "It heard you anyway.",                   secret: true  },
	{ id: "dw_still_here", name: "Residue",           description: "They never really left.",                secret: true  },
	{ id: "dw_acceptance", name: "Enough",            description: "It was always enough.",                  secret: true  },
	{ id: "dw_doubt",      name: "Honest",            description: "Uncertainty is the most honest answer.", secret: true  },
	{ id: "\x77\x61\x74\x63\x68\x65\x72\x73", name: "\x59\x6F\x75\x20\x43\x61\x6E\x27\x74\x20\x48\x69\x64\x65", description: "\x54\x68\x65\x79\x20\x61\x72\x65\x20\x77\x61\x74\x63\x68\x69\x6E\x67\x2E", secret: true },
	{ id: "\x68\x6F\x6D\x65\x31", name: "\x54\x68\x65\x72\x65\x20\x69\x73\x20\x6E\x6F\x20\x70\x6C\x61\x63\x65\x2E\x2E\x2E", description: "\x4C\x6F\x73\x74\x20\x69\x6E\x20\x66\x69\x6E\x69\x74\x65\x20\x70\x61\x74\x68\x73\x2E", secret: true },
	{ id: "\x68\x6F\x6D\x65\x32", name: "\x2E\x2E\x2E\x6C\x69\x6B\x65\x20\x68\x6F\x6D\x65\x2E", description: "\x42\x61\x63\x6B\x20\x77\x68\x65\x72\x65\x20\x69\x74\x20\x61\x6C\x6C\x20\x73\x74\x61\x72\x74\x65\x64\x2E", secret: true },
	{ id: "\x73\x61\x6C\x76\x61\x74\x69\x6F\x6E", name: "\x55\x6E\x73\x61\x6C\x76\x61\x67\x65\x61\x62\x6C\x65", description: "\x53\x6F\x6D\x65\x20\x74\x68\x69\x6E\x67\x73\x20\x63\x61\x6E\x27\x74\x20\x62\x65\x20\x66\x69\x78\x65\x64\x2E", secret: true },
];

const achievementMenu = (canvas, ctx, input, prefabs, state) => {
	const ROWS       = 4;
	const COL_WIDTH  = 420;
	const START_X    = 100;
	const RIGHT_PAD  = 80;
	const ENTRY_H    = 80;

	const titleFontSize  = 64;
	const titleLineH     = Math.ceil(titleFontSize * 1.5);
	const listStart      = 100 + titleLineH + 32;
	const viewportW      = canvas.width - START_X - RIGHT_PAD;
	const totalCols      = Math.ceil(ACHIEVEMENTS.length / ROWS);
	const maxScroll      = Math.max(0, totalCols * COL_WIDTH - viewportW);

	achievementMenu.targetScroll = achievementMenu.targetScroll ?? 0;
	achievementMenu.scroll       = achievementMenu.scroll       ?? 0;

	if (input.pressed.has("ArrowRight"))
		achievementMenu.targetScroll = Math.min(achievementMenu.targetScroll + COL_WIDTH, maxScroll);
	if (input.pressed.has("ArrowLeft"))
		achievementMenu.targetScroll = Math.max(achievementMenu.targetScroll - COL_WIDTH, 0);

	achievementMenu.scroll += (achievementMenu.targetScroll - achievementMenu.scroll) * 0.15;

	// Back navigation
	const menuItems = [
		{ label: "Back", action: () => { state.screen = "mainMenu"; } },
	];
	const typedLower = input.typed.toLowerCase();
	for (const item of menuItems) {
		if (typedLower === item.label.toLowerCase()) {
			item.action();
			input.typed = "";
			break;
		}
	}
	const matchedItem = typedLower.length > 0
		? menuItems.find(item => item.label.toLowerCase().startsWith(typedLower))
		: null;
	input.completion = matchedItem ? matchedItem.label : null;

	// Title + count
	const obtained = state.achievements;
	const obtainedCount = ACHIEVEMENTS.filter(a => obtained.has(a.id)).length;
	new GameObject.Text(ctx, "#FFFFFFFF", "Achievements", START_X, 100, titleFontSize, 'sans-serif').render();
	new GameObject.Text(ctx, "#FFFFFF7F", `${obtainedCount} / ${ACHIEVEMENTS.length}`, START_X, 100 + titleLineH, 24, 'sans-serif').render();

	// Achievement entries
	const scroll = achievementMenu.scroll;
	ACHIEVEMENTS.forEach((achievement, i) => {
		const col = Math.floor(i / ROWS);
		const row = i % ROWS;
		const x = START_X + col * COL_WIDTH - scroll;
		const y = listStart + row * ENTRY_H;

		if (x + COL_WIDTH < 0 || x > canvas.width) return;

		const isObtained = obtained.has(achievement.id);
		const isHidden   = achievement.secret && !isObtained;
		const nameColor  = isObtained ? "#FFFFFFFF" : "#606060FF";
		const descColor  = isObtained ? "#FFFFFF9F" : "#3F3F3FFF";
		const name = isHidden ? "???" : achievement.name;
		const desc = isHidden ? "???" : achievement.description;

		new GameObject.Text(ctx, nameColor, name, x,      y,      32, 'sans-serif').render();
		new GameObject.Text(ctx, descColor, desc, x + 16, y + 38, 20, 'sans-serif').render();
	});

	// Scrollbar
	const barY = listStart + ROWS * ENTRY_H + 16;
	const trackW = viewportW;
	new GameObject.Quad(ctx, "#FFFFFF2F",
		[START_X,           barY], [START_X + trackW,           barY],
		[START_X,           barY + 4], [START_X + trackW,       barY + 4]
	).render();
	if (maxScroll > 0) {
		const thumbW = Math.max(40, trackW * viewportW / (totalCols * COL_WIDTH));
		const thumbX = START_X + (scroll / maxScroll) * (trackW - thumbW);
		new GameObject.Quad(ctx, "#FFFFFFFF",
			[thumbX,          barY], [thumbX + thumbW,          barY],
			[thumbX,          barY + 4], [thumbX + thumbW,      barY + 4]
		).render();
	}

	// Back item + typed buffer
	const backY = barY + 24;
	menuItems.forEach((item, i) => {
		const color = matchedItem === item ? "#FFFF00FF" : "#FFFFFFFF";
		new GameObject.Text(ctx, color, item.label, START_X, backY + i * 40, 32, 'sans-serif').render();
	});
	if (input.typed.length > 0) {
		const color = matchedItem ? "#FFFFFFCF" : "#FF4444EF";
		new GameObject.Text(ctx, color, `> ${input.typed}`, START_X + 120, backY, 32, 'sans-serif').render();
	}
}
