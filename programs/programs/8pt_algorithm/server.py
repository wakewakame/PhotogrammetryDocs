from flask import Flask, request, redirect
import json
import numpy as np
import cv2

app = Flask(__name__, static_folder="./html/", static_url_path="/html/")

@app.route("/")
def index():
	return redirect("/html/index.html")

@app.route("/8pt", methods=["POST"])
def eight_pt():
	# リクエストボディからカメラ内部パラメータと点群の画像座標を取得
	data = json.loads(request.get_data())
	cam1 = np.array(data["cam1"], dtype=np.float64)
	cam2 = np.array(data["cam2"], dtype=np.float64)
	points1 = np.array(data["points1"], dtype=np.float64)
	points2 = np.array(data["points2"], dtype=np.float64)

	# 基礎行列Fを計算
	F, _ = cv2.findFundamentalMat(points1, points2, cv2.FM_LMEDS)
	if F is None:
		return json.dumps(None)

	# 基本行列Eを計算
	#E, _ = cv2.findEssentialMat(points1, points2, focal=1.0, pp=(0.0, 0.0), method=cv2.LMEDS, prob=0.999)
	E = np.dot(cam2.T, np.dot(F, cam1))

	# 基本行列Eを回転行列Rと平行移動ベクトルtに分解
	dist_coeffs = np.array([0.0, 0.0, 0.0, 0.0, 0.0])
	points1_norm = cv2.undistortPoints(np.expand_dims(points1, axis=1), cam1, dist_coeffs)
	points2_norm = cv2.undistortPoints(np.expand_dims(points2, axis=1), cam2, dist_coeffs)
	_, R, t, _ = cv2.recoverPose(
		E, points1_norm, points2_norm
	)

	# 2つのカメラのプロジェクションビュー行列を作成
	cam1_pv = np.dot(cam1, np.hstack((np.eye(3, 3), np.zeros((3, 1)))))
	cam2_pv = np.dot(cam2, np.hstack((R, t)))

	# 三角測量による点群の三次元座標を計算
	points_4d = cv2.triangulatePoints(
		cam1_pv, cam2_pv,
		np.expand_dims(points1, axis=1), np.expand_dims(points2, axis=1)
	)
	points_4d = (points_4d / np.tile(points_4d[-1, :], (4, 1))).T
	points_3d = points_4d[:, :3]

	# 求めたR, t, points_3dから点群の再投影座標を計算
	points1_reproj = np.array([np.dot(cam1_pv, pt) for pt in points_4d])
	points2_reproj = np.array([np.dot(cam2_pv, pt) for pt in points_4d])
	points1_reproj = (points1_reproj / np.tile(points1_reproj[:, -1], (3, 1)).T)[:, :2]
	points2_reproj = (points2_reproj / np.tile(points2_reproj[:, -1], (3, 1)).T)[:, :2]

	# 結果を返す
	return json.dumps({
		"Rt": np.hstack((R, t)).tolist(),
		"points": points_3d.tolist()
	})

app.run(port=8000, debug=True)
