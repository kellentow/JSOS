import flask, os, importlib.util, sys

app = flask.Flask(__name__)

ka = int(os.getenv("ka", "0"))
ping = os.getenv("ping", "https://example.com/")

if ka > 0:
    import threading
    import time
    import requests

    def KA_ping():
        while True:
            try:
                requests.get(ping)
            except Exception as e:
                print(f"Error pinging {ping}: {e}")
            time.sleep(ka)
    threading.Thread(target=KA_ping, daemon=True).start()

@app.route('/')
def index():
    return flask.send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'index.html')

@app.route("/ka")
def ka():
    return "", 200

@app.route('/favicon.ico')
def send_favicon():
    return flask.send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), "favicon.ico")

@app.route('/static/<path:path>')
def send_static(path):
    return flask.send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), path)

@app.route('/backend/<path:full_path>', methods=['GET', 'POST'])
def send_backend(full_path):
    try:
        # Example: full_path = "appid/foo/bar"
        parts = full_path.split('/')
        app_id = parts[0]
        remaining_path = parts[1:]  # e.g., [foo,bar]

        # Path to backend module
        module_path = os.path.join('backend', app_id, '__init__.py')
        if not os.path.exists(module_path):
            return flask.jsonify({"error": "App not found"}), 404

        # Load the module dynamically
        spec = importlib.util.spec_from_file_location(f"backend.{app_id}", module_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[f"backend.{app_id}"] = module
        spec.loader.exec_module(module)

        # Pass the request to the module's handler function
        if hasattr(module, 'handle_request'):
            return module.handle_request(flask.request, remaining_path)
        else:
            return flask.jsonify({"error": "App handler not found"}), 500
    except Exception as e:
        return flask.jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)