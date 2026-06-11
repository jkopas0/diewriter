const Shader = (() => {
	const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

	const POST_FRAG = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_aberration;
uniform float u_grain_time;
uniform float u_grain_strength;
uniform float u_scanline_count;
uniform float u_scanline_strength;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float r = texture2D(u_texture, v_uv + u_aberration).r;
  float g = texture2D(u_texture, v_uv).g;
  float b = texture2D(u_texture, v_uv - u_aberration).b;
  float a = texture2D(u_texture, v_uv).a;
  vec3 color = vec3(r, g, b);
  color += (rand(v_uv + u_grain_time) - 0.5) * u_grain_strength;
  float band = sin(v_uv.y * u_scanline_count * 3.14159265) * 0.5 + 0.5;
  color *= 1.0 - u_scanline_strength * (1.0 - band);
  gl_FragColor = vec4(color, a);
}
`;

	const compileShader = (ctx, type, source) => {
		const shader = ctx.createShader(type);
		ctx.shaderSource(shader, source);
		ctx.compileShader(shader);
		if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
			console.error("Shader compile error:", ctx.getShaderInfoLog(shader));
			ctx.deleteShader(shader);
			return null;
		}
		return shader;
	};

	// Yields between compile steps so each is its own task, keeping each under 50ms.
	const createPostShader = async (ctx, yieldFn) => {
		const vert = compileShader(ctx, ctx.VERTEX_SHADER, VERT);
		await yieldFn();
		const frag = compileShader(ctx, ctx.FRAGMENT_SHADER, POST_FRAG);
		await yieldFn();

		if (!vert || !frag) return null;
		const program = ctx.createProgram();
		ctx.attachShader(program, vert);
		ctx.attachShader(program, frag);
		ctx.linkProgram(program);
		ctx.deleteShader(vert);
		ctx.deleteShader(frag);
		await yieldFn();

		if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
			console.error("Program link error:", ctx.getProgramInfoLog(program));
			ctx.deleteProgram(program);
			return null;
		}

		const quadBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			-1, -1,   1, -1,  -1,  1,
			-1,  1,   1, -1,   1,  1,
		]), ctx.STATIC_DRAW);

		return {
			program,
			positionLoc:         ctx.getAttribLocation(program, "a_position"),
			textureLoc:          ctx.getUniformLocation(program, "u_texture"),
			aberrationLoc:       ctx.getUniformLocation(program, "u_aberration"),
			grainTimeLoc:        ctx.getUniformLocation(program, "u_grain_time"),
			grainStrengthLoc:    ctx.getUniformLocation(program, "u_grain_strength"),
			scanlineCountLoc:    ctx.getUniformLocation(program, "u_scanline_count"),
			scanlineStrengthLoc: ctx.getUniformLocation(program, "u_scanline_strength"),
			quadBuffer,
		};
	};

	const applyPostShader = (ctx, shader, texture, graphics, now, canvasHeight) => {
		ctx.useProgram(shader.program);

		ctx.bindBuffer(ctx.ARRAY_BUFFER, shader.quadBuffer);
		ctx.enableVertexAttribArray(shader.positionLoc);
		ctx.vertexAttribPointer(shader.positionLoc, 2, ctx.FLOAT, false, 0, 0);

		ctx.activeTexture(ctx.TEXTURE0);
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.uniform1i(shader.textureLoc, 0);

		ctx.uniform2f(shader.aberrationLoc,
			graphics.aberration ? 0.001 : 0.0,
			graphics.aberration ? 0.002 : 0.0);
		ctx.uniform1f(shader.grainTimeLoc,        now / 1000);
		ctx.uniform1f(shader.grainStrengthLoc,    graphics.grain      ? 0.08 : 0.0);
		ctx.uniform1f(shader.scanlineCountLoc,    graphics.scanlines  ? canvasHeight / 2 : 0.0);
		ctx.uniform1f(shader.scanlineStrengthLoc, graphics.scanlines  ? 0.75 : 0.0);

		ctx.drawArrays(ctx.TRIANGLES, 0, 6);
	};

	const createRenderTarget = (ctx) => {
		const texture = ctx.createTexture();
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.texImage2D(
			ctx.TEXTURE_2D, 0, ctx.RGBA,
			ctx.drawingBufferWidth, ctx.drawingBufferHeight,
			0, ctx.RGBA, ctx.UNSIGNED_BYTE, null
		);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);

		const framebuffer = ctx.createFramebuffer();
		ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
		ctx.framebufferTexture2D(
			ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0,
			ctx.TEXTURE_2D, texture, 0
		);

		ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
		ctx.bindTexture(ctx.TEXTURE_2D, null);

		return { framebuffer, texture };
	};

	return { createPostShader, applyPostShader, createRenderTarget };
})();

const GameObject = (() => {
	const VERT = `
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_offset;
void main() {
  vec2 clip = ((a_position + u_offset) / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;
	const FRAG = `
precision mediump float;
uniform vec4 u_color;
void main() {
  gl_FragColor = u_color;
}
`;

	const TEXT_VERT = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
uniform vec2 u_resolution;
uniform vec2 u_offset;
varying vec2 v_texCoord;
void main() {
  vec2 clip = ((a_position + u_offset) / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;
	const TEXT_FRAG = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec4 u_color;
varying vec2 v_texCoord;
void main() {
  vec4 tex = texture2D(u_texture, v_texCoord);
  gl_FragColor = vec4(u_color.rgb, tex.a * u_color.a);
}
`;

	const programCache = new WeakMap();
	const textProgramCache = new WeakMap();

	const getProgram = (ctx) => {
		if (programCache.has(ctx)) return programCache.get(ctx);

		const compile = (type, src) => {
			const s = ctx.createShader(type);
			ctx.shaderSource(s, src);
			ctx.compileShader(s);
			if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
				console.error("Shader error:", ctx.getShaderInfoLog(s));
				ctx.deleteShader(s);
				return null;
			}
			return s;
		};

		const vert = compile(ctx.VERTEX_SHADER, VERT);
		const frag = compile(ctx.FRAGMENT_SHADER, FRAG);
		const program = ctx.createProgram();
		ctx.attachShader(program, vert);
		ctx.attachShader(program, frag);
		ctx.linkProgram(program);
		ctx.deleteShader(vert);
		ctx.deleteShader(frag);

		if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
			console.error("Program link error:", ctx.getProgramInfoLog(program));
			ctx.deleteProgram(program);
			return null;
		}

		const entry = {
			program,
			positionLoc: ctx.getAttribLocation(program, "a_position"),
			colorLoc: ctx.getUniformLocation(program, "u_color"),
			resolutionLoc: ctx.getUniformLocation(program, "u_resolution"),
			offsetLoc: ctx.getUniformLocation(program, "u_offset"),
		};
		programCache.set(ctx, entry);
		return entry;
	};

	const getTextProgram = (ctx) => {
		if (textProgramCache.has(ctx)) return textProgramCache.get(ctx);

		const compile = (type, src) => {
			const s = ctx.createShader(type);
			ctx.shaderSource(s, src);
			ctx.compileShader(s);
			if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
				console.error("Shader error:", ctx.getShaderInfoLog(s));
				ctx.deleteShader(s);
				return null;
			}
			return s;
		};

		const vert = compile(ctx.VERTEX_SHADER, TEXT_VERT);
		const frag = compile(ctx.FRAGMENT_SHADER, TEXT_FRAG);
		const program = ctx.createProgram();
		ctx.attachShader(program, vert);
		ctx.attachShader(program, frag);
		ctx.linkProgram(program);
		ctx.deleteShader(vert);
		ctx.deleteShader(frag);

		if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
			console.error("Program link error:", ctx.getProgramInfoLog(program));
			ctx.deleteProgram(program);
			return null;
		}

		const entry = {
			program,
			positionLoc: ctx.getAttribLocation(program, "a_position"),
			texCoordLoc: ctx.getAttribLocation(program, "a_texCoord"),
			colorLoc: ctx.getUniformLocation(program, "u_color"),
			resolutionLoc: ctx.getUniformLocation(program, "u_resolution"),
			textureLoc: ctx.getUniformLocation(program, "u_texture"),
			offsetLoc: ctx.getUniformLocation(program, "u_offset"),
		};
		textProgramCache.set(ctx, entry);
		return entry;
	};

	const colorCache = new Map();
	const parseHexColor = (hex) => {
		if (colorCache.has(hex)) return colorCache.get(hex);
		const h = hex.replace("#", "");
		const r = parseInt(h.slice(0, 2), 16) / 255;
		const g = parseInt(h.slice(2, 4), 16) / 255;
		const b = parseInt(h.slice(4, 6), 16) / 255;
		const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1.0;
		const result = [r, g, b, a];
		colorCache.set(hex, result);
		return result;
	};

	// Textures are keyed by content only — color is a shader uniform, not baked in.
	const textureCache = new Map();
	const posBufferCache = new Map();
	let sharedUvBuffer = null;

	// Sticky WebGL state — skip calls that haven't changed since the last draw.
	let _program = null;
	let _blendReady = false;
	const _enabledAttribs = new Set();

	const getTextTexture = (ctx, text, fontSize, font) => {
		const key = `${text}\x00${fontSize}\x00${font}`;
		if (textureCache.has(key)) return textureCache.get(key);

		const canvas2d = document.createElement('canvas');
		const c2d = canvas2d.getContext('2d');
		c2d.font = `${fontSize}px ${font}`;
		const lines = text.split('\n');
		const lineHeight = Math.ceil(fontSize * 1.5);
		const w = Math.ceil(Math.max(...lines.map(l => c2d.measureText(l).width)));
		const h = lineHeight * lines.length;
		canvas2d.width = w;
		canvas2d.height = h;
		c2d.font = `${fontSize}px ${font}`;
		c2d.fillStyle = '#ffffff';
		c2d.textBaseline = 'top';
		lines.forEach((line, i) => c2d.fillText(line, 0, i * lineHeight));

		const texture = ctx.createTexture();
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, canvas2d);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);

		const entry = { texture, w, h };
		textureCache.set(key, entry);
		return entry;
	};

	const getPosBuffer = (ctx, text, fontSize, font, x, y, anchor, w, h) => {
		const key = `${text}\x00${fontSize}\x00${font}\x00${x}\x00${y}\x00${anchor}`;
		if (posBufferCache.has(key)) return posBufferCache.get(key);

		const [h_part, v_part] = anchor.split('-');
		const ox = h_part === 'right' ? w : h_part === 'middle' ? w / 2 : 0;
		const oy = v_part === 'bottom' ? h : v_part === 'middle' ? h / 2 : 0;
		const x1 = x - ox, y1 = y - oy, x2 = x1 + w, y2 = y1 + h;
		const posBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, posBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			x1, y1,  x2, y1,  x1, y2,
			x2, y1,  x2, y2,  x1, y2,
		]), ctx.STATIC_DRAW);

		posBufferCache.set(key, posBuffer);
		return posBuffer;
	};

	const getUvBuffer = (ctx) => {
		if (sharedUvBuffer) return sharedUvBuffer;
		sharedUvBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, sharedUvBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			0, 0,  1, 0,  0, 1,
			1, 0,  1, 1,  0, 1,
		]), ctx.STATIC_DRAW);
		return sharedUvBuffer;
	};

	class Triangle {
		constructor(ctx, color, v1, v2, v3) {
			this.ctx = ctx;
			this.color = parseHexColor(color);

			this.buffer = ctx.createBuffer();
			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.buffer);
			ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
				v1[0], v1[1],
				v2[0], v2[1],
				v3[0], v3[1],
			]), ctx.STATIC_DRAW);
		}

		render(ox = 0, oy = 0) {
			const ctx = this.ctx;
			const prog = getProgram(ctx);
			if (!prog) return;

			if (prog.program !== _program) { ctx.useProgram(prog.program); _program = prog.program; }
			if (!_blendReady) { ctx.enable(ctx.BLEND); ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA); _blendReady = true; }

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.buffer);
			if (!_enabledAttribs.has(prog.positionLoc)) { ctx.enableVertexAttribArray(prog.positionLoc); _enabledAttribs.add(prog.positionLoc); }
			ctx.vertexAttribPointer(prog.positionLoc, 2, ctx.FLOAT, false, 0, 0);

			ctx.uniform2f(prog.resolutionLoc, ctx.drawingBufferWidth, ctx.drawingBufferHeight);
			ctx.uniform2f(prog.offsetLoc, ox, oy);
			ctx.uniform4fv(prog.colorLoc, this.color);
			ctx.drawArrays(ctx.TRIANGLES, 0, 3);
		}
	}

	class Quad {
		constructor(ctx, color, v1, v2, v3, v4) {
			this.tris = [new Triangle(ctx, color, v1, v2, v3), new Triangle(ctx, color, v2, v3, v4)];
		}

		render(ox = 0, oy = 0) {
			for (const tri of this.tris) tri.render(ox, oy);
		}
	}

	class Text {
		constructor(ctx, color, text, x, y, fontSize = 16, font = 'sans-serif', anchor = 'top-left') {
			this.ctx = ctx;
			this.color = parseHexColor(color);

			const { texture, w, h } = getTextTexture(ctx, text, fontSize, font);
			this.texture = texture;
			this.uvBuffer = getUvBuffer(ctx);
			this.posBuffer = getPosBuffer(ctx, text, fontSize, font, x, y, anchor, w, h);
		}

		render(ox = 0, oy = 0) {
			const ctx = this.ctx;
			const prog = getTextProgram(ctx);
			if (!prog) return;

			if (prog.program !== _program) { ctx.useProgram(prog.program); _program = prog.program; }
			if (!_blendReady) { ctx.enable(ctx.BLEND); ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA); _blendReady = true; }

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.posBuffer);
			if (!_enabledAttribs.has(prog.positionLoc)) { ctx.enableVertexAttribArray(prog.positionLoc); _enabledAttribs.add(prog.positionLoc); }
			ctx.vertexAttribPointer(prog.positionLoc, 2, ctx.FLOAT, false, 0, 0);

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.uvBuffer);
			if (!_enabledAttribs.has(prog.texCoordLoc)) { ctx.enableVertexAttribArray(prog.texCoordLoc); _enabledAttribs.add(prog.texCoordLoc); }
			ctx.vertexAttribPointer(prog.texCoordLoc, 2, ctx.FLOAT, false, 0, 0);

			ctx.uniform2f(prog.resolutionLoc, ctx.drawingBufferWidth, ctx.drawingBufferHeight);
			ctx.uniform2f(prog.offsetLoc, ox, oy);
			ctx.uniform4fv(prog.colorLoc, this.color);

			ctx.activeTexture(ctx.TEXTURE0);
			ctx.bindTexture(ctx.TEXTURE_2D, this.texture);
			ctx.uniform1i(prog.textureLoc, 0);

			ctx.drawArrays(ctx.TRIANGLES, 0, 6);
		}
	}

	const beginFrame = () => { _program = null; };

	return { Triangle, Quad, Text, beginFrame };
})();

const Prefab = (() => {
	class Face {
		constructor(ctx) {
			this._ctx = ctx;
			this._exprs = {};
		}

		_build(eyes, mouth) {
			const key = `${eyes}:${mouth}`;
			if (!this._exprs[key]) {
				this._exprs[key] = [
					...Face.eyes[eyes](this._ctx),
					...Face.mouth[mouth](this._ctx),
				];
			}
			return this._exprs[key];
		}

		render(x, y, eyes = 'open', mouth = 'smile') {
			const parts = this._build(eyes, mouth);
			if (!parts) return;
			for (const part of parts) {
				if (part) part.render(x, y);
			}
		}
	}

	Face.eyes = {
		open: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-300,-300],[-100,-250],[-300,-100],[-100,-100]),
			new GameObject.Quad(ctx, "#FFFFFFFF", [ 300,-300],[ 100,-250],[ 300,-100],[ 100,-100]),
		],
		closed: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-300,-195],[-100,-190],[-300,-175],[-100,-170]),
			new GameObject.Quad(ctx, "#FFFFFFFF", [ 300,-195],[ 100,-190],[ 300,-175],[ 100,-170]),
		],
		angry: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-300,-300],[-100,-150],[-300,-100],[-100,-100]),
			new GameObject.Quad(ctx, "#FFFFFFFF", [ 300,-300],[ 100,-150],[ 300,-100],[ 100,-100]),
		],
		sad: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-300,-200],[-100,-300],[-300,-100],[-100,-100]),
			new GameObject.Quad(ctx, "#FFFFFFFF", [ 300,-200],[ 100,-300],[ 300,-100],[ 100,-100]),
		],
	};

	Face.mouth = {
		smile: (ctx) => [
			new GameObject.Triangle(ctx, "#FFFFFFFF", [-100, 100],[ 100, 100],[0, 300]),
			new GameObject.Triangle(ctx, "#191919FF", [ -50, 100],[  50, 100],[0, 200]),
		],
		frown: (ctx) => [
			new GameObject.Triangle(ctx, "#FFFFFFFF", [-100, 300],[ 100, 300],[0, 100]),
			new GameObject.Triangle(ctx, "#191919FF", [ -50, 300],[  50, 300],[0, 200]),
		],
		flat: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-150, 180],[150, 180],[-150, 220],[150, 220]),
			null,
		],
		dot: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-20, 180],[20, 180],[-20, 220],[20, 220]),
			null,
		],
		left_dot: (ctx) => [
			new GameObject.Quad(ctx, "#FFFFFFFF", [-70, 180],[-30, 180],[-70, 220],[-30, 220]),
			null,
		],
	};

	return { Face };
})();

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
		{ label: "Start game",   action: () => { state.achievements.add("blind_trust"); state.screen = "gameScreen"; } },
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
	}

	// Find partial match for highlight
	const matchedItem = typedLower.length > 0
		? menuItems.find(item => item.label.toLowerCase().startsWith(typedLower))
		: null;
	input.completion = matchedItem ? matchedItem.label : null;

	new GameObject.Text(ctx, "#FFFFFFFF", "Diewriter", 100, 100, 64, 'sans-serif').render();

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

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

const FRAME_MS = 1000 / 60;

const loop = (canvas, ctx, postShader, tgt, input, prefabs, state, lastTime = 0) => {
	requestAnimationFrame((now) => {
		if (now - lastTime < FRAME_MS) {
			loop(canvas, ctx, postShader, tgt, input, prefabs, state, lastTime);
			return;
		}

		document.getElementById("loading")?.remove();
		GameObject.beginFrame();

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

		ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
		Shader.applyPostShader(ctx, postShader, tgt.texture, state.graphics, now, canvas.height);

		loop(canvas, ctx, postShader, tgt, input, prefabs, state, now);
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

	const postShader = await Shader.createPostShader(ctx, yieldToMain);
	await yieldToMain();
	const tgt = Shader.createRenderTarget(ctx);
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
	loop(canvas, ctx, postShader, tgt, input, prefabs, state);
}

main();

