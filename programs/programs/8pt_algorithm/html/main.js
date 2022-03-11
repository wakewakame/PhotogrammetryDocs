import renderer from "./renderer.js";
import vector from "./vector.js";

const main = () => {
	// 配置する点群の座標
	const points = [
		[-1, -1, -1],
		[+1, -1, -1],
		[+1, +1, -1],
		[-1, +1, -1],
		[-1, -1, +1],
		[+1, -1, +1],
		[+1, +1, +1],
		[-1, +1, +1],
	];
	for(let i = 0; i < 0; i++) {
		const x = Math.random() * 2 - 1;
		const y = Math.random() * 2 - 1;
		const z = Math.random() * 2 - 1;
		points.push([x, y, z]);
	}

	// canvasの取得
	const cam1_canvas = document.getElementById("cam1");  // カメラ1
	const cam2_canvas = document.getElementById("cam2");  // カメラ2
	const preview_canvas = document.getElementById("preview");  // 全体像把握用のプレビュー

	// シーンの作成
	const scene = new renderer.Scene();

	// カメラと点群のモデルを生成し、シーンに追加
	const cam1_cam = new renderer.CameraModelWithMouse(cam1_canvas);
	const cam2_cam = new renderer.CameraModelWithMouse(cam2_canvas);
	const preview_cam = new renderer.CameraModelWithMouse(preview_canvas, "#00000000");
	const axis_model = new renderer.AxisModel();
	const points_model = new renderer.PointsModel("#77A9B0", points);
	scene.addModel(cam1_cam);
	scene.addModel(cam2_cam);
	scene.addModel(preview_cam);
	scene.addModel(axis_model);
	scene.addModel(points_model);

	// 8点アルゴリズムによって求めたカメラと点群の位置をシーンに追加
	const cam2_cam_reconstructed = new renderer.VirtualCameraModel(0, 0);
	const points_model_reconstructed = new renderer.PointsModel("#CCA990");
	scene.addModel(cam2_cam_reconstructed);
	scene.addModel(points_model_reconstructed);

	const calc = async () => {
		// 回転行列と平行移動ベクトル、点群の三次元座標を計算
		const body = JSON.stringify({
			"cam1": vector.matToOpencvIntrinsics(cam1_cam.projection),
			"cam2": vector.matToOpencvIntrinsics(cam2_cam.projection),
			"points1": cam1_cam.worldToScreen(points).map(point => [point.x, point.y]),
			"points2": cam2_cam.worldToScreen(points).map(point => [point.x, point.y]),
		});
		const response = await fetch("/8pt", {method: "POST", body: body});
		const data = await response.json();
		if (data === null) { return; }
		const Rt_ = DOMMatrix.fromFloat64Array(new Float64Array([
			data["Rt"][0][0], data["Rt"][1][0], data["Rt"][2][0], 0,
			data["Rt"][0][1], data["Rt"][1][1], data["Rt"][2][1], 0,
			data["Rt"][0][2], data["Rt"][1][2], data["Rt"][2][2], 0,
			data["Rt"][0][3], data["Rt"][1][3], data["Rt"][2][3], 1
		]));
		let points_ = data["points"];

		// 現実の回転行列と平行移動ベクトルを計算
		const cam1_view = vector.normalizeScale(cam1_cam.view);
		const cam2_view = vector.normalizeScale(cam2_cam.view);
		const Rt = cam2_view.multiply(cam1_view.inverse());

		// Rt_とRtの平行移動成分の長さから、Rt_とpoints_のスケールをRtとpointsに合わせる
		const Rt_length_ = Math.sqrt(Rt_.m41 * Rt_.m41 + Rt_.m42 * Rt_.m42 + Rt_.m43 * Rt_.m43);
		const Rt_length = Math.sqrt(Rt.m41 * Rt.m41 + Rt.m42 * Rt.m42 + Rt.m43 * Rt.m43);
		const scale = Rt_length / Rt_length_;
		Rt_.m41 *= scale; Rt_.m42 *= scale; Rt_.m43 *= scale;
		points_ = points_.map(([x, y, z]) => [x * scale, y * scale, z * scale]);

		// points_をcam1座標系から世界座標系へ変形
		points_ = points_.map(([x, y, z]) => {
			let point = new DOMPoint(x, y, z, 1);
			point = cam1_view.inverse().transformPoint(point);
			return [point.x, point.y, point.z, 1];
		});

		// プレビューの更新
		cam2_cam_reconstructed.width      = cam2_cam.width;
		cam2_cam_reconstructed.height     = cam2_cam.height;
		cam2_cam_reconstructed.view       = Rt_.multiply(cam1_view);
		cam2_cam_reconstructed.projection = cam2_cam.projection;
		points_model_reconstructed.points = points_;
		scene.update();
	};
	cam1_canvas.addEventListener("mouseup", async () => { calc(); });
	cam2_canvas.addEventListener("mouseup", async () => { calc(); });
};

window.addEventListener("DOMContentLoaded", () => {
	main();
});
