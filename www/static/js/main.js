const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

const FRAME_MS = 1000 / 60;

const loop = (canvas, ctx, shaders, tgt, pipeline, input, prefabs, state, lastTime = 0) => {
	requestAnimationFrame((now) => {
		if (now - lastTime < FRAME_MS) {
			loop(canvas, ctx, shaders, tgt, pipeline, input, prefabs, state, lastTime);
			return;
		}

		document.getElementById("loading")?.remove();

		ctx.bindFramebuffer(ctx.FRAMEBUFFER, tgt.framebuffer);
		ctx.clearColor(0.1, 0.1, 0.1, 1);
		ctx.clear(ctx.COLOR_BUFFER_BIT);

		input.pressed = input.pressed ?? new Set();
		const screens = { mainMenu, settingsMenu, gameScreen, achievementMenu };
		screens[state.screen](canvas, ctx, input, prefabs, state);

		if (state.achievementPopup) {
			const popup = state.achievementPopup;
			const achievement = ACHIEVEMENTS.find(a => a.id === popup.id);
			if (achievement) {
				const f = popup.frames;
				const alpha = f > 270 ? (300 - f) / 30 : f < 60 ? f / 60 : 1;
				const hex = v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0').toUpperCase();
				new GameObject.Quad(ctx, `#111111${hex(alpha * 0.9)}`,
					[785, 500], [1265, 500],
					[785, 620], [1265, 620]
				).render();
				new GameObject.Text(ctx, `#FFCC44${hex(alpha)}`, "Achievement Unlocked!", 800, 516, 17, 'sans-serif').render();
				new GameObject.Text(ctx, `#FFFFFF${hex(alpha)}`, achievement.name, 800, 545, 28, 'sans-serif').render();
				new GameObject.Text(ctx, `#AAAAAA${hex(alpha * 0.85)}`, achievement.description, 800, 589, 14, 'sans-serif').render();
			}
			if (--popup.frames <= 0) state.achievementPopup = null;
		}

		input.pressed.clear();

		const steps = [];
		if (state.graphics.aberration) steps.push((ctx, tex) => Shader.applyAberrationShader(ctx, shaders["aberration"], tex, 0.001, 0.002));
		if (state.graphics.grain)      steps.push((ctx, tex) => Shader.applyGrainShader(ctx, shaders["grain"], tex, now / 1000, 0.08));
		if (state.graphics.scanlines)  steps.push((ctx, tex) => Shader.applyScanlineShader(ctx, shaders["scanline"], tex, canvas.height / 2, 0.75));
		if (steps.length === 0)        steps.push((ctx, tex) => Shader.applyGrainShader(ctx, shaders["grain"], tex, 0, 0));
		Shader.runPipeline(ctx, pipeline, tgt.texture, steps);

		loop(canvas, ctx, shaders, tgt, pipeline, input, prefabs, state, now);
	});
}

const main = async () => {
	const canvas = document.getElementById("main");

	canvas.width = 1280;
	canvas.height = 640;

	const ctx = canvas.getContext("webgl");

	if (ctx == null) {
		const loading = document.getElementById("loading");
		if (loading) loading.textContent = "WebGL is not supported by your browser.";
		return;
	}

	await yieldToMain();
	const aberrationShader = Shader.createAberrationShader(ctx);
	await yieldToMain();
	const grainShader = Shader.createGrainShader(ctx);
	await yieldToMain();
	const scanlineShader = Shader.createScanlineShader(ctx);
	const shaders = { aberration: aberrationShader, grain: grainShader, scanline: scanlineShader };

	await yieldToMain();
	const tgt = Shader.createRenderTarget(ctx);
	await yieldToMain();
	const pipeline = Shader.createPipeline(ctx);
	await yieldToMain();

	let audioReady = false;
	const initAudio = () => {
		if (audioReady) return;
		audioReady = true;

		const noise = new Audio("/static/assets/sfx/White Noise.ogg");
		noise.loop = true;
		noise.volume = state.audio.bg * 0.002;
		noise.play().catch(() => {});
		state.noise = noise;

		state.sfx = {
			keypress:    new Audio("/static/assets/sfx/keypress.ogg"),
			achievement: new Audio("/static/assets/sfx/achievement.ogg"),
			text:        new Audio("/static/assets/sfx/text.ogg"),
		};
		state.sfx.keypress.volume    = state.audio.fx * 0.15;
		state.sfx.achievement.volume = state.audio.fx * 0.25;
		state.sfx.text.volume        = state.audio.fx * 0.40;
	};

	const input = { keys: new Set(), pressed: new Set(), typed: "" };
	window.addEventListener("keydown", e => {
		initAudio();
		if (state.sfx) {
			state.sfx.keypress.currentTime = 0;
			state.sfx.keypress.play().catch(() => {});
		}
		input.keys.add(e.code);
		input.pressed.add(e.code);
		if (e.code === "Escape") {
			input.typed = "";
		} else if (e.code === "Tab") {
			e.preventDefault();
			if (input.completion) input.typed = input.completion;
		} else if (e.code === "Backspace") {
			input.typed = input.typed.slice(0, -1);
		} else if (e.key.length === 1) {
			input.typed += e.key;
		}
	});
	window.addEventListener("keyup", e => input.keys.delete(e.code));

	const prefabs = { face: new Prefab.Face(ctx) };
	const achievementsSet = new Set();
	const achievements = new Proxy(achievementsSet, {
		get(target, prop) {
			if (prop === "add") {
				return (id) => {
					if (!target.has(id)) {
						if (state.sfx) {
							state.sfx.achievement.currentTime = 0;
							state.sfx.achievement.play().catch(() => {});
						}
						state.achievementPopup = { id, frames: 300 };
					}
					return target.add(id);
				};
			}
			const val = target[prop];
			return typeof val === "function" ? val.bind(target) : val;
		}
	});
	const state = { screen: "mainMenu", audio: { fx: 1.0, bg: 1.0 }, graphics: { grain: true, aberration: true, scanlines: true }, achievements, achievementPopup: null, noise: null, sfx: null };
	loop(canvas, ctx, shaders, tgt, pipeline, input, prefabs, state);
}

main();
