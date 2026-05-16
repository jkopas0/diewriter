const Shader = (() => {
	const ABERRATION_VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

	const GRAIN_FRAG = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_time;
uniform float u_strength;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture2D(u_texture, v_uv);
  float grain = (rand(v_uv + u_time) - 0.5) * u_strength;
  gl_FragColor = vec4(color.rgb + grain, color.a);
}
`;

	const ABERRATION_FRAG = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_offset;
varying vec2 v_uv;
void main() {
  float r = texture2D(u_texture, v_uv + u_offset).r;
  float g = texture2D(u_texture, v_uv).g;
  float b = texture2D(u_texture, v_uv - u_offset).b;
  float a = texture2D(u_texture, v_uv).a;
  gl_FragColor = vec4(r, g, b, a);
}
`;

	const SCANLINE_FRAG = `
precision mediump float;
uniform sampler2D u_texture;
uniform float u_count;
uniform float u_strength;
varying vec2 v_uv;
void main() {
  vec4 color = texture2D(u_texture, v_uv);
  float band = sin(v_uv.y * u_count * 3.14159265) * 0.5 + 0.5;
  float factor = 1.0 - u_strength * (1.0 - band);
  gl_FragColor = vec4(color.rgb * factor, color.a);
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

	const createProgram = (ctx, vertSrc, fragSrc) => {
		const vert = compileShader(ctx, ctx.VERTEX_SHADER, vertSrc);
		const frag = compileShader(ctx, ctx.FRAGMENT_SHADER, fragSrc);
		if (!vert || !frag) return null;

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
		return program;
	};

	const createGrainShader = (ctx) => {
		const program = createProgram(ctx, ABERRATION_VERT, GRAIN_FRAG);
		if (!program) return null;

		const quadBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			-1, -1,   1, -1,  -1,  1,
			-1,  1,   1, -1,   1,  1,
		]), ctx.STATIC_DRAW);

		return {
			program,
			positionLoc: ctx.getAttribLocation(program, "a_position"),
			textureLoc:  ctx.getUniformLocation(program, "u_texture"),
			timeLoc:     ctx.getUniformLocation(program, "u_time"),
			strengthLoc: ctx.getUniformLocation(program, "u_strength"),
			quadBuffer,
		};
	};

	const applyGrainShader = (ctx, shader, texture, time, strength) => {
		ctx.useProgram(shader.program);

		ctx.bindBuffer(ctx.ARRAY_BUFFER, shader.quadBuffer);
		ctx.enableVertexAttribArray(shader.positionLoc);
		ctx.vertexAttribPointer(shader.positionLoc, 2, ctx.FLOAT, false, 0, 0);

		ctx.activeTexture(ctx.TEXTURE0);
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.uniform1i(shader.textureLoc, 0);
		ctx.uniform1f(shader.timeLoc, time);
		ctx.uniform1f(shader.strengthLoc, strength);

		ctx.drawArrays(ctx.TRIANGLES, 0, 6);
	};

	const createAberrationShader = (ctx) => {
		const program = createProgram(ctx, ABERRATION_VERT, ABERRATION_FRAG);
		if (!program) return null;

		const quadBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			-1, -1,   1, -1,  -1,  1,
			-1,  1,   1, -1,   1,  1,
		]), ctx.STATIC_DRAW);

		return {
			program,
			positionLoc: ctx.getAttribLocation(program, "a_position"),
			textureLoc:  ctx.getUniformLocation(program, "u_texture"),
			offsetLoc:   ctx.getUniformLocation(program, "u_offset"),
			quadBuffer,
		};
	};

	const applyAberrationShader = (ctx, shader, texture, offsetX, offsetY) => {
		ctx.useProgram(shader.program);

		ctx.bindBuffer(ctx.ARRAY_BUFFER, shader.quadBuffer);
		ctx.enableVertexAttribArray(shader.positionLoc);
		ctx.vertexAttribPointer(shader.positionLoc, 2, ctx.FLOAT, false, 0, 0);

		ctx.activeTexture(ctx.TEXTURE0);
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.uniform1i(shader.textureLoc, 0);
		ctx.uniform2f(shader.offsetLoc, offsetX, offsetY);

		ctx.drawArrays(ctx.TRIANGLES, 0, 6);
	};

	const createScanlineShader = (ctx) => {
		const program = createProgram(ctx, ABERRATION_VERT, SCANLINE_FRAG);
		if (!program) return null;

		const quadBuffer = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuffer);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			-1, -1,   1, -1,  -1,  1,
			-1,  1,   1, -1,   1,  1,
		]), ctx.STATIC_DRAW);

		return {
			program,
			positionLoc: ctx.getAttribLocation(program, "a_position"),
			textureLoc:  ctx.getUniformLocation(program, "u_texture"),
			countLoc:    ctx.getUniformLocation(program, "u_count"),
			strengthLoc: ctx.getUniformLocation(program, "u_strength"),
			quadBuffer,
		};
	};

	const applyScanlineShader = (ctx, shader, texture, count, strength) => {
		ctx.useProgram(shader.program);

		ctx.bindBuffer(ctx.ARRAY_BUFFER, shader.quadBuffer);
		ctx.enableVertexAttribArray(shader.positionLoc);
		ctx.vertexAttribPointer(shader.positionLoc, 2, ctx.FLOAT, false, 0, 0);

		ctx.activeTexture(ctx.TEXTURE0);
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.uniform1i(shader.textureLoc, 0);
		ctx.uniform1f(shader.countLoc, count);
		ctx.uniform1f(shader.strengthLoc, strength);

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

	const createPipeline = (ctx) => ({
		buffers: [createRenderTarget(ctx), createRenderTarget(ctx)],
	});

	const runPipeline = (ctx, pipeline, srcTexture, steps) => {
		let readTex = srcTexture;
		for (let i = 0; i < steps.length; i++) {
			const isLast = i === steps.length - 1;
			const writeTgt = pipeline.buffers[i % 2];
			ctx.bindFramebuffer(ctx.FRAMEBUFFER, isLast ? null : writeTgt.framebuffer);
			steps[i](ctx, readTex);
			readTex = writeTgt.texture;
		}
	};

	return { createAberrationShader, applyAberrationShader, createGrainShader, applyGrainShader, createScanlineShader, applyScanlineShader, createRenderTarget, createPipeline, runPipeline };
})();
