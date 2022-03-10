import vector from "./vector.js";

const Renderer3D = class {
	constructor(canvas) {
		this.canvas = canvas;
		this.context2d = canvas.getContext("2d");
		this.scale = 4.0;

		const f = (canvas.width + canvas.height) / 2.0;
		const cx = canvas.width / 2.0;
		const cy = canvas.height / 2.0;

		this.matrix = {
			dataset: this.canvas.dataset,
			get view() { return DOMMatrix.fromMatrix(JSON.parse(this.dataset.view_matrix)); },
			set view(matrix) { this.dataset.view_matrix = JSON.stringify(matrix); },
			get projection() { return DOMMatrix.fromMatrix(JSON.parse(this.dataset.projection_matrix)); },
			set projection(matrix) { this.dataset.projection_matrix = JSON.stringify(matrix); },
		};
		this.matrix.view = new DOMMatrix([
			1, 0, 0 , 0,
			0, 1, 0 , 0,
			0, 0, 1 , 0,
			0, 0, 10, 1
		]);
		this.matrix.projection = new DOMMatrix([
			f , 0 , 0, 0,
			0 , f , 0, 0,
			cx, cy, 1, 1,
			0 , 0 , 0, 0 
		]);
	}
	worldToScreen(points) {
		const domPoints = [];
		for(const point of points) {
			let domPoint = new DOMPoint(point[0], point[1], point[2], 1);
			domPoint = this.matrix.view.transformPoint(domPoint);
			domPoint = this.matrix.projection.transformPoint(domPoint);
			domPoint.x /= domPoint.w;
			domPoint.y /= domPoint.w;
			domPoints.push(domPoint);
		}
		return domPoints;
	}
	clear() { this.context2d.clearRect(0, 0, this.canvas.width, this.canvas.height); }
	point2d(x, y, hex = "#77A9B0") {
		const ctx = this.context2d;
		ctx.save();
		try {
			ctx.fillStyle = hex;
			ctx.fillRect(x - 4 * this.scale, y - 1 * this.scale, 8 * this.scale, 2 * this.scale);
			ctx.fillRect(x - 1 * this.scale, y - 4 * this.scale, 2 * this.scale, 8 * this.scale);
		}
		finally {
			ctx.restore();
		}
	}
	point3d(x, y, z, hex = "#77A9B0") {
		const point = this.worldToScreen([[x, y, z]])[0];
		if (point.w <= 0.0) { return; }
		this.point2d(point.x, point.y, hex);
	}
	line2d(x1, y1, x2, y2, width = 4, hex = "#77A9B0") {
		const ctx = this.context2d;
		ctx.save();
		try {
			ctx.lineWidth = width * this.scale;
			ctx.strokeStyle = hex;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		}
		finally {
			ctx.restore();
		}
	}
	line3d(x1, y1, z1, x2, y2, z2, width = 4, hex = "#77A9B0") {
		const points = this.worldToScreen([
			[x1, y1, z1],
			[x2, y2, z2]
		]);
		if (points.some(point => (point.w <= 0.0))) { return; }
		this.line2d(points[0].x, points[0].y, points[1].x, points[1].y, width, hex);
	}
};

const Points3D = class {
	constructor(canvas, points) {
		this.r3d = new Renderer3D(canvas);
		this.points = points;
		canvas.addEventListener("mousedown", () => {
			const callback = e => { this.mouseController(e); };
			window.addEventListener("mousemove", callback);
			window.addEventListener("mouseup", () => {
				window.removeEventListener("mousemove", callback);
				document.body.style["user-select"] = "auto";
			});
			document.body.style["user-select"] = "none";
		});
		setTimeout(() => { this.draw(); }, 0);

		this.otherCameras = new Map();
		this.observer = new MutationObserver((mutationsList, observer) => {
			for(const mutation of mutationsList) {
				const id = mutation.target.id;
				const view = DOMMatrix.fromMatrix(JSON.parse(mutation.target.dataset.view_matrix));
				const projection = DOMMatrix.fromMatrix(JSON.parse(mutation.target.dataset.projection_matrix));
				const view_ = vector.normalizeScale(view.inverse());
				this.otherCameras.set(id, {
					viewInverse: view_,
					projection: projection,
					width: mutation.target.width,
					height: mutation.target.height,
				});
			}
			this.draw();
		});
	}
	addOtherCamera(canvas_elements) {
		const config = { attributes: true, childList: false, subtree: false };
		for(const canvas_element of canvas_elements) {
			this.observer.observe(canvas_element, config);
			const id = canvas_element.id;
			const view = DOMMatrix.fromMatrix(JSON.parse(canvas_element.dataset.view_matrix));
			const projection = DOMMatrix.fromMatrix(JSON.parse(canvas_element.dataset.projection_matrix));
			this.otherCameras.set(id, {
				viewInverse: vector.normalizeScale(view.inverse()),
				projection: projection,
				width: canvas_element.width,
				height: canvas_element.height,
			});
		}
	}
	draw() {
		const r3d = this.r3d;
		r3d.clear();
		r3d.line3d(0, 0, 0, 1, 0, 0, 4, "#FA8CBB");
		r3d.line3d(0, 0, 0, 0, 1, 0, 4, "#73E4FA");
		r3d.line3d(0, 0, 0, 0, 0, 1, 4, "#F9F098");
		const screenPoints = r3d.worldToScreen(this.points).map(point => [point.x, point.y]);
		for(const point of screenPoints) {
			r3d.point2d(point[0], point[1], point[2], "#77A9B0");
		}
		for(const camera of this.otherCameras.values()) {
			const width = 1;
			const height = camera.height * width / camera.width;
			const focalLength = -camera.projection.m11 * width / camera.width;
			const center      = camera.viewInverse.transformPoint(new DOMPoint(0.0, 0.0, 0.0, 1.0));
			const leftTop     = camera.viewInverse.transformPoint(new DOMPoint(-width, -height, -focalLength));
			const rightTop    = camera.viewInverse.transformPoint(new DOMPoint(+width, -height, -focalLength));
			const rightBottom = camera.viewInverse.transformPoint(new DOMPoint(+width, +height, -focalLength));
			const leftBottom  = camera.viewInverse.transformPoint(new DOMPoint(-width, +height, -focalLength));
			r3d.line3d(center.x, center.y, center.z, leftTop.x    , leftTop.y    , leftTop.z    , 2);
			r3d.line3d(center.x, center.y, center.z, rightTop.x   , rightTop.y   , rightTop.z   , 2);
			r3d.line3d(center.x, center.y, center.z, rightBottom.x, rightBottom.y, rightBottom.z, 2);
			r3d.line3d(center.x, center.y, center.z, leftBottom.x , leftBottom.y , leftBottom.z , 2);
			r3d.line3d(leftTop.x    , leftTop.y    , leftTop.z    , rightTop.x   , rightTop.y   , rightTop.z   , 2);
			r3d.line3d(rightTop.x   , rightTop.y   , rightTop.z   , rightBottom.x, rightBottom.y, rightBottom.z, 2);
			r3d.line3d(rightBottom.x, rightBottom.y, rightBottom.z, leftBottom.x , leftBottom.y , leftBottom.z , 2);
			r3d.line3d(leftBottom.x , leftBottom.y , leftBottom.z , leftTop.x    , leftTop.y    , leftTop.z    , 2);
		}
	}
	mouseController(e) {
		const r3d = this.r3d;
		const view = this.r3d.matrix.view;

		if (e.buttons & 0b00001 === 1) {
			if (e.shiftKey) {
				view.m41 += e.movementX / 100.0;
				view.m42 += e.movementY / 100.0;
			}
			else if (e.ctrlKey) {
				const scale = 1.0 - e.movementY / 100.0;
				view.m43 -= 10;
				view.scaleSelf(scale, scale, scale);
				view.m43 += 10;
			}
			else {
				const move = new DOMPoint(-e.movementY, e.movementX, 0.0, 1.0);
				const length = vector.length(move);
				const rotate = vector.rotate(move, length / 100.0);
				view.m43 -= 10;
				view.preMultiplySelf(rotate);
				view.m43 += 10;
			}
			this.r3d.matrix.view = view;
			this.draw();
		}
	}
}

export default {
	Renderer3D: Renderer3D,
	Points3D: Points3D,
};
