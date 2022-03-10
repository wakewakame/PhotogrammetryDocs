from flask import Flask

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index():
	return app.send_static_file('html/index.html')

app.run(port=8000, debug=True)
