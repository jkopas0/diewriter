const Prefab = (() => {
	class Face {
		constructor(ctx) {
			this._exprs = {};
			for (const eyes of Object.keys(Face.eyes)) {
				for (const mouth of Object.keys(Face.mouth)) {
					this._exprs[`${eyes}:${mouth}`] = [
						...Face.eyes[eyes](ctx),
						...Face.mouth[mouth](ctx),
					];
				}
			}
		}

		render(x, y, eyes = 'open', mouth = 'smile') {
			const parts = this._exprs[`${eyes}:${mouth}`];
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
