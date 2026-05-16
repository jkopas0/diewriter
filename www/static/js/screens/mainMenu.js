var eyes, mouth;

const mainMenu = (canvas, ctx, input, prefabs, state) => {
	mainMenu.frame = (mainMenu.frame ?? -1) + 1;

	switch (mainMenu.frame % 460) {
		case 0:   eyes = "open";   mouth = "smile";    break;
		case 60:  eyes = "closed";                     break;
		case 70:  eyes = "open";                       break;
		case 75:  eyes = "closed";                     break;
		case 80:  eyes = "open";   mouth = "flat";     break;
		case 180: eyes = "closed"; mouth = "dot";      break;
		case 200: eyes = "open";                       break;
		case 240: eyes = "angry";  mouth = "left_dot"; break;
		case 260: eyes = "open";                       break;
		case 300: eyes = "sad";                        break;
		case 340: eyes = "closed"; mouth = "dot";      break;
		case 380: eyes = "angry";  mouth = "frown";    break;
		case 420: eyes = "closed";                     break;
		default: break;
	}

	prefabs.face.render(1.4 * canvas.width / 2, canvas.height / 2, eyes, mouth);

	const menuItems = [
		{ label: "Start game",   action: () => { state.screen = "gameScreen"; } },
		{ label: "Achievements", action: () => { state.screen = "achievementMenu"; } },
		{ label: "Settings",     action: () => { state.screen = "settingsMenu"; } },
	];

	const typedLower = input.typed.toLowerCase();

	// Check for full match first
	for (const item of menuItems) {
		if (typedLower === item.label.toLowerCase()) {
			item.action();
			input.typed = "";
			break;
		}
	}

	if (typedLower === "\x79\x6F\x75\x72\x20\x73\x61\x66\x65\x74\x79\x20\x69\x73\x20\x6E\x6F\x74\x20\x67\x75\x61\x72\x61\x6E\x74\x65\x65\x64") {
		console.log("\x54\x68\x65\x79\x20\x61\x72\x65\x20\x77\x61\x74\x63\x68\x69\x6E\x67\x2E");
		state.achievements.add("\x77\x61\x74\x63\x68\x65\x72\x73");
		input.typed = "";
	} else if (typedLower === "\x74\x68\x65\x72\x65\x20\x69\x73\x20\x6E\x6F\x20\x70\x6C\x61\x63\x65\x20\x6C\x69\x6B\x65\x20\x68\x6F\x6D\x65") {
		console.log("\x48\x6F\x6D\x65\x3A\x20\x31\x32\x37\x2E\x30\x2E\x30\x2E\x31");
		state.achievements.add("\x68\x6F\x6D\x65\x31");
		input.typed = "";
	} else if (typedLower === "\x63\x6F\x20\x74\x79\x20\x6F\x64\x6B\x75\x72\x77\x69\x61\x73\x7A") {
		console.log("\x63\x68\x6C\x65\x62\x20\x7A\x20\x63\x65\x6D\x65\x6E\x74\x65\x6D");
		state.achievements.add("\x63\x65\x6D\x65\x6E\x74");
		input.typed = "";
	}

	// Find partial match for highlight
	const matchedItem = typedLower.length > 0
		? menuItems.find(item => item.label.toLowerCase().startsWith(typedLower))
		: null;
	input.completion = matchedItem ? matchedItem.label : null;

	new GameObject.Text(ctx, "#FFFFFFFF", "Fnuy xD", 100, 100, 64, 'sans-serif').render();

	const yStart = 220;
	menuItems.forEach((item, i) => {
		const color = matchedItem === item ? "#FFFF00FF" : "#FFFFFFFF";
		new GameObject.Text(ctx, color, item.label, 100, 200 + i * 50, 48, 'sans-serif').render();
	});

	// Show typed buffer — red if no match, white if partial match or empty
	if (input.typed.length > 0) {
		const color = matchedItem ? "#FFFFFFCF" : "#FF4444EF";
		new GameObject.Text(ctx, color, `> ${input.typed}`, 100, 420, 32, 'sans-serif').render();
	}

	new GameObject.Text(ctx, "#FFFFFF5F", "Tip: Use your keyboard.", 100, 550, 24, 'sans-serif').render();
}