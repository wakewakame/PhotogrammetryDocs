import vector from "./vector.js";

const Scene = class {
	constructor() {
		this.models = new Array();
	}
	addModel(model) {
		model.scene = this;
		this.models.push(model);
		this.update();
		return model;
	}
	update() {
		this.models.forEach(model => { model.update(); });
	}
};

const Model = class {
	constructor() {
		this.scene = null;
	}
	update() {
	}
	draw(cam) {
	}
};

const VirtualCameraModel = class extends Model {
	constructor(width, height, color = "#CCA990") {
		super();
		this.width = width;
		this.height = height;
		const f = (this.width + this.height) / 2.0;
		const cx = this.width / 2.0;
		const cy = this.height / 2.0;
		this.view = new DOMMatrix([
			1, 0, 0 , 0,
			0, 1, 0 , 0,
			0, 0, 1 , 0,
			0, 0, 10, 1
		]);
		this.projection = new DOMMatrix([
			f , 0 , 0, 0,
			0 , f , 0, 0,
			cx, cy, 1, 1,
			0 , 0 , 0, 0 
		]);
		this.color = color;
	}
	worldToScreen(points) {
		return points
			.map(point => new DOMPoint(point[0], point[1], point[2], 1))
			.map(point => this.view.transformPoint(point))
			.map(point => this.projection.transformPoint(point))
			.map(point => { point.x /= point.w; point.y /= point.w; return point; });
	}
	draw(cam) {
		if (cam === this) { return; }
		const width = 1;
		const height = this.height * width / this.width;
		const focalLength = -this.projection.m11 * width / this.width;
		const viewInverse = vector.normalizeScale(this.view).inverse();
		const center = viewInverse.transformPoint(new DOMPoint(0.0, 0.0, 0.0, 1.0));
		const p1 = viewInverse.transformPoint(new DOMPoint(-width, -height, -focalLength));  // left top
		const p2 = viewInverse.transformPoint(new DOMPoint(+width, -height, -focalLength));  // right top
		const p3 = viewInverse.transformPoint(new DOMPoint(+width, +height, -focalLength));  // right bottom
		const p4 = viewInverse.transformPoint(new DOMPoint(-width, +height, -focalLength));  // left bottom
		cam.line3d(center.x, center.y, center.z, p1.x, p1.y, p1.z, 2, this.color);
		cam.line3d(center.x, center.y, center.z, p2.x, p2.y, p2.z, 2, this.color);
		cam.line3d(center.x, center.y, center.z, p3.x, p3.y, p3.z, 2, this.color);
		cam.line3d(center.x, center.y, center.z, p4.x, p4.y, p4.z, 2, this.color);
		cam.line3d(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, 2, this.color);
		cam.line3d(p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, 2, this.color);
		cam.line3d(p3.x, p3.y, p3.z, p4.x, p4.y, p4.z, 2, this.color);
		cam.line3d(p4.x, p4.y, p4.z, p1.x, p1.y, p1.z, 2, this.color);
	}
};

const CameraModel = class extends VirtualCameraModel {
	constructor(canvas, color = "#77A9B0") {
		super(canvas.width, canvas.height, color);
		this.canvas = canvas;
		this.context2d = canvas.getContext("2d");
		this.scale = 4.0;
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
	update() {
		setTimeout(() => {
			this.clear();
			this.scene.models.forEach(model => {
				model.draw(this);
			});
		}, 0);
	}
};

const CameraModelWithMouse = class extends CameraModel {
	constructor(canvas, color = "#77A9B0") {
		super(canvas, color);
		canvas.addEventListener("mousedown", () => {
			const callback = e => { this.mouseController(e); };
			window.addEventListener("mousemove", callback);
			window.addEventListener("mouseup", () => {
				window.removeEventListener("mousemove", callback);
				document.body.style["user-select"] = "auto";
			});
			document.body.style["user-select"] = "none";
		});
	}
	mouseController(e) {
		if (e.buttons & 0b00001 === 1) {
			if (e.shiftKey) {
				this.view.m41 += e.movementX / 100.0;
				this.view.m42 += e.movementY / 100.0;
			}
			else if (e.ctrlKey) {
				const scale = 1.0 - e.movementY / 100.0;
				this.view.m43 -= 10;
				this.view.scaleSelf(scale, scale, scale);
				this.view.m43 += 10;
			}
			else {
				const move = new DOMPoint(-e.movementY, e.movementX, 0.0, 1.0);
				const length = vector.length(move);
				const rotate = vector.rotate(move, length / 100.0);
				this.view.m43 -= 10;
				this.view.preMultiplySelf(rotate);
				this.view.m43 += 10;
			}
			this.scene.update();
		}
	}
};

const AxisModel = class extends Model {
	draw(cam) {
		cam.line3d(0, 0, 0, 1, 0, 0, 4, "#FA8CBB");
		cam.line3d(0, 0, 0, 0, 1, 0, 4, "#73E4FA");
		cam.line3d(0, 0, 0, 0, 0, 1, 4, "#F9F098");
	}
};

const PointsModel = class extends Model {
	constructor(color = "#77A9B0", points = new Array()) {
		super();
		this.points = points;
		this.color = color;
	}
	draw(cam) {
		for(const point of this.points) {
			cam.point3d(point[0], point[1], point[2], this.color);
		}
	}
	updatePoints(points) {
		this.points = points;
		this.scene.update();
	}
}

export default {
	Scene: Scene,
	Model: Model,
	VirtualCameraModel: VirtualCameraModel,
	CameraModel: CameraModel,
	CameraModelWithMouse: CameraModelWithMouse,
	AxisModel: AxisModel,
	PointsModel: PointsModel,
};
