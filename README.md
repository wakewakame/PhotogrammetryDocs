# 三次元復元についての解説

この解説では、複数の写真に共通して映る点群の画素座標の位置関係をもとに、全てのカメラの撮影位置、撮影角度と点群の三次元座標を同時に推定する手法についてを紹介します。

# 目次

- 準備
	- サンプルプログラムの実行環境を準備
	- カメラと点群の仮想空間を準備
- 2枚の画像から三次元復元する手法
	- [8点アルゴリズム](./articles/8pt_algorithm/README.md)
	- 5点アルゴリズム
- ノイズや誤対応を含む特徴点ペアへの対処方法
	- RANSAC
	- LMedS
	- MAGSAC
- 複数枚の画像から再投影誤差を最小化する手法
	- バンドル調整
- 補足記事
	- カメラキャリブレーション
	- 特徴点マッチング
