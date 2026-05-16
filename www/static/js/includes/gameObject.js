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

	const parseHexColor = (hex) => {
		const h = hex.replace("#", "");
		const r = parseInt(h.slice(0, 2), 16) / 255;
		const g = parseInt(h.slice(2, 4), 16) / 255;
		const b = parseInt(h.slice(4, 6), 16) / 255;
		const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1.0;
		return [r, g, b, a];
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

			ctx.useProgram(prog.program);

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.buffer);
			ctx.enableVertexAttribArray(prog.positionLoc);
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

			this.texture = ctx.createTexture();
			ctx.bindTexture(ctx.TEXTURE_2D, this.texture);
			ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, canvas2d);
			ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
			ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
			ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
			ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);

			const [h_part, v_part] = anchor.split('-');
			const ox = h_part === 'right' ? w : h_part === 'middle' ? w / 2 : 0;
			const oy = v_part === 'bottom' ? h : v_part === 'middle' ? h / 2 : 0;
			const x1 = x - ox, y1 = y - oy, x2 = x1 + w, y2 = y1 + h;
			this.posBuffer = ctx.createBuffer();
			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.posBuffer);
			ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
				x1, y1,  x2, y1,  x1, y2,
				x2, y1,  x2, y2,  x1, y2,
			]), ctx.STATIC_DRAW);

			this.uvBuffer = ctx.createBuffer();
			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.uvBuffer);
			ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
				0, 0,  1, 0,  0, 1,
				1, 0,  1, 1,  0, 1,
			]), ctx.STATIC_DRAW);
		}

		render(ox = 0, oy = 0) {
			const ctx = this.ctx;
			const prog = getTextProgram(ctx);
			if (!prog) return;

			ctx.useProgram(prog.program);

			ctx.enable(ctx.BLEND);
			ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.posBuffer);
			ctx.enableVertexAttribArray(prog.positionLoc);
			ctx.vertexAttribPointer(prog.positionLoc, 2, ctx.FLOAT, false, 0, 0);

			ctx.bindBuffer(ctx.ARRAY_BUFFER, this.uvBuffer);
			ctx.enableVertexAttribArray(prog.texCoordLoc);
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

	return { Triangle, Quad, Text };
})();
