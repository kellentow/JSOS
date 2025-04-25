import flask, os, importlib.util, sys

app = flask.Flask(__name__)

@app.route('/')
def index():
    return flask.send_from_directory(os.path.join(os.path.dirname(__file__), 'static'), 'index.html')

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
# This is a simple Flask application that serves static files and dynamically loads backend modules based on the request path.