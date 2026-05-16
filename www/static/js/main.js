const FRAME_MS = 1000 / 60;

const loop = (canvas, ctx, shaders, tgt, pipeline, input, prefabs, state, lastTime = 0) => {
	requestAnimationFrame((now) => {
		if (now - lastTime < FRAME_MS) {
			loop(canvas, ctx, shaders, tgt, pipeline, input, prefabs, state, lastTime);
			return;
		}

		ctx.bindFramebuffer(ctx.FRAMEBUFFER, tgt.framebuffer);
		ctx.clearColor(0.1, 0.1, 0.1, 1);
		ctx.clear(ctx.COLOR_BUFFER_BIT);

		input.pressed = input.pressed ?? new Set();
		const screens = { mainMenu, settingsMenu, gameScreen, achievementMenu };
		screens[state.screen](canvas, ctx, input, prefabs, state);
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

const main = () => {
	const canvas = document.getElementById("main");

	const noise = new Audio("/static/assets/sfx/White Noise.ogg");
	noise.loop = true;
	noise.volume = 0.002;
	noise.play().catch(() => {
		const resume = () => {
			noise.play();
			canvas.removeEventListener("click", resume);
			window.removeEventListener("keydown", resume);
		};
		canvas.addEventListener("click", resume);
		window.addEventListener("keydown", resume);
	});

	canvas.width = 1280;
	canvas.height = 640;

	const ctx = canvas.getContext("webgl");

	if (ctx == null) {
		alert("Failed to initialize WebGL.");
		return;
	}

	const shaders = {
		aberration: Shader.createAberrationShader(ctx),
		grain: Shader.createGrainShader(ctx),
		scanline: Shader.createScanlineShader(ctx),
	};
	const tgt = Shader.createRenderTarget(ctx);
	const pipeline = Shader.createPipeline(ctx);

	const keypressSfx = new Audio("/static/assets/sfx/keypress.ogg");
	keypressSfx.volume = 0.15;

	const input = { keys: new Set(), pressed: new Set(), typed: "" };
	window.addEventListener("keydown", e => {
		keypressSfx.currentTime = 0;
		keypressSfx.play().catch(() => {});
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
	window.addEventListener("keyup",   e => input.keys.delete(e.code));

	const prefabs = { face: new Prefab.Face(ctx) };
	const achievementSfx = new Audio("/static/assets/sfx/achievement.ogg");
	achievementSfx.volume = 0.25;
	const achievementsSet = new Set();
	const achievements = new Proxy(achievementsSet, {
		get(target, prop) {
			if (prop === "add") {
				return (id) => {
					if (!target.has(id)) {
						achievementSfx.currentTime = 0;
						achievementSfx.play().catch(() => {});
					}
					return target.add(id);
				};
			}
			const val = target[prop];
			return typeof val === "function" ? val.bind(target) : val;
		}
	});
	const state = { screen: "mainMenu", graphics: { grain: true, aberration: true, scanlines: true }, achievements };
	loop(canvas, ctx, shaders, tgt, pipeline, input, prefabs, state);
}

main();
