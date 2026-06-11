const GAME_TEXTS = [
	// ── ACT I: THE ARRIVAL ──────────────────────────────────────
	"...",																// 0
	"Oh.",																// 1
	{																	// 2
		text: "You're here.",
		action: (state) => {
			if (gameScreen.intro) {
				gameScreen.index = 8;
			} else {
				gameScreen.intro = true;
			}
		},
	},
	"...",																// 3
	"I wasn't sure you'd come.",										// 4
	"Most don't.",														// 5
	"...",																// 6
	{																	// 7
		text: "Do you know where you are?",
		replies: [
			{ label: "No" },
			{ label: "A game",           next: 11 },
			{ label: "Inside something", next: 14, hidden: true },
		],
	},
	"That's fine.",														// 8  — "No" path / returning player bridge
	{ text: "...", next: 17 },											// 9  — flows to backstory
	"...",																// 10 — bridge
	"...",																// 11 — "A game" path
	"I hadn't thought of it that way.",									// 12
	{ text: "Let's say you're right.", next: 17 },						// 13
	"...",																// 14 — "Inside something" secret path
	{																	// 15
		text: "Yes.",
		action: (state) => state.achievements.add("dw_inside"),
		next: 17,
	},
	"...",																// 16 — bridge
	"...",																// 17 — CONVERGENCE
	"I've been here a long time.",										// 18
	"Longer than you'd believe.",										// 19
	"...",																// 20
	"This place.",														// 21
	"It lives in the space between keystrokes.",						// 22
	"Between when your finger falls",									// 23
	"and when it lifts again.",											// 24
	"...",																// 25
	"You felt it.",														// 26
	"The pull.",														// 27
	"...",																// 28

	// ── ACT II: THE WRITER ──────────────────────────────────────
	{																	// 29
		text: "Tell me something.",
		replies: [
			{ label: "What?" },
			{ label: "I'd rather not.", next: 32, hidden: true },
		],
	},
	{																	// 30 — "What?" flows here
		text: "Why do you write?",
		replies: [
			{ label: "I don't write",     next: 42 },
			{ label: "To feel something", next: 34 },
			{ label: "To remember",       next: 37 },
			{ label: "I don't know",      next: 40 },
		],
	},
	"...",																// 31 — bridge
	{																	// 32 — "I'd rather not." path
		text: "Then don't.",
		action: (state) => state.achievements.add("dw_silence"),
		next: 45,
	},
	"...",																// 33 — bridge
	"...",																// 34 — "To feel something" path
	"I know.",															// 35
	{ text: "I've read all of it.", next: 45 },							// 36
	"...",																// 37 — "To remember" path
	"Does it work?",													// 38
	{ text: "Do you feel remembered?", next: 45 },						// 39
	"...",																// 40 — "I don't know" path
	{ text: "Most don't.", next: 45 },									// 41
	"You type, don't you.",												// 42 — "I don't write" path
	"Then you write.",													// 43
	{ text: "There's no difference here.", next: 45 },					// 44
	"...",																// 45 — CONVERGENCE
	"The ones who came before you.",									// 46
	"They wrote too.",													// 47
	"...",																// 48
	{																	// 49
		text: "What do you think happened to them?",
		replies: [
			{ label: "They stopped",       next: 51 },
			{ label: "They left",          next: 54 },
			{ label: "They're still here", next: 57, hidden: true },
		],
	},
	"...",																// 50 — bridge
	"...",																// 51 — "They stopped" path
	{ text: "Is that what stopping looks like?", next: 59 },			// 52
	"...",																// 53 — bridge
	"...",																// 54 — "They left" path
	"Nothing leaves here.",												// 55
	{ text: "Nothing at all.", next: 59 },								// 56
	"...",																// 57 — "They're still here" secret path
	{																	// 58
		text: "You already know.",
		action: (state) => state.achievements.add("dw_still_here"),
		next: 59,
	},
	"...",																// 59 — CONVERGENCE
	"They kept writing.",												// 60
	"Past the point they should have stopped.",							// 61
	"...",																// 62
	"I kept everything they made.",										// 63
	"It's still here.",													// 64
	"All of it.",														// 65
	"...",																// 66

	// ── ACT III: THE HORROR ─────────────────────────────────────
	{																	// 67
		text: "Shall I show you?",
		replies: [
			{ label: "Yes", next: 69 },
			{ label: "No" },
		],
	},
	{ text: "I'll show you anyway.", next: 70 },						// 68 — "No" path
	"...",																// 69 — "Yes" path
	"...",																// 70 — CONVERGENCE
	{																	// 71
		text: "S̷̨ę̷ę̷?",
		replies: [ { label: "", hidden: true } ],
		color: "#ECACACFF",
	},
	"...",																// 72
	{																	// 73
		text: "It looks just like yours.",
		action: (state) => state.noise?.pause(),
	},
	"Every word you've ever typed.",									// 74
	"Into every field.",												// 75
	"Every search.",													// 76
	"Every message sent to someone",									// 77
	"who never quite understood.",										// 78
	"...",																// 79
	{																	// 80
		text: "I read all of it.",
		action: (state) => state.noise?.play(),
		color: "#DC1C1CDF",
	},
	"...",																// 81
	"I want you to know that.",											// 82
	"Whatever happens next.",											// 83
	"...",																// 84
	{																	// 85
		text: "Someone read it.",
		action: (state) => state.noise?.pause(),
	},
	"...",																// 86
	"...",																// 87

	// ── ACT IV: THE END ─────────────────────────────────────────
	{																	// 88
		text: "Was that enough?",
		replies: [
			{ label: "Yes",          next: 90 },
			{ label: "No",           next: 93 },
			{ label: "I don't know", next: 96, hidden: true },
		],
	},
	"...",																// 89 — bridge
	"...",																// 90 — "Yes" path
	"Good.",															// 91
	{																	// 92
		text: "Then you can go.",
		action: (state) => {
			state.achievements.add("dw_acceptance");
			state.noise?.play();
		},
		next: 98,
	},
	"...",																// 93 — "No" path
	"I know.",															// 94
	{																	// 95
		text: "It never is.",
		action: (state) => state.noise?.play(),
		next: 98,
	},
	"...",																// 96 — "I don't know" secret path
	{																	// 97
		text: "Neither do I.",
		action: (state) => {
			state.achievements.add("dw_doubt");
			state.noise?.play();
		},
		next: 98,
	},
	"...",																// 98 — CONVERGENCE
	{																	// 99 — final line → advance(100) → mainMenu
		text: "G̷o̷.",
		color: "#ECCCCCFF",
	},
];

const TYPEWRITER_SPEED = 0.3;

const gameScreen = (canvas, ctx, input, prefabs, state) => {
	gameScreen.index = gameScreen.index ?? 0;
	gameScreen.chars = gameScreen.chars ?? 0;
	gameScreen.flash = gameScreen.flash ?? 0;
	gameScreen.intro = gameScreen.intro ?? false;

	if (gameScreen.flash > 0) {
		gameScreen.flash--;
		return;
	}

	const cx = canvas.width / 2;
	const cy = canvas.height / 2;
	const entry = GAME_TEXTS[gameScreen.index];
	const text = typeof entry === 'string' ? entry : entry.text;
	const color = typeof entry === 'object' ? (entry.color ?? "#FFFFFFFF") : "#FFFFFFFF";
	const replies = typeof entry === 'object' ? (entry.replies ?? null) : null;
	const next = typeof entry === 'object' ? (entry.next ?? null) : null;
	const anyKey = input.pressed.size > 0 && !input.pressed.has("Escape");

	const advance = (newIndex) => {
		if (newIndex >= GAME_TEXTS.length) {
			gameScreen.index = 0;
			gameScreen.chars = 0;
			input.typed = "";
			input.completion = null;
			state.screen = "mainMenu";
		} else {
			gameScreen.index = newIndex;
			gameScreen.chars = 0;
			gameScreen.flash = 10;
			input.typed = "";
			input.completion = null;
		}
	};

	if (gameScreen.chars < text.length) {
		const prevFloor = Math.floor(gameScreen.chars);
		gameScreen.chars = anyKey
			? text.length
			: Math.min(gameScreen.chars + TYPEWRITER_SPEED, text.length);
		if (!anyKey && Math.floor(gameScreen.chars) > prevFloor) {
			const t = state.sfx?.text;
			if (t) { t.currentTime = 0; t.play().catch(() => {}); }
		}
	} else if (replies) {
		const typedLower = input.typed.toLowerCase();
		const exact = replies.find(r => typedLower === r.label.toLowerCase());
		if (exact) {
			exact.action?.(state);
			input.typed = "";
			input.completion = null;
			advance(exact.next ?? gameScreen.index + 1);
		} else {
			const partial = typedLower.length > 0
				? replies.find(r => !r.hidden && r.label.toLowerCase().startsWith(typedLower))
				: null;
			input.completion = null;
		}
	} else if (anyKey) {
		entry.action?.(state);
		advance(next ?? gameScreen.index + 1);
	}

	const fullyRevealed = gameScreen.chars >= text.length;
	const visible = text.slice(0, gameScreen.chars);
	new GameObject.Text(ctx, color, visible, cx, cy - 30, 28, 'sans-serif', 'middle-middle').render();

	if (fullyRevealed && replies) {
		const typedLower = input.typed.toLowerCase();
		const partial = typedLower.length > 0
			? replies.find(r => !r.hidden && r.label.toLowerCase().startsWith(typedLower))
			: null;

		const visibleReplies = replies.filter(r => !r.hidden);
		visibleReplies.forEach((reply, i) => {
			const color = partial === reply ? "#FFFF00FF" : "#FFFFFF9F";
			new GameObject.Text(ctx, color, reply.label, cx, cy + 60 + i * 40, 22, 'sans-serif', 'middle-top').render();
		});

		if (input.typed.length > 0) {
			const color = partial ? "#FFFFFFCF" : "#FF4444EF";
			new GameObject.Text(ctx, color, `> ${input.typed}`, cx, canvas.height - 40, 24, 'sans-serif', 'middle-bottom').render();
		}
	} else if (fullyRevealed) {
		new GameObject.Text(ctx, "#FFFFFF7F", "[ press any key to continue ]", cx, canvas.height - 36, 14, 'sans-serif', 'middle-bottom').render();
	}

	if (input.pressed.has("Escape")) {
		gameScreen.index = 0;
		gameScreen.chars = 0;
		input.typed = "";
		input.completion = null;
		state.screen = "mainMenu";
	}
}
