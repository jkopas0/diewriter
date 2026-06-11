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
