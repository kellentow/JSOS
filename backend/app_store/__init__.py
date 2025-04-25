import os,flask
backend_path = os.path.dirname(os.path.abspath(__file__))
def handle_request(request, subpath):
    if request.method == 'GET':
        match subpath[0]:
            case 'apps.csv':
                return open(os.path.join(backend_path,'apps.csv')).read()
            case 'app_data':
                id = subpath[1]
                return open(os.path.join(backend_path,'app_data',id+".metadata")).read()
            case 'download':
                id = subpath[1]
                return open(os.path.join(backend_path,'app_data',id+".zip"),'rb').read()
            case _:
                return flask.jsonify({"error": "Invalid path"}), 404
        
    elif request.method == 'POST':
        return {"message": f"POST to /{subpath}", "data": request.json}
